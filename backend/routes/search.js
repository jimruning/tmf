const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');

router.get('/', authMiddleware, (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '请输入搜索关键词' }
      });
    }

    const searchQuery = `%${q.trim()}%`;
    const files = db.prepare(`
      SELECT f.*, u.username as uploader_name, fo.zone, fo.section, fo.artifact
      FROM files f
      LEFT JOIN users u ON f.uploaded_by = u.id
      LEFT JOIN folders fo ON f.folder_id = fo.id
      WHERE f.is_deleted = 0
        AND (f.original_name LIKE ? OR f.description LIKE ? OR f.version LIKE ?)
      ORDER BY f.uploaded_at DESC
      LIMIT 50
    `).all(searchQuery, searchQuery, searchQuery);

    res.json({ success: true, data: files, total: files.length });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '搜索失败' }
    });
  }
});

module.exports = router;
