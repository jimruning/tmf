const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

router.post('/register', (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '用户名和密码不能为空' }
      });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email || '');
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: { code: 'USER_EXISTS', message: '用户名或邮箱已存在' }
      });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(username, email || null, passwordHash, 'user');

    const user = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: { user } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '注册失败' }
    });
  }
});

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '用户名和密码不能为空' }
      });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' }
      });
    }

    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' }
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    db.prepare(
      'INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)'
    ).run(user.id, 'login', 'user', user.id, `用户 ${username} 登录`);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          real_name: user.real_name,
          email: user.email,
          role: user.role,
          account_type: user.account_type,
          title: user.title,
          organization: user.organization
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '登录失败' }
    });
  }
});

module.exports = router;
