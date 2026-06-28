const express = require('express');
const GameController = require('../controllers/GameController');
const playersRouter = require('./players');

const router = express.Router();

router.get('/health', GameController.getHealth);
router.get('/state', GameController.getState);
router.use('/players', playersRouter);

module.exports = router;
