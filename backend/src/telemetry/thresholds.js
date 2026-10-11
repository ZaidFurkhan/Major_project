// These threshold values exist so that the simulator produces distinguishable
// scenarios. They are placeholder assumptions and must be replaced by
// calibration data from the actual motor under test before any real diagnosis.

export const PLACEHOLDER_THRESHOLDS = Object.freeze({
  // Baseline operating temperature (placeholder assumption, not a calibrated motor limit)
  baselineTemperatureC: 45,

  // Temperature at which the overheating scenario caps (placeholder assumption)
  overheatTemperatureC: 120,

  // Rate of temperature rise per reading in the overheating scenario, in °C (placeholder assumption)
  overheatRiseRateC: 1.5,

  // Baseline vibration RMS in g (placeholder assumption, not a calibrated motor limit)
  baselineVibrationRmsG: 0.5,

  // Elevated vibration RMS for the vibration_anomaly scenario (placeholder assumption)
  anomalyVibrationRmsG: 2.5,

  // Baseline motor current in amperes (placeholder assumption, not a calibrated motor limit)
  baselineCurrentA: 5.0,

  // Elevated current for the abnormal_load scenario (placeholder assumption)
  abnormalLoadCurrentA: 9.0,

  // Baseline RPM (placeholder assumption, not a calibrated motor limit)
  baselineRpm: 1500,

  // Commanded RPM used across scenarios (placeholder assumption)
  commandedRpm: 1500,

  // RPM drop under abnormal load (placeholder assumption)
  abnormalLoadRpm: 1200,

  // RPM deviation in the rpm_anomaly scenario (placeholder assumption)
  rpmAnomalyOffset: 300,
});
