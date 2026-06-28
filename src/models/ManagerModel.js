const { query } = require('../config/database');

class ManagerModel {
  static async findBySession(sessionId) {
    const result = await query(
      'SELECT * FROM managers WHERE session_id = ? ORDER BY id ASC',
      [sessionId]
    );
    return result.rows;
  }

  static async findBySocketId(sessionId, socketId) {
    const result = await query(
      'SELECT * FROM managers WHERE session_id = ? AND socket_id = ?',
      [sessionId, socketId]
    );
    return result.rows[0] || null;
  }

  static async findByToken(sessionId, token) {
    if (!token) return null;
    const result = await query(
      'SELECT * FROM managers WHERE session_id = ? AND client_token = ?',
      [sessionId, token]
    );
    return result.rows[0] || null;
  }

  static async findByName(sessionId, name) {
    const result = await query(
      'SELECT * FROM managers WHERE session_id = ? AND LOWER(name) = LOWER(?)',
      [sessionId, name]
    );
    return result.rows[0] || null;
  }

  static async countAdmins(sessionId) {
    const result = await query(
      "SELECT COUNT(*) AS cnt FROM managers WHERE session_id = ? AND role = 'admin'",
      [sessionId]
    );
    return result.rows[0].cnt;
  }

  static async create({ sessionId, socketId, clientToken, name, budget, color, role, hasSuperPower }) {
    const created = await query(
      `INSERT INTO managers (session_id, socket_id, client_token, name, budget, color, role, has_super_power)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, socketId, clientToken || null, name, budget, color, role || 'manager', hasSuperPower ? 1 : 0]
    );

    const result = await query('SELECT * FROM managers WHERE id = ?', [created.insertId]);
    return result.rows[0];
  }

  static async update(managerId, fields) {
    const keys = Object.keys(fields);
    const values = Object.values(fields);
    const setClause = keys.map((key) => `${key} = ?`).join(', ');

    await query(
      `UPDATE managers SET ${setClause} WHERE id = ?`,
      [...values, managerId]
    );

    const result = await query('SELECT * FROM managers WHERE id = ?', [managerId]);
    return result.rows[0];
  }

  static async getSquad(managerId) {
    const result = await query(
      `SELECT sp.final_price, p.*
       FROM squad_players sp
       JOIN players p ON p.id = sp.player_id
       WHERE sp.manager_id = ?
       ORDER BY sp.id ASC`,
      [managerId]
    );
    return result.rows;
  }

  static async addSquadPlayer(managerId, playerId, finalPrice) {
    await query(
      'INSERT INTO squad_players (manager_id, player_id, final_price) VALUES (?, ?, ?)',
      [managerId, playerId, finalPrice]
    );
  }

  static async removeSquadPlayer(managerId, playerId) {
    await query(
      'DELETE FROM squad_players WHERE manager_id = ? AND player_id = ?',
      [managerId, playerId]
    );
  }

  static async clearSquadsForSession(sessionId) {
    await query(
      `DELETE FROM squad_players
       WHERE manager_id IN (SELECT id FROM managers WHERE session_id = ?)`,
      [sessionId]
    );
  }
}

module.exports = ManagerModel;
