const gameService = require('../services/GameService');

class GameController {
  static async getState(req, res) {
    try {
      const state = await gameService.buildState();
      res.json({ success: true, data: state });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getHealth(req, res) {
    res.json({
      success: true,
      message: 'FC 26 Auction API is running',
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = GameController;
