/* eslint-env jest */
/** @jest-environment jsdom */
import { ensureBadgeExists, updateBadge } from '../src/scripts/content';

describe('ensureBadgeExists', () => {
  beforeEach(() => {
    // Reset DOM before each test
    document.body.innerHTML = '';
  });

  test('returns false when no container exists', () => {
    expect(ensureBadgeExists()).toBe(false);
    expect(document.getElementById('chattometer-impact-badge')).toBeNull();
  });

  test('creates badge when container exists', () => {
    const container = document.createElement('div');
    container.id = 'thread-bottom-container';
    document.body.appendChild(container);
    expect(ensureBadgeExists()).toBe(true);
    const badge = document.getElementById('chattometer-impact-badge');
    expect(badge).not.toBeNull();
    expect(badge.id).toBe('chattometer-impact-badge');
    // Badge should be a child before the container
    expect(container.previousElementSibling).toBe(badge);
  });
});

describe('updateBadge', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="chattometer-impact-badge"></div>';
  });

  test('sets innerHTML for valid impactData', () => {
    const data = {
      impacts: {
        energy_kWh: { min: 0.001, max: 0.003 },
        gwp_kgCO2eq: { min: 0.002, max: 0.004 }
      }
    };
    updateBadge(data);
    const badge = document.getElementById('chattometer-impact-badge');
    expect(badge.innerHTML).toMatch(/Energy: \d+\.\d Wh/);
    expect(badge.innerHTML).toMatch(/GHG: \d+\.\d gCO2eq/);
  });

  test('sets textContent to unavailable for invalid data', () => {
    updateBadge({});
    const badge = document.getElementById('chattometer-impact-badge');
    expect(badge.textContent).toBe('Impact data unavailable');
  });
});