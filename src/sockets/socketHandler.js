const gameService = require('../services/GameService');

function registerSocketHandlers(io) {
  gameService.setEmitter((state) => io.emit('state-update', state));
  gameService.setAllEmitter((event, data) => io.emit(event, data));

  io.on('connection', async (socket) => {
    try {
      const state = await gameService.buildState();
      socket.emit('state-update', state);
    } catch (error) {
      socket.emit('error-msg', error.message);
    }

    // Restore session from stored token (page refresh / power cut recovery)
    socket.on('reconnect-session', async (token) => {
      try {
        const restored = await gameService.reconnectSession(socket.id, token);
        if (restored) {
          socket.emit('session-restored', restored);
          const state = await gameService.buildState();
          socket.emit('state-update', state);
        } else {
          socket.emit('session-not-found');
        }
      } catch (error) {
        socket.emit('error-msg', error.message);
      }
    });

    // Register new manager (or re-register if token matches)
    socket.on('register-manager', async (name, token) => {
      try {
        const result = await gameService.registerManager(socket.id, name, token);
        socket.emit('register-success', result);
      } catch (error) {
        socket.emit('error-msg', error.message);
      }
    });

    // Upload Excel player data (admin only — persists to DB)
    socket.on('upload-players', async (players) => {
      try {
        await gameService.uploadPlayers(socket.id, players);
        socket.emit('upload-success', { count: players.length });
      } catch (error) {
        socket.emit('error-msg', error.message);
      }
    });

    // Launch auction with config only (players already in DB)
    socket.on('admin-init-game', async (config) => {
      try {
        await gameService.initGame(socket.id, config);
      } catch (error) {
        socket.emit('error-msg', error.message);
      }
    });

    socket.on('draw-player', async (role) => {
      try {
        await gameService.drawPlayer(socket.id, role);
      } catch (error) {
        socket.emit('error-msg', error.message);
      }
    });

    socket.on('place-bid', async () => {
      try {
        await gameService.placeBid(socket.id);
      } catch (error) {
        socket.emit('error-msg', error.message);
      }
    });

    socket.on('admin-force-hammer', async () => {
      try {
        await gameService.forceHammer();
      } catch (error) {
        socket.emit('error-msg', error.message);
      }
    });

    socket.on('admin-trigger-rebid', async () => {
      try {
        await gameService.triggerRebid();
      } catch (error) {
        socket.emit('error-msg', error.message);
      }
    });

    socket.on('use-super-power', async (playerName) => {
      try {
        await gameService.useSuperPower(socket.id, playerName);
      } catch (error) {
        socket.emit('error-msg', error.message);
      }
    });

    socket.on('admin-end-phase1', async () => {
      try {
        await gameService.endPhase1(socket.id);
      } catch (error) {
        socket.emit('error-msg', error.message);
      }
    });

    socket.on('admin-phase2-decision', async (agreed) => {
      try {
        await gameService.phase2Decision(socket.id, agreed);
      } catch (error) {
        socket.emit('error-msg', error.message);
      }
    });

    // Grant admin role to another manager
    socket.on('grant-admin', async (targetManagerId) => {
      try {
        await gameService.grantAdmin(socket.id, targetManagerId);
      } catch (error) {
        socket.emit('error-msg', error.message);
      }
    });

    socket.on('admin-restart-game', async () => {
      try {
        await gameService.restartGame();
      } catch (error) {
        socket.emit('error-msg', error.message);
      }
    });

    socket.on('disconnect', () => {
      gameService.removeSocket(socket.id);
    });
  });
}

module.exports = { registerSocketHandlers };
