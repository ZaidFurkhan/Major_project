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
