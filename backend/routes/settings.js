const express = require('express');
const router = express.Router();
const { authMiddleware, adminRequired } = require('../middleware/auth');
const db = require('../config/database');

// 初始化默认设置（延迟执行，确保表存在）
const initSettings = () => {
  try {
    // 检查表是否存在
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'").get();
    if (!tableCheck) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT UNIQUE NOT NULL,
          value TEXT,
          description TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    const defaults = [
      { key: 'max_file_size', value: '100', description: '最大文件大小 (MB)' },
      { key: 'allowed_extensions', value: 'pdf,doc,docx,xls,xlsx,jpg,png,zip,rar', description: '允许的文件类型' },
      { key: 'session_timeout', value: '30', description: '会话超时时间 (分钟)' },
      { key: 'password_min_length', value: '6', description: '密码最小长度' },
      { key: 'max_login_attempts', value: '5', description: '最大登录尝试次数' },
      { key: 'log_retention_days', value: '365', description: '日志保留天数' },
      { key: 'require_delete_reason', value: 'true', description: '删除文件必须填写原因' }
    ];

    for (const setting of defaults) {
      const existing = db.prepare('SELECT id FROM system_settings WHERE key = ?').get(setting.key);
      if (!existing) {
        db.prepare(
          'INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)'
        ).run(setting.key, setting.value, setting.description);
      }
    }
  } catch (error) {
    console.error('初始化系统设置失败:', error.message);
  }
};

initSettings();

// 获取所有设置（需要管理员权限）
router.get('/', authMiddleware, adminRequired, (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM system_settings ORDER BY key').all();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取设置失败' }
    });
  }
});

// 更新设置（需要管理员权限）
router.post('/', authMiddleware, adminRequired, (req, res) => {
  try {
    const updates = req.body;
    const updateStmt = db.prepare(
      'UPDATE system_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?'
    );

    const updateMany = db.transaction((items) => {
      for (const [key, value] of Object.entries(items)) {
        updateStmt.run(String(value), key);
      }
    });

    updateMany(updates);

    db.prepare(
      'INSERT INTO activity_logs (user_id, action, target_type, details) VALUES (?, ?, ?, ?)'
    ).run(req.user.id, 'update_settings', 'system', `更新系统设置: ${Object.keys(updates).join(', ')}`);

    res.json({ success: true, message: '设置已更新' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '更新设置失败' }
    });
  }
});

// 获取单个设置
router.get('/:key', authMiddleware, (req, res) => {
  try {
    const setting = db.prepare('SELECT * FROM system_settings WHERE key = ?').get(req.params.key);
    if (!setting) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '设置项不存在' }
      });
    }
    res.json({ success: true, data: setting });
  } catch (error) {
    console.error('Get setting error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取设置失败' }
    });
  }
});

module.exports = router;
