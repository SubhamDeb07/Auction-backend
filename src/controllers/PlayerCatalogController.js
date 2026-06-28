const PlayerCatalogModel = require('../models/PlayerCatalogModel');
const { parseExcelBuffer } = require('../utils/excelParser');

class PlayerCatalogController {
  /**
   * POST /api/players/upload
   * Accepts multipart/form-data with:
   *   - file: Excel file (.xlsx / .xls / .csv)
   *   - minRating_GK, minRating_DF, minRating_CM, minRating_ST (optional, default 0 = no filter)
   */
  static async upload(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded. Send the Excel file as "file" field.' });
      }

      const minRatings = {
        GK: parseInt(req.body.minRating_GK || 0, 10),
        DF: parseInt(req.body.minRating_DF || 0, 10),
        CM: parseInt(req.body.minRating_CM || 0, 10),
        ST: parseInt(req.body.minRating_ST || 0, 10),
      };

      const players = await parseExcelBuffer(req.file.buffer, minRatings);

      if (players.length === 0) {
        return res.status(422).json({
          success: false,
          message: 'No players matched the minimum rating filters in the uploaded file.',
        });
      }

      const result = await PlayerCatalogModel.upsertMany(players);
      const counts = await PlayerCatalogModel.count();

      return res.status(200).json({
        success: true,
        message: `Catalog updated: ${result.inserted} inserted, ${result.updated} updated.`,
        summary: { ...result, byRole: counts },
      });
    } catch (error) {
      console.error('Player upload error:', error.message);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/players
   * Query params: roleGroup, minRating
   */
  static async list(req, res) {
    try {
      const { roleGroup, minRating } = req.query;
      const players = await PlayerCatalogModel.findAll({
        roleGroup: roleGroup || null,
        minRating: minRating ? parseInt(minRating, 10) : null,
      });

      return res.status(200).json({ success: true, total: players.length, data: players });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/players/count
   * Returns player count grouped by role
   */
  static async count(req, res) {
    try {
      const counts = await PlayerCatalogModel.count();
      return res.status(200).json({ success: true, data: counts });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * DELETE /api/players
   * Wipes the entire player catalog
   */
  static async clear(req, res) {
    try {
      await PlayerCatalogModel.clearAll();
      return res.status(200).json({ success: true, message: 'Player catalog cleared.' });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = PlayerCatalogController;
