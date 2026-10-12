import WebSocket, { WebSocketServer } from 'ws';

export function createTelemetryBroadcaster() {
  const wss = new WebSocketServer({ noServer: true });
  let attachedHttpServer = null;
  let upgradeHandler = null;

  wss.on('connection', (ws) => {
    ws.on('error', () => {
      // Ignore client socket errors
    });

    // Ignore incoming client messages
    ws.on('message', () => {});

    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(
          JSON.stringify({
            type: 'hello',
            serverTime: new Date().toISOString(),
          })
        );
      } catch {
        // Ignore send errors
      }
    }
  });

  return {
    attach(httpServer, path = '/ws/telemetry') {
      attachedHttpServer = httpServer;
      upgradeHandler = (request, socket, head) => {
        let pathname;
        try {
          pathname = new URL(request.url, 'http://127.0.0.1').pathname;
        } catch {
          socket.destroy();
          return;
        }

        if (pathname === path) {
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
          });
        } else if (httpServer.listenerCount('upgrade') <= 1) {
          socket.destroy();
        }
      };

      httpServer.on('upgrade', upgradeHandler);
      return this;
    },

    publish(result) {
      try {
        if (!result || result.status !== 'stored') {
          return;
        }

        const rawReading = result.reading;
        if (!rawReading) {
          return;
        }

        const reading = { ...rawReading };
        if (result.id !== undefined && reading.id === undefined) {
          reading.id = result.id;
        }

        const message = JSON.stringify({ type: 'telemetry', reading });

        for (const client of wss.clients) {
          if (client.readyState === WebSocket.OPEN) {
            try {
              client.send(message);
            } catch {
              // Failed send to one client must not stop others
            }
          }
        }
      } catch {
        // Never throws
      }
    },

    clientCount() {
      let count = 0;
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          count++;
        }
      }
      return count;
    },

    async close() {
      if (upgradeHandler && attachedHttpServer) {
        attachedHttpServer.removeListener('upgrade', upgradeHandler);
      }

      for (const client of wss.clients) {
        try {
          client.terminate();
        } catch {
          // Ignore client close errors
        }
      }

      await new Promise((resolve) => {
        wss.close(() => resolve());
      });
    },
  };
}
