import express from 'express';
import { telemetryRoutes } from './api/telemetry.routes.js';
import { repairGuideRoutes } from './api/repairGuide.routes.js';

export function createApp(options = {}) {
  const app = express();

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'backend' });
  });

  if (options && options.pool) {
    app.use(telemetryRoutes({ pool: options.pool }));
    app.use(repairGuideRoutes({ pool: options.pool }));
  }

  return app;
}
