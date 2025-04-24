import sys
import os
import math
from flask import Flask, request, jsonify
from flask_cors import CORS

# --- Add submodule to Python path ---
# Get the directory containing this script
backend_dir = os.path.dirname(__file__)
# Construct the path to the submodule's top-level package directory
submodule_dir = os.path.abspath(os.path.join(backend_dir, 'submods', 'ecologits'))
# Add it to the beginning of sys.path if not already present
if submodule_dir not in sys.path:
    sys.path.insert(0, submodule_dir)
# --- Submodule path added ---

# --- Import from submodule ---
try:
    from ecologits.impacts.llm import compute_llm_impacts
    # Import ArchitectureTypes and Providers from model_repository
    from ecologits.model_repository import ModelRepository, ArchitectureTypes, Providers
    from ecologits.electricity_mix_repository import ElectricityMixRepository
    from ecologits.utils.range_value import RangeValue # Import RangeValue
except ImportError as e:
    print(f"Error importing from ecologits submodule: {e}")
    sys.exit(1)
# --- End submodule imports ---

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# --- Initialize Repositories ---
# Construct paths to data files within the submodule
data_dir = os.path.join(submodule_dir, 'ecologits', 'data')
models_json_path = os.path.join(data_dir, 'models.json')
electricity_csv_path = os.path.join(data_dir, 'electricity_mixes.csv')

try:
    model_repo = ModelRepository.from_json(filepath=models_json_path)
    electricity_repo = ElectricityMixRepository.from_csv(filepath=electricity_csv_path)
except FileNotFoundError as e:
    print(f"Error initializing repositories: Data file not found - {e}")
    sys.exit(1)
except Exception as e:
    print(f"Error initializing repositories: {e}")
    sys.exit(1)
# --- Repositories Initialized ---

# Helper function to format RangeValue for JSON
def format_value(value):
    if isinstance(value, RangeValue):
        # Convert grams to kg for GWP for consistency if needed, or keep as is
        # Example: return {"min": value.min / 1000, "max": value.max / 1000} if value represents gCO2eq
        return {"min": value.min, "max": value.max}
    return value

@app.route('/calculate', methods=['POST'])
def calculate_impact():
    data = request.get_json()
    print(f"Received request data: {data}") # Log received data
    if not data or 'model' not in data or 'tokens' not in data:
        return jsonify({"error": "Missing model or tokens in request"}), 400

    model_name_input = data['model']
    tokens = data['tokens']
    region = "USA"
    print(f"Attempting calculation for model: '{model_name_input}', tokens: {tokens}, region: '{region}'") # Log inputs

    try:
        # --- Get model parameters ---
        model_key = model_name_input # Adjust this mapping if necessary
        print(f"Looking up model with key: '{model_key}'") # Log lookup key

        # Try finding the model across known providers
        # FIXME: Remove print statements in production code or replace with proper logging
        model_params = None
        provider_used = None
        for p in [prov.value for prov in Providers]:
            print(f"  Checking provider: {p}") # Log provider check
            potential_model = model_repo.find_model(provider=p, model_name=model_key)
            if potential_model:
                model_params = potential_model
                provider_used = p
                print(f"  Found model under provider: {p}") # Log success
                break # Stop searching once found

        if model_params is None:
            print(f"Model not found for key: '{model_key}' across all providers.") # Log failure
            raise ModelNotFound(f"Model not found for key: {model_key} across known providers")

        # Extract parameters based on architecture type
        if model_params.architecture.type == ArchitectureTypes.MOE:
            active_params = model_params.architecture.parameters.active
            total_params = model_params.architecture.parameters.total
        else: # Assuming DENSE or other types where parameters is a single value/range
            active_params = model_params.architecture.parameters
            total_params = model_params.architecture.parameters # Use the same value if only one is defined

        # --- Get electricity mix data ---
        # Use the find_electricity_mix method
        mix_data = electricity_repo.find_electricity_mix(region)
        if mix_data is None:
            raise ElectricityMixNotFound(f"Electricity mix not found for region: {region}")

        gwp_factor = mix_data.gwp
        adpe_factor = mix_data.adpe
        pe_factor = mix_data.pe

        # --- Call compute_llm_impacts from submodule ---
        impacts = compute_llm_impacts(
            model_active_parameter_count=active_params,
            model_total_parameter_count=total_params,
            output_token_count=float(tokens),
            if_electricity_mix_gwp=gwp_factor,
            if_electricity_mix_adpe=adpe_factor,
            if_electricity_mix_pe=pe_factor,
            # request_latency=None, # Optional: pass if available
        )

        # --- Format response --- 
        # Convert grams to kg for GWP (ecologits usually returns kgCO2eq)
        # Check units in ecologits if unsure
        response_data = {
            "model": model_name_input,
            "tokens": tokens,
            "region": region,
            "impacts": {
                "gwp_kgCO2eq": format_value(impacts.gwp.value), # Global Warming Potential
                "adpe_kgSbeq": format_value(impacts.adpe.value), # Abiotic Depletion Potential (elements)
                "pe_MJ": format_value(impacts.pe.value),       # Primary Energy
                "energy_kWh": format_value(impacts.energy.value) # Direct Energy Consumption
            },
            "breakdown": { # Optional: include usage/embodied breakdown
                "usage": {
                    "gwp_kgCO2eq": format_value(impacts.usage.gwp.value),
                    "adpe_kgSbeq": format_value(impacts.usage.adpe.value),
                    "pe_MJ": format_value(impacts.usage.pe.value),
                    "energy_kWh": format_value(impacts.usage.energy.value)
                },
                "embodied": {
                    "gwp_kgCO2eq": format_value(impacts.embodied.gwp.value),
                    "adpe_kgSbeq": format_value(impacts.embodied.adpe.value),
                    "pe_MJ": format_value(impacts.embodied.pe.value)
                }
            }
        }

        return jsonify(response_data)


    except Exception as e:
        print(f"Generic exception caught: {e}") # Log exception
        print(f"Error during calculation: {e}") # Log error server-side
        # FIXME: Consider more specific error handling based on potential exceptions from compute_llm_impacts
        return jsonify({"error": "Calculation failed", "details": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
