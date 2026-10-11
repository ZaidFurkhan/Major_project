import { createSimulator } from './simulator.js';

/**
 * Generate a window of telemetry readings for a given scenario.
 * Convenience wrapper around createSimulator for tests and fixtures.
 */
export function generateScenarioWindow({ machineId, scenario, seed, count }) {
  const sim = createSimulator({ machineId, scenario, seed });
  const readings = [];
  for (let i = 0; i < count; i++) {
    readings.push(sim.next());
  }
  return readings;
}
