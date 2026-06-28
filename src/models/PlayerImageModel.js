const { query } = require('../config/database');

class PlayerImageModel {
  static async saveImage(playerId, buffer, mimeType) {
    await query(
      'UPDATE players SET image = ?, image_mime = ? WHERE id = ?',
      [buffer, mimeType, playerId]
    );
  }

  static async getImage(playerId) {
    const result = await query(
      'SELECT image, image_mime FROM players WHERE id = ?',
      [playerId]
    );
    return result.rows[0] || null;
  }

  static async deleteImage(playerId) {
    await query(
      'UPDATE players SET image = NULL, image_mime = NULL WHERE id = ?',
      [playerId]
    );
  }
}

module.exports = PlayerImageModel;
