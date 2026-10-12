export const CANDIDATE_RULES = Object.freeze({
  vibration_elevated: Object.freeze([
    Object.freeze({
      id: 'rotor_imbalance_candidate',
      label: 'Rotating-part imbalance is one possible cause of elevated vibration.',
      supportedBy: Object.freeze(['vibration_elevated']),
      contradictedBy: Object.freeze([]),
      checkNext:
        'Compare vibration at several speeds and check for added or lost mass on the rotor.',
    }),
    Object.freeze({
      id: 'mounting_looseness_candidate',
      label: 'Loose or misaligned mounting is one possible cause of elevated vibration.',
      supportedBy: Object.freeze(['vibration_elevated']),
      contradictedBy: Object.freeze([]),
      checkNext: 'Check fasteners and alignment of the motor and its base.',
    }),
    Object.freeze({
      id: 'bearing_wear_candidate',
      label: 'Bearing wear is one possible cause of elevated vibration.',
      supportedBy: Object.freeze(['vibration_elevated']),
      contradictedBy: Object.freeze([]),
      checkNext: 'Inspect bearings for play, noise, and lubrication condition.',
    }),
  ]),
  overheating: Object.freeze([
    Object.freeze({
      id: 'cooling_restriction_candidate',
      label: 'Restricted airflow or cooling is one possible cause of rising temperature.',
      supportedBy: Object.freeze(['overheating']),
      contradictedBy: Object.freeze([]),
      checkNext: 'Check air vents and cooling surfaces for obstruction and dust.',
    }),
    Object.freeze({
      id: 'friction_candidate',
      label: 'Added mechanical friction is one possible cause of rising temperature.',
      supportedBy: Object.freeze(['overheating']),
      contradictedBy: Object.freeze([
        Object.freeze({
          signature: 'abnormal_load',
          reason: 'no load increase was detected alongside the temperature rise',
        }),
      ]),
      checkNext: 'Check whether the shaft turns freely by hand with power off.',
    }),
    Object.freeze({
      id: 'load_increase_candidate',
      label: 'A higher mechanical load is one possible cause of rising temperature.',
      supportedBy: Object.freeze(['overheating']),
      contradictedBy: Object.freeze([
        Object.freeze({
          signature: 'abnormal_load',
          reason: 'no current or speed change was detected alongside the temperature rise',
        }),
      ]),
      checkNext: 'Compare the driven load against its normal operating value.',
    }),
  ]),
  abnormal_load: Object.freeze([
    Object.freeze({
      id: 'shaft_load_candidate',
      label:
        'Increased load on the driven equipment is one possible cause of higher current and lower speed.',
      supportedBy: Object.freeze(['abnormal_load']),
      contradictedBy: Object.freeze([]),
      checkNext:
        'Check the driven equipment for added resistance or product build-up.',
    }),
    Object.freeze({
      id: 'mechanical_binding_candidate',
      label:
        'Binding or an obstruction in the moving parts is one possible cause of higher current and lower speed.',
      supportedBy: Object.freeze(['abnormal_load']),
      contradictedBy: Object.freeze([]),
      checkNext:
        'Check the moving parts for rubbing, debris, or seizure with power off.',
    }),
    Object.freeze({
      id: 'supply_voltage_candidate',
      label:
        'A low supply voltage is one possible cause of higher current and lower speed.',
      supportedBy: Object.freeze(['abnormal_load']),
      contradictedBy: Object.freeze([]),
      checkNext: 'Measure the supply voltage at the motor terminals under load.',
    }),
  ]),
  rpm_deviation: Object.freeze([
    Object.freeze({
      id: 'speed_control_candidate',
      label:
        'A speed controller or drive setting is one possible cause of speed differing from the command.',
      supportedBy: Object.freeze(['rpm_deviation']),
      contradictedBy: Object.freeze([]),
      checkNext:
        'Compare the controller setpoint and output against the measured speed.',
    }),
    Object.freeze({
      id: 'measurement_candidate',
      label:
        'A speed measurement problem is one possible cause of the apparent speed difference.',
      supportedBy: Object.freeze(['rpm_deviation']),
      contradictedBy: Object.freeze([]),
      checkNext:
        'Verify the speed sensor alignment and signal against a handheld tachometer.',
    }),
    Object.freeze({
      id: 'slip_candidate',
      label: 'Load-induced slip is one possible cause of speed falling below the command.',
      supportedBy: Object.freeze(['rpm_deviation']),
      contradictedBy: Object.freeze([
        Object.freeze({
          signature: 'abnormal_load',
          reason: 'no load increase was detected',
        }),
      ]),
      checkNext: 'Compare speed under no load and under the normal load.',
    }),
  ]),
});
