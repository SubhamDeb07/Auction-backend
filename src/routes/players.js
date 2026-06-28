const multer = require('multer');
const express = require('express');
const https = require('https');
const http = require('http');
const PlayerImageModel = require('../models/PlayerImageModel');
const gameService = require('../services/GameService');

// Fetch a remote URL and return { buffer, mimeType }
function fetchRemoteImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Remote server returned ${res.statusCode}`));
      }
      const mimeType = res.headers['content-type'] || '';
      if (!mimeType.startsWith('image/')) {
        return reject(new Error(
          'That URL is a webpage, not a direct image link.\n\n' +
          'How to fix: Right-click the image on the page → "Open Image in New Tab" → copy that URL and paste it here.'
        ));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), mimeType }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

const router = express.Router();

// Store images in memory (we'll write straight to DB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'));
    }
    cb(null, true);
  },
});

// POST /api/players/:id/image — upload image for a player (admin only)
router.post('/:id/image', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const socketId = req.headers['x-socket-id'];

    if (!gameService.isAdmin(socketId)) {
      return res.status(403).json({ success: false, message: 'Only admins can upload player images.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided.' });
    }

    await PlayerImageModel.saveImage(Number(id), req.file.buffer, req.file.mimetype);

    // Broadcast updated state so everyone gets the image URL refreshed
    await gameService.broadcastState();

    res.json({ success: true, playerId: id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/players/:id/image — serve the stored image
router.get('/:id/image', async (req, res) => {
  try {
    const { id } = req.params;
    const row = await PlayerImageModel.getImage(Number(id));

    if (!row || !row.image) {
      return res.status(404).json({ success: false, message: 'No image found.' });
    }

    res.set('Content-Type', (row.image_mime || 'image/jpeg').split(';')[0].trim());
    res.set('Cache-Control', 'no-store');
    res.send(row.image);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/players/:id/image-url — save image from any external URL (admin only)
router.post('/:id/image-url', async (req, res) => {
  try {
    const { id } = req.params;
    const socketId = req.headers['x-socket-id'];
    const { url } = req.body;

    if (!gameService.isAdmin(socketId)) {
      return res.status(403).json({ success: false, message: 'Only admins can set player images.' });
    }

    if (!url || !url.startsWith('http')) {
      return res.status(400).json({ success: false, message: 'A valid http/https URL is required.' });
    }

    const { buffer, mimeType } = await fetchRemoteImage(url);
    await PlayerImageModel.saveImage(Number(id), buffer, mimeType);
    await gameService.broadcastState();

    res.json({ success: true, playerId: id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/players/:id/image — remove image (admin only)
router.delete('/:id/image', async (req, res) => {
  try {
    const { id } = req.params;
    const socketId = req.headers['x-socket-id'];

    if (!gameService.isAdmin(socketId)) {
      return res.status(403).json({ success: false, message: 'Only admins can delete player images.' });
    }

    await PlayerImageModel.deleteImage(Number(id));
    await gameService.broadcastState();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
