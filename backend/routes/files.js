const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');
const { requirePermission, canUploadToZone, getZoneKey } = require('../config/roles');
const db = require('../config/database');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.NODE_ENV === 'production' ? '/tmp/uploads' : path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, true);
  }
});

// 获取文件列表
router.get('/', authMiddleware, (req, res) => {
  try {
    const { folder_id, project_id, include_invalid } = req.query;
    let query = `
      SELECT f.*, u.username as uploader_name, u.real_name as uploader_real_name, u.role as uploader_role
      FROM files f 
      LEFT JOIN users u ON f.uploaded_by = u.id
      LEFT JOIN folders fo ON f.folder_id = fo.id
      WHERE 1=1
    `;
    const params = [];

    if (include_invalid !== 'true') {
      query += " AND f.status != 'invalid'";
    }

    if (project_id) {
      query += ' AND fo.project_id = ?';
      params.push(parseInt(project_id));
    }

    if (folder_id) {
      query += ' AND f.folder_id = ?';
      params.push(parseInt(folder_id));
    }

    query += ' ORDER BY f.uploaded_at DESC';

    const files = db.prepare(query).all(...params);
    res.json({ success: true, data: files });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取文件列表失败' }
    });
  }
});

// 上传文件（需要 file_upload 权限 + 区域权限检查）
router.post('/upload', authMiddleware, requirePermission('file_upload'), upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: '请选择要上传的文件' }
      });
    }

    const { folder_id, description } = req.body;
    if (!folder_id) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FOLDER', message: '请选择目标文件夹' }
      });
    }

    // 检查文件夹是否存在，并获取其 Zone 信息
    const folder = db.prepare(
      'SELECT id, zone, zone_en, project_id FROM folders WHERE id = ?'
    ).get(parseInt(folder_id));

    if (!folder) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: { code: 'FOLDER_NOT_FOUND', message: '目标文件夹不存在' }
      });
    }

    // 检查用户是否有权限上传到该 Zone
    const zoneKey = getZoneKey(folder.zone_en || folder.zone);
    if (zoneKey && !canUploadToZone(req.user.role, zoneKey)) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({
        success: false,
        error: { 
          code: 'ZONE_PERMISSION_DENIED', 
          message: `您的角色（${req.user.role}）无权上传文件到该区域（${folder.zone_en || folder.zone}）。请联系管理员调整权限。` 
        }
      });
    }

    const existingFile = db.prepare(
      'SELECT version FROM files WHERE folder_id = ? AND original_name = ? AND is_deleted = 0 ORDER BY version DESC LIMIT 1'
    ).get(parseInt(folder_id), req.file.originalname);

    let version = '1.0';
    if (existingFile) {
      const parts = existingFile.version.split('.');
      version = `${parts[0]}.${parseInt(parts[1]) + 1}`;
    }

    const result = db.prepare(
      'INSERT INTO files (original_name, stored_name, file_path, file_size, mime_type, version, folder_id, uploaded_by, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      req.file.originalname,
      req.file.filename,
      req.file.path,
      req.file.size,
      req.file.mimetype,
      version,
      parseInt(folder_id),
      req.user.id,
      description || null,
      'uploaded'
    );

    db.prepare(
      'INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, 'upload', 'file', result.lastInsertRowid, `上传文件: ${req.file.originalname}`);

    const file = db.prepare(
      'SELECT f.*, u.username as uploader_name, u.real_name as uploader_real_name FROM files f LEFT JOIN users u ON f.uploaded_by = u.id WHERE f.id = ?'
    ).get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: file });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '文件上传失败' }
    });
  }
});

// 下载文件（需要 file_download 权限）
router.get('/:id/download', authMiddleware, requirePermission('file_download'), (req, res) => {
  try {
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(parseInt(req.params.id));
    if (!file) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '文件不存在' }
      });
    }

    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({
        success: false,
        error: { code: 'FILE_MISSING', message: '文件已丢失' }
      });
    }

    db.prepare(
      'INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, 'download', 'file', file.id, `下载文件: ${file.original_name}`);

    const encodedName = encodeURIComponent(file.original_name);
    res.setHeader('Content-Disposition', `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
    res.download(file.file_path, file.original_name);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '文件下载失败' }
    });
  }
});

// 标注文件为无效（文件永久保留，需要 file_invalidate 权限）
router.put('/:id/invalidate', authMiddleware, requirePermission('file_invalidate'), (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '请填写标注无效的原因' }
      });
    }

    const file = db.prepare('SELECT * FROM files WHERE id = ? AND status != ?').get(parseInt(req.params.id), 'invalid');
    if (!file) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '文件不存在或已被标注为无效' }
      });
    }

    // 更新文件状态为 invalid，记录无效原因和操作人
    db.prepare(
      'UPDATE files SET status = ?, invalidate_reason = ?, invalidated_by = ?, invalidated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run('invalid', reason, req.user.id, parseInt(req.params.id));

    db.prepare(
      'INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, 'invalidate', 'file', file.id, `标注文件为无效：${file.original_name}（原因：${reason}）`);

    res.json({ success: true, message: '文件已标注为无效，文件将永久保留在系统中' });
  } catch (error) {
    console.error('Invalidate error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '操作失败' }
    });
  }
});

// 恢复已标注无效的文件（需要 file_restore 权限）
router.post('/:id/restore', authMiddleware, requirePermission('file_restore'), (req, res) => {
  try {
    const file = db.prepare('SELECT * FROM files WHERE id = ? AND status = ?').get(parseInt(req.params.id), 'invalid');
    if (!file) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '文件不存在或未标注为无效' }
      });
    }

    db.prepare(
      'UPDATE files SET status = ?, invalidate_reason = NULL, invalidated_by = NULL, invalidated_at = NULL WHERE id = ?'
    ).run('uploaded', parseInt(req.params.id));

    db.prepare(
      'INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, 'restore', 'file', file.id, `恢复无效文件：${file.original_name}`);

    res.json({ success: true, message: '文件已恢复为有效状态' });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '文件恢复失败' }
    });
  }
});

// 审核文件（需要 file_approve 权限）
router.post('/:id/review', authMiddleware, requirePermission('file_approve'), (req, res) => {
  try {
    const { approved, comment } = req.body;
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(parseInt(req.params.id));
    if (!file) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '文件不存在' }
      });
    }

    db.prepare(
      'UPDATE files SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_comment = ? WHERE id = ?'
    ).run(approved ? 'approved' : 'rejected', req.user.id, comment || null, parseInt(req.params.id));

    db.prepare(
      'INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, approved ? 'approve' : 'reject', 'file', file.id, `${approved ? '审核通过' : '审核退回'}文件: ${file.original_name}`);

    res.json({ success: true, message: approved ? '文件审核通过' : '文件已退回' });
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '文件审核失败' }
    });
  }
});

module.exports = router;
