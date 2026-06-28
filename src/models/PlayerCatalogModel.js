const { query } = require('../config/database');

class PlayerCatalogModel {
  static async upsertMany(players) {
    let inserted = 0;
    let updated = 0;

    for (const p of players) {
      const existing = await query('SELECT id FROM player_catalog WHERE name = ?', [p.Name]);

      if (existing.rows[0]) {
        await query(
          `UPDATE player_catalog SET
            rating = ?, position = ?, role_group = ?, alt_positions = ?, playstyles = ?,
            pac = ?, sho = ?, pas = ?, dri = ?, def = ?, phy = ?
           WHERE name = ?`,
          [
            p.Rating, p.Position, p.RoleGroup,
            JSON.stringify(p.AltPositions || []),
            JSON.stringify(p.Playstyles || []),
            p.Pac || 75, p.Sho || 75, p.Pas || 75,
            p.Dri || 75, p.Def || 75, p.Phy || 75,
            p.Name,
          ]
        );
        updated++;
      } else {
        await query(
          `INSERT INTO player_catalog
            (name, rating, position, role_group, alt_positions, playstyles, pac, sho, pas, dri, def, phy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.Name, p.Rating, p.Position, p.RoleGroup,
            JSON.stringify(p.AltPositions || []),
            JSON.stringify(p.Playstyles || []),
            p.Pac || 75, p.Sho || 75, p.Pas || 75,
            p.Dri || 75, p.Def || 75, p.Phy || 75,
          ]
        );
        inserted++;
      }
    }

    return { inserted, updated, total: inserted + updated };
  }

  static async findAll({ roleGroup, minRating } = {}) {
    let sql = 'SELECT * FROM player_catalog WHERE 1=1';
    const params = [];

    if (roleGroup) {
      sql += ' AND role_group = ?';
      params.push(roleGroup);
    }

    if (minRating) {
      sql += ' AND rating >= ?';
      params.push(minRating);
    }

    sql += ' ORDER BY rating DESC, name ASC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async count() {
    const result = await query(
      'SELECT role_group, COUNT(*) as total FROM player_catalog GROUP BY role_group ORDER BY role_group'
    );
    return result.rows;
  }

  static async clearAll() {
    await query('DELETE FROM player_catalog');
  }
}

module.exports = PlayerCatalogModel;
