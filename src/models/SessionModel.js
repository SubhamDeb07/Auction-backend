const { query } = require('../config/database');
const { DEFAULT_CONFIG } = require('../utils/constants');

class SessionModel {
  static async getOrCreateActiveSession() {
    const existing = await query(
      'SELECT * FROM auction_sessions WHERE is_active = 1 ORDER BY id DESC LIMIT 1'
    );

    if (existing.rows[0]) {
      return existing.rows[0];
    }

    const created = await query(
      'INSERT INTO auction_sessions (phase, config, players_uploaded) VALUES (?, ?, 0)',
      ['setup', JSON.stringify(DEFAULT_CONFIG)]
    );

    const session = await query(
      'SELECT * FROM auction_sessions WHERE id = ?',
      [created.insertId]
    );
    return session.rows[0];
  }

  static async updateSession(sessionId, fields) {
    const keys = Object.keys(fields);
    const values = Object.values(fields);
    const setClause = keys.map((key) => `${key} = ?`).join(', ');

    await query(
      `UPDATE auction_sessions SET ${setClause}, updated_at = NOW() WHERE id = ?`,
      [...values, sessionId]
    );

    const result = await query('SELECT * FROM auction_sessions WHERE id = ?', [sessionId]);
    return result.rows[0];
  }

  static async resetSession(sessionId) {
    // Clear game activity — keep players and their images intact
    await query('DELETE FROM bidding_logs WHERE session_id = ?', [sessionId]);
    await query(
      'DELETE FROM squad_players WHERE manager_id IN (SELECT id FROM managers WHERE session_id = ?)',
      [sessionId]
    );
    await query('DELETE FROM managers WHERE session_id = ?', [sessionId]);

    // Reset all player statuses so they're available to draw again
    await query(
      "UPDATE players SET status = NULL, pool_type = 'main' WHERE session_id = ?",
      [sessionId]
    );

    return SessionModel.updateSession(sessionId, {
      phase: 'setup',
      config: JSON.stringify(DEFAULT_CONFIG),
      current_player_id: null,
      current_bid: 0,
      highest_bidder_id: null,
      timer_value: 0,
      last_auction_action: null,
      players_uploaded: 1, // players are still there
    });
  }
}

module.exports = SessionModel;
