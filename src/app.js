const express = require('express');
const cors = require('cors');
const routes = require('./routes');

// Reflects the exact request origin back (avoids trailing-slash mismatches)
// and allows all origins when CLIENT_URL is not set or is '*'.
function makeOriginHandler() {
  const allowed = (process.env.CLIENT_URL || '*').replace(/\/$/, '');
  return function (origin, callback) {
    if (allowed === '*' || !origin) return callback(null, true);
    const normalised = origin.replace(/\/$/, '');
    if (normalised === allowed) return callback(null, true);
    callback(new Error(`CORS: origin "${origin}" not allowed`));
  };
}

function createApp() {
  const app = express();

  app.use(cors({ origin: makeOriginHandler() }));
  app.use(express.json({ limit: '10mb' }));
  app.use('/api', routes);

  return app;
}

module.exports = createApp;
