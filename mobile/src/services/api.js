import { BACKEND_BASE_URL } from '../config';

// Maximum duration in milliseconds to wait for a health check response.
const HEALTH_TIMEOUT_MS = 5000;

export async function fetchHealth() {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/health`, {
      signal: controller.signal,
    });

    if (response.status !== 200) {
      return {
        ok: false,
        error: `Unexpected HTTP status: ${response.status}`,
      };
    }

    try {
      const body = await response.json();
      return { ok: true, body };
    } catch {
      return {
        ok: false,
        error: 'Failed to parse JSON response',
      };
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return {
        ok: false,
        error: `Request timed out after ${HEALTH_TIMEOUT_MS} ms`,
      };
    }
    return {
      ok: false,
      error: err.message || 'Network request failed',
    };
  } finally {
    clearTimeout(timer);
  }
}

// Maximum duration in milliseconds to wait for a telemetry response.
const TELEMETRY_TIMEOUT_MS = 5000;

export async function fetchLatestTelemetry(machineId, signal) {
  const controller = new AbortController();
  const onAbort = () => {
    controller.abort();
  };

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', onAbort);
    }
  }

  const timer = setTimeout(() => {
    controller.abort();
  }, TELEMETRY_TIMEOUT_MS);

  try {
    const url = `${BACKEND_BASE_URL}/api/telemetry/${encodeURIComponent(machineId)}/latest`;
    const response = await fetch(url, {
      signal: controller.signal,
    });

    if (response.status === 200) {
      try {
        const data = await response.json();
        return { ok: true, data };
      } catch {
        return {
          ok: false,
          reason: 'network',
          error: 'Failed to parse JSON response',
        };
      }
    }

    if (response.status === 404) {
      return { ok: false, reason: 'no_telemetry' };
    }

    return {
      ok: false,
      reason: 'network',
      error: `Unexpected HTTP status: ${response.status}`,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      if (signal?.aborted) {
        return {
          ok: false,
          reason: 'network',
          error: 'Request aborted',
        };
      }
      return {
        ok: false,
        reason: 'network',
        error: `Request timed out after ${TELEMETRY_TIMEOUT_MS} ms`,
      };
    }
    return {
      ok: false,
      reason: 'network',
      error: err.message || 'Network request failed',
    };
  } finally {
    clearTimeout(timer);
    if (signal && signal.removeEventListener) {
      signal.removeEventListener('abort', onAbort);
    }
  }
}

// Maximum duration in milliseconds to wait for a case report response.
const CASE_REPORT_TIMEOUT_MS = 5000;

export async function fetchCaseReport(caseId, signal) {
  const controller = new AbortController();
  const onAbort = () => {
    controller.abort();
  };

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', onAbort);
    }
  }

  const timer = setTimeout(() => {
    controller.abort();
  }, CASE_REPORT_TIMEOUT_MS);

  try {
    const url = `${BACKEND_BASE_URL}/api/cases/${encodeURIComponent(caseId)}/report`;
    const response = await fetch(url, {
      signal: controller.signal,
    });

    if (response.status === 200) {
      try {
        const data = await response.json();
        return { ok: true, data };
      } catch {
        return {
          ok: false,
          reason: 'network',
          error: 'Failed to parse JSON response',
        };
      }
    }

    if (response.status === 404) {
      return { ok: false, reason: 'not_found' };
    }

    if (response.status === 400) {
      return { ok: false, reason: 'invalid_id' };
    }

    return {
      ok: false,
      reason: 'network',
      error: `Unexpected HTTP status: ${response.status}`,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      if (signal?.aborted) {
        return {
          ok: false,
          reason: 'network',
          error: 'Request aborted',
        };
      }
      return {
        ok: false,
        reason: 'network',
        error: `Request timed out after ${CASE_REPORT_TIMEOUT_MS} ms`,
      };
    }
    return {
      ok: false,
      reason: 'network',
      error: err.message || 'Network request failed',
    };
  } finally {
    clearTimeout(timer);
    if (signal && signal.removeEventListener) {
      signal.removeEventListener('abort', onAbort);
    }
  }
}

// Maximum duration in milliseconds to wait for a repair guide response.
const REPAIR_GUIDE_TIMEOUT_MS = 5000;

export async function fetchRepairGuide(faultSignature, signal) {
  const controller = new AbortController();
  const onAbort = () => {
    controller.abort();
  };

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', onAbort);
    }
  }

  const timer = setTimeout(() => {
    controller.abort();
  }, REPAIR_GUIDE_TIMEOUT_MS);

  try {
    const url = `${BACKEND_BASE_URL}/api/repair-guide/${encodeURIComponent(faultSignature)}`;
    const response = await fetch(url, {
      signal: controller.signal,
    });

    if (response.status === 200) {
      try {
        const data = await response.json();
        return { ok: true, data };
      } catch {
        return {
          ok: false,
          reason: 'network',
          error: 'Failed to parse JSON response',
        };
      }
    }

    if (response.status === 404) {
      return { ok: false, reason: 'no_approved_procedure' };
    }

    if (response.status === 400) {
      return { ok: false, reason: 'invalid_signature' };
    }

    return {
      ok: false,
      reason: 'network',
      error: `Unexpected HTTP status: ${response.status}`,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      if (signal?.aborted) {
        return {
          ok: false,
          reason: 'network',
          error: 'Request aborted',
        };
      }
      return {
        ok: false,
        reason: 'network',
        error: `Request timed out after ${REPAIR_GUIDE_TIMEOUT_MS} ms`,
      };
    }
    return {
      ok: false,
      reason: 'network',
      error: err.message || 'Network request failed',
    };
  } finally {
    clearTimeout(timer);
    if (signal && signal.removeEventListener) {
      signal.removeEventListener('abort', onAbort);
    }
  }
}

