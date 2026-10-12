import { Router } from 'express';
import { getLatestTelemetryReading } from '../db/telemetryReadings.js';
import { isStale, ageMs } from '../realtime/staleness.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function telemetryRoutes({ pool }) {
  const router = Router();

  const handleGetLatest = async (req, res) => {
    const { machineId } = req.params;

    if (!UUID_REGEX.test(machineId)) {
      return res.status(400).json({ error: 'invalid machine id' });
    }

    try {
      const reading = await getLatestTelemetryReading(pool, machineId);
      if (!reading) {
        return res.status(404).json({ error: 'no telemetry for machine' });
      }

      return res.status(200).json({
        reading,
        ageMs: ageMs(reading.timestamp),
        stale: isStale(reading.timestamp),
      });
    } catch (err) {
      console.error(`Telemetry route error: ${err.name} ${err.code ?? ''}`);
      return res.status(500).json({ error: 'internal error' });
    }
  };

  router.get('/api/telemetry/:machineId/latest', handleGetLatest);
  router.get('/:machineId/latest', handleGetLatest);

  return router;
}
