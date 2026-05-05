const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authMiddleware } = require('../middleware/auth');
const { requirePermission, ROLE_LABELS, ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } = require('../config/roles');
const db = require('../config/database');

// 获取用户列表（需要 user_read 权限）
router.get('/', authMiddleware, requirePermission('user_read'), (req, res) => {
  try {
    const { role, project_id, is_active } = req.query;
    let query = 'SELECT id, username, real_name, email, phone, role, account_type, title, organization, project_id, created_at, last_login, is_active FROM users WHERE 1=1';
    const params = [];

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }
    if (project_id) {
      query += ' AND project_id = ?';
      params.push(parseInt(project_id));
    }
    if (is_active !== undefined) {
      query += ' AND is_active = ?';
      params.push(parseInt(is_active));
    }

    query += ' ORDER BY created_at DESC';

    const users = db.prepare(query).all(...params);
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取用户列表失败' }
    });
  }
});

// 创建用户（需要 user_create 权限）
router.post('/', authMiddleware, requirePermission('user_create'), (req, res) => {
  try {
    const { username, realName, email, phone, password, role, accountType, title, organization, projectId } = req.body;

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
      'INSERT INTO users (username, real_name, email, phone, password_hash, role, account_type, title, organization, project_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(username, realName || null, email || null, phone || null, passwordHash, role || 'user', accountType || 'site', title || null, organization || null, projectId || null, req.user.id);

    const user = db.prepare(
      'SELECT id, username, real_name, email, phone, role, account_type, title, organization, project_id, created_at FROM users WHERE id = ?'
    ).get(result.lastInsertRowid);

    db.prepare(
      'INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, 'create_user', 'user', result.lastInsertRowid, `创建用户: ${username} (${ROLE_LABELS[role] || role}, ${ACCOUNT_TYPE_LABELS[accountType] || '研究中心'})`);

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '创建用户失败' }
    });
  }
});

// 获取用户详情
router.get('/:id', authMiddleware, requirePermission('user_read'), (req, res) => {
  try {
    const user = db.prepare(
      'SELECT id, username, real_name, email, phone, role, account_type, title, organization, project_id, created_at, last_login, is_active FROM users WHERE id = ?'
    ).get(parseInt(req.params.id));
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '用户不存在' }
      });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取用户失败' }
    });
  }
});

// 更新用户
router.put('/:id', authMiddleware, requirePermission('user_update'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(req.params.id));
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '用户不存在' }
      });
    }

    const { realName, email, phone, role, accountType, title, organization, projectId, isActive } = req.body;
    
    db.prepare(
      'UPDATE users SET real_name=?, email=?, phone=?, role=?, account_type=?, title=?, organization=?, project_id=?, is_active=? WHERE id=?'
    ).run(
      realName ?? existing.real_name,
      email ?? existing.email,
      phone ?? existing.phone,
      role ?? existing.role,
      accountType ?? existing.account_type,
      title ?? existing.title,
      organization ?? existing.organization,
      projectId ?? existing.project_id,
      isActive !== undefined ? isActive : existing.is_active,
      parseInt(req.params.id)
    );

    const user = db.prepare(
      'SELECT id, username, real_name, email, phone, role, account_type, title, organization, project_id, created_at, last_login, is_active FROM users WHERE id = ?'
    ).get(parseInt(req.params.id));

    db.prepare(
      'INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, 'update_user', 'user', parseInt(req.params.id), `更新用户: ${existing.username}`);

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '更新用户失败' }
    });
  }
});

// 删除用户（软删除）
router.delete('/:id', authMiddleware, requirePermission('user_delete'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(req.params.id));
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '用户不存在' }
      });
    }

    if (existing.username === 'admin') {
      return res.status(400).json({
        success: false,
        error: { code: 'PROTECTED_USER', message: '不能删除默认管理员账户' }
      });
    }

    db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(parseInt(req.params.id));

    db.prepare(
      'INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, 'delete_user', 'user', parseInt(req.params.id), `删除用户: ${existing.username}`);

    res.json({ success: true, message: '用户已禁用' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '删除用户失败' }
    });
  }
});

// 重置密码
router.post('/:id/reset-password', authMiddleware, requirePermission('user_update'), (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '新密码不能为空' }
      });
    }

    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(req.params.id));
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '用户不存在' }
      });
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, parseInt(req.params.id));

    db.prepare(
      'INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, 'reset_password', 'user', parseInt(req.params.id), `重置用户密码: ${existing.username}`);

    res.json({ success: true, message: '密码已重置' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '重置密码失败' }
    });
  }
});

module.exports = router;
