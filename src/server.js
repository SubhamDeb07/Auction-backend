require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const createApp = require('./app');
const { initDatabase } = require('./scripts/initDb');
const gameService = require('./services/GameService');
const { registerSocketHandlers } = require('./sockets/socketHandler');

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  await initDatabase();
  await gameService.initialize();

  const app = createApp();
  const server = http.createServer(app);

  const allowedOrigin = (process.env.CLIENT_URL || '*').replace(/\/$/, '');
  const io = new Server(server, {
    cors: {
      origin: allowedOrigin === '*'
        ? '*'
        : (origin, cb) => {
            const norm = (origin || '').replace(/\/$/, '');
            norm === allowedOrigin ? cb(null, true) : cb(new Error(`CORS: blocked ${origin}`));
          },
      methods: ['GET', 'POST'],
    },
  });

  registerSocketHandlers(io);

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the other process first:`);
      console.error(`  lsof -i :${PORT}`);
      console.error(`  kill <PID>`);
      process.exit(1);
    }
    throw error;
  });

  server.listen(PORT, () => {
    console.log(`🔥 Auction backend running on port ${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
