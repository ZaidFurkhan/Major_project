import express from 'express';

export function createApp() {
  const app = express();

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'backend' });
  });

  return app;
}
