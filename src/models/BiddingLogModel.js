const { query } = require('../config/database');

class BiddingLogModel {
  static async findBySession(sessionId) {
    const result = await query(
      'SELECT log_text AS text, color FROM bidding_logs WHERE session_id = ? ORDER BY id ASC',
      [sessionId]
    );
    return result.rows;
  }

  static async add(sessionId, text, color = '#FFFFFF') {
    await query(
      'INSERT INTO bidding_logs (session_id, log_text, color) VALUES (?, ?, ?)',
      [sessionId, text, color]
    );
  }

  static async clear(sessionId) {
    await query('DELETE FROM bidding_logs WHERE session_id = ?', [sessionId]);
  }

  static async replaceAll(sessionId, logs) {
    await BiddingLogModel.clear(sessionId);
    for (const log of logs) {
      await BiddingLogModel.add(sessionId, log.text, log.color);
    }
  }
}

module.exports = BiddingLogModel;
