const express = require('express');
const cors = require('cors');
const routes = require('./routes');

function createApp() {
  const app = express();

  app.use(cors({
    origin: process.env.CLIENT_URL || '*',
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use('/api', routes);

  return app;
}

module.exports = createApp;
