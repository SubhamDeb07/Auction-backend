const { query } = require('../config/database');

class PlayerModel {
  static async bulkInsert(sessionId, players, poolType = 'main') {
    const inserted = [];

    for (const player of players) {
      const created = await query(
        `INSERT INTO players (
          session_id, name, rating, position, role_group, alt_positions, playstyles,
          pac, sho, pas, dri, def, phy, pool_type, status, player_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          player.Name,
          player.Rating,
          player.Position,
          player.RoleGroup,
          JSON.stringify(player.AltPositions || []),
          JSON.stringify(player.Playstyles || []),
          player.Pac || 75,
          player.Sho || 75,
          player.Pas || 75,
          player.Dri || 75,
          player.Def || 75,
          player.Phy || 75,
          poolType,
          player.status || null,
          JSON.stringify(player),
        ]
      );

      const row = await query('SELECT * FROM players WHERE id = ?', [created.insertId]);
      inserted.push(row.rows[0]);
    }

    return inserted;
  }

  static async findBySession(sessionId, poolType = null) {
    const params = [sessionId];
    let sql = 'SELECT * FROM players WHERE session_id = ?';

    if (poolType) {
      sql += ' AND pool_type = ?';
      params.push(poolType);
    }

    sql += ' ORDER BY id ASC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async findById(playerId) {
    const result = await query('SELECT * FROM players WHERE id = ?', [playerId]);
    return result.rows[0] || null;
  }

  static async update(playerId, fields) {
    const keys = Object.keys(fields);
    const values = Object.values(fields);
    const setClause = keys.map((key) => `${key} = ?`).join(', ');

    await query(
      `UPDATE players SET ${setClause} WHERE id = ?`,
      [...values, playerId]
    );

    const result = await query('SELECT * FROM players WHERE id = ?', [playerId]);
    return result.rows[0];
  }

  static async deleteBySession(sessionId) {
    await query('DELETE FROM players WHERE session_id = ?', [sessionId]);
  }

  static async moveToUnsold(playerId) {
    return PlayerModel.update(playerId, { pool_type: 'unsold', status: null });
  }

  static async clearMainPool(sessionId) {
    await query("DELETE FROM players WHERE session_id = ? AND pool_type = 'main'", [sessionId]);
  }

  static async resetUnsoldStatuses(sessionId) {
    await query(
      "UPDATE players SET status = NULL WHERE session_id = ? AND pool_type = 'unsold'",
      [sessionId]
    );
  }

  static async resetMainPoolStatuses(sessionId) {
    await query(
      "UPDATE players SET status = NULL WHERE session_id = ? AND pool_type = 'main'",
      [sessionId]
    );
  }
}

module.exports = PlayerModel;
