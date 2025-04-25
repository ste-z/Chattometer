# Chattometer: Track the Environmental Impacts of Your Chatbot Usage 🌱

*By: Nuo Cen, Steven Zhou, Baihe Peng*

Welcome to **Chattometer**, a Chrome Extension that shows the hidden environmental cost of your AI interactions! As Large Language Models (LLMs) like ChatGPT become part of daily life, most people are unaware of the energy and resources consumed with every prompt.

Chattometer calculates and visualizes the energy impact of LLM usage in real-time—helping you make smarter, more sustainable choices.

---

## 🚀 Project Overview

The rapid growth of Generative AI is driving massive increases in data center energy consumption. Our goal is to **raise awareness** and **encourage environmentally responsible behavior** by:

- Calculating energy usage per AI interaction.
- Displaying relatable equivalents.
- Using a **virtual pet**—the AI Energy Buddy—to visualize your daily impact in a fun, engaging way.

---

## 🔧 Key Features

- **Real-Time LLM Energy Calculator**: Tracks token usage and estimates energy consumption based on model parameters.
- **Virtual Pet Integration**: Your AI Energy Buddy responds to your usage—keep it healthy by being mindful!
- **Data Visualizations**: See your cumulative impact in watt-hours and household activity equivalents.

---

## 📊 Methodology

- **Energy Calculation**: 
  - Linear regression model trained on Hugging Face’s LLM Leaderboard data to predict energy per token.
  - Estimates GPU count based on model memory needs.
  - Adds embodied impacts via BoaviztAPI for hardware lifecycle considerations.
  
- **Browser Extension**: 
  - Built with JavaScript.
  - Parses chatbot pages, counts output tokens, detects model type, and injects visual feedback into the UI.

---

## ⚡ Limitations

- Currently excludes training energy impacts.
- Relies on estimated model parameters due to limited public data.
- Water consumption tracking is under development.
- Future LLM architectures (e.g., multi-model routing) may complicate tracking accuracy.

---

## 📅 Roadmap

- [x] Research & Design Phase
- [x] Backend Calculation Model
- [ ] Chrome Extension Development (In Progress)
- [ ] User Testing
- [ ] Different LLM Models
- [ ] Energy Mix & Water Usage Features

## 📚 References

- [Hugging Face Ecologits Calculator](https://huggingface.co/spaces/genai-impact/ecologits-calculator)
- Bashir, Noman, et al. *The Climate and Sustainability Implications of Generative AI.* [An MIT Exploration of Generative AI, 2024](https://mit-genai.pubpub.org/pub/8ulgrckc/release/2)
- O'Brien, Matt, et al. *AI Tools Fueled a 34% Spike in Microsoft’s Water Consumption.* [Fortune, 2023](https://fortune.com/2023/09/09/ai-chatgpt-usage-fuels-spike-in-microsoft-water-consumption/)
- [Silicon Valley Power Appliance Energy Use Chart](https://www.siliconvalleypower.com/residents/save-energy/appliance-energy-use-chart)
