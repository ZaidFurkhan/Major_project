// Application-level freshness window, not a measured sensor property.
export const STALE_AFTER_MS = 5000;

// A simulated reading carries its own timestamp, so the staleness check
// compares the reading's timestamp with the current time.
export function ageMs(timestampIso, nowMs = Date.now()) {
  if (timestampIso == null || typeof timestampIso !== 'string') {
    return null;
  }

  const time = Date.parse(timestampIso);
  if (Number.isNaN(time)) {
    return null;
  }

  return nowMs - time;
}

export function isStale(
  timestampIso,
  nowMs = Date.now(),
  staleAfterMs = STALE_AFTER_MS
) {
  try {
    const age = ageMs(timestampIso, nowMs);
    if (age === null) {
      return true;
    }
    return age > staleAfterMs;
  } catch {
    return true;
  }
}
