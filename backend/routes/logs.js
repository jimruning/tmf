const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { requirePermission } = require('../config/roles');
const db = require('../config/database');

// 获取操作日志（需要 log_read 权限）
router.get('/', authMiddleware, requirePermission('log_read'), (req, res) => {
  try {
    const { user_id, action, target_type, start_date, end_date } = req.query;
    let query = `
      SELECT l.*, u.username, u.real_name 
      FROM activity_logs l 
      LEFT JOIN users u ON l.user_id = u.id 
      WHERE 1=1
    `;
    const params = [];

    if (user_id) {
      query += ' AND l.user_id = ?';
      params.push(parseInt(user_id));
    }
    if (action) {
      query += ' AND l.action = ?';
      params.push(action);
    }
    if (target_type) {
      query += ' AND l.target_type = ?';
      params.push(target_type);
    }
    if (start_date) {
      query += ' AND l.created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND l.created_at <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY l.created_at DESC LIMIT 200';

    const logs = db.prepare(query).all(...params);
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取日志失败' }
    });
  }
});

module.exports = router;
