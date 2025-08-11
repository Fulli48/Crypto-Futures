import type { Express } from 'express';
import { createServer } from 'http';

export async function registerMinimalRoutes(app: Express) {
  // Minimal routes for local development when heavy services are disabled.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/version', (_req, res) => {
    res.json({ version: 'local-dev', timestamp: new Date().toISOString() });
  });

  // Create a lightweight server object compatible with the Vite middleware setup
  const server = createServer(app as any);
  return server;
}

