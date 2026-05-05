/**
 * Vercel Serverless API Entry
 */

const path = require('path');
const fs = require('fs');

// Set temp directory for Vercel
process.env.TMPDIR = '/tmp';

// Load dependencies - Vercel installs them in the function's node_modules
let express, cors;

try {
  express = require('express');
  cors = require('cors');
} catch (e) {
  // Fallback to backend node_modules
  const backendModules = path.join(__dirname, '..', 'backend', 'node_modules');
  const Module = require('module');
  const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function(request, parent, isMain, options) {
    try {
      return originalResolve.call(this, request, parent, isMain, options);
    } catch (err) {
      return originalResolve.call(this, request, { paths: [backendModules] }, isMain, options);
    }
  };
  express = require('express');
  cors = require('cors');
}

const app = express();

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure upload directory exists
const uploadDir = '/tmp/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Database setup
const dbPath = '/tmp/tmf.db';
const templateDbPath = path.join(__dirname, '..', 'backend', 'tmf.db');

// Copy database template if needed
if (!fs.existsSync(dbPath) && fs.existsSync(templateDbPath)) {
  fs.copyFileSync(templateDbPath, dbPath);
}

const Database = require('better-sqlite3');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize tables
const createTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      real_name TEXT,
      email TEXT UNIQUE,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      account_type TEXT DEFAULT 'site',
      title TEXT,
      organization TEXT,
      project_id INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_en TEXT,
      sponsor TEXT,
      protocol_number TEXT,
      phase TEXT,
      therapeutic_area TEXT,
      principal_investigator TEXT,
      status TEXT DEFAULT 'active',
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      zone TEXT NOT NULL,
      zone_cn TEXT,
      zone_en TEXT,
      section TEXT NOT NULL,
      section_cn TEXT,
      section_en TEXT,
      artifact TEXT NOT NULL,
      artifact_cn TEXT,
      artifact_en TEXT,
      parent_id INTEGER,
      level INTEGER DEFAULT 3,
      path TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      version TEXT DEFAULT '1.0',
      folder_id INTEGER NOT NULL,
      uploaded_by INTEGER NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_deleted INTEGER DEFAULT 0,
      deleted_by INTEGER,
      deleted_at DATETIME,
      delete_reason TEXT,
      status TEXT DEFAULT 'uploaded',
      reviewed_by INTEGER,
      reviewed_at DATETIME,
      review_comment TEXT,
      invalidate_reason TEXT,
      invalidated_by INTEGER,
      invalidated_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
    CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);
    CREATE INDEX IF NOT EXISTS idx_files_is_deleted ON files(is_deleted);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_folders_project ON folders(project_id);
  `);
};

createTables();

// Inject db into request for routes
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Load routes from backend
const authMiddleware = require('../backend/middleware/auth').authMiddleware;
const { requirePermission, canUploadToZone, getZoneKey } = require('../backend/config/roles');

// Auth routes
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Auth: Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '用户名和密码不能为空' } });
    }
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' } });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET || 'default-secret', { expiresIn: '24h' });
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    db.prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)').run(user.id, 'login', 'user', user.id, `用户 ${username} 登录`);
    res.json({ success: true, data: { token, user: { id: user.id, username: user.username, real_name: user.real_name, email: user.email, role: user.role, account_type: user.account_type, title: user.title, organization: user.organization } } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '登录失败' } });
  }
});

// Auth: Register
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '用户名和密码不能为空' } });
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email || '');
    if (existing) return res.status(400).json({ success: false, error: { code: 'USER_EXISTS', message: '用户名或邮箱已存在' } });
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)').run(username, email || null, hash, 'user');
    const user = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: { user } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '注册失败' } });
  }
});

// Projects routes
app.get('/api/projects', authMiddleware, (req, res) => {
  try {
    const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取项目列表失败' } });
  }
});

app.get('/api/projects/:id', authMiddleware, (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(parseInt(req.params.id));
    if (!project) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } });
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取项目失败' } });
  }
});

// Folders routes
app.get('/api/folders/tree', authMiddleware, (req, res) => {
  try {
    const { project_id } = req.query;
    let folders;
    if (project_id) {
      folders = db.prepare('SELECT id, zone, zone_cn as zoneCn, zone_en as zoneEn, section, section_cn as sectionCn, section_en as sectionEn, artifact, artifact_cn as artifactCn, artifact_en as artifactEn, level FROM folders WHERE project_id = ? ORDER BY id').all(parseInt(project_id));
    } else {
      folders = db.prepare('SELECT id, zone, zone_cn as zoneCn, zone_en as zoneEn, section, section_cn as sectionCn, section_en as sectionEn, artifact, artifact_cn as artifactCn, artifact_en as artifactEn, level FROM folders WHERE project_id IS NULL ORDER BY id').all();
    }
    const tree = [];
    const zoneMap = {};
    const sectionMap = {};
    for (const f of folders) {
      if (!zoneMap[f.zone]) {
        zoneMap[f.zone] = { key: `zone-${f.zone}`, title: `${f.zoneCn || f.zone} (${f.zoneEn})`, zone: f.zone, children: [] };
        tree.push(zoneMap[f.zone]);
      }
      const sectionKey = `${f.zone}-${f.section}`;
      if (!sectionMap[sectionKey]) {
        sectionMap[sectionKey] = { key: sectionKey, title: `${f.sectionCn || f.section} (${f.sectionEn})`, zone: f.zone, section: f.section, children: [] };
        zoneMap[f.zone].children.push(sectionMap[sectionKey]);
      }
      sectionMap[sectionKey].children.push({ key: `artifact-${f.id}`, title: `${f.artifactCn || f.artifact} (${f.artifactEn})`, id: f.id, isLeaf: true });
    }
    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取文件夹失败' } });
  }
});

// Files routes
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, '/tmp/uploads'),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, true);
  }
});

app.get('/api/files', authMiddleware, (req, res) => {
  try {
    const { folder_id, include_invalid } = req.query;
    let query = `SELECT f.*, u.username as uploader_name, u.real_name as uploader_real_name, u.role as uploader_role FROM files f LEFT JOIN users u ON f.uploaded_by = u.id WHERE 1=1`;
    const params = [];
    if (include_invalid !== 'true') query += " AND f.status != 'invalid'";
    if (folder_id) { query += ' AND f.folder_id = ?'; params.push(parseInt(folder_id)); }
    query += ' ORDER BY f.uploaded_at DESC';
    const files = db.prepare(query).all(...params);
    res.json({ success: true, data: files });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取文件列表失败' } });
  }
});

app.post('/api/files/upload', authMiddleware, requirePermission('file_upload'), upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: '请选择要上传的文件' } });
    const { folder_id, description } = req.body;
    if (!folder_id) { fs.unlinkSync(req.file.path); return res.status(400).json({ success: false, error: { code: 'NO_FOLDER', message: '请选择目标文件夹' } }); }
    const folder = db.prepare('SELECT id, zone, zone_en FROM folders WHERE id = ?').get(parseInt(folder_id));
    if (!folder) { fs.unlinkSync(req.file.path); return res.status(400).json({ success: false, error: { code: 'FOLDER_NOT_FOUND', message: '目标文件夹不存在' } }); }
    const zoneKey = getZoneKey(folder.zone_en || folder.zone);
    if (zoneKey && !canUploadToZone(req.user.role, zoneKey)) { fs.unlinkSync(req.file.path); return res.status(403).json({ success: false, error: { code: 'ZONE_PERMISSION_DENIED', message: `您的角色无权上传到该区域` } }); }
    const existing = db.prepare('SELECT version FROM files WHERE folder_id = ? AND original_name = ? AND status != ? ORDER BY version DESC LIMIT 1').get(parseInt(folder_id), req.file.originalname, 'invalid');
    let version = '1.0';
    if (existing) { const parts = existing.version.split('.'); version = `${parts[0]}.${parseInt(parts[1]) + 1}`; }
    const result = db.prepare('INSERT INTO files (original_name, stored_name, file_path, file_size, mime_type, version, folder_id, uploaded_by, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(req.file.originalname, req.file.filename, req.file.path, req.file.size, req.file.mimetype, version, parseInt(folder_id), req.user.id, description || null, 'uploaded');
    db.prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)').run(req.user.id, 'upload', 'file', result.lastInsertRowid, `上传文件: ${req.file.originalname}`);
    const file = db.prepare('SELECT f.*, u.username as uploader_name, u.real_name as uploader_real_name FROM files f LEFT JOIN users u ON f.uploaded_by = u.id WHERE f.id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: file });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '文件上传失败' } });
  }
});

app.get('/api/files/:id/download', authMiddleware, requirePermission('file_download'), (req, res) => {
  try {
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(parseInt(req.params.id));
    if (!file) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '文件不存在' } });
    if (!fs.existsSync(file.file_path)) return res.status(404).json({ success: false, error: { code: 'FILE_MISSING', message: '文件已丢失' } });
    db.prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)').run(req.user.id, 'download', 'file', file.id, `下载文件: ${file.original_name}`);
    const encodedName = encodeURIComponent(file.original_name);
    res.setHeader('Content-Disposition', `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
    res.download(file.file_path, file.original_name);
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '文件下载失败' } });
  }
});

app.put('/api/files/:id/invalidate', authMiddleware, requirePermission('file_invalidate'), (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim() === '') return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '请填写标注无效的原因' } });
    const file = db.prepare('SELECT * FROM files WHERE id = ? AND status != ?').get(parseInt(req.params.id), 'invalid');
    if (!file) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '文件不存在或已被标注为无效' } });
    db.prepare('UPDATE files SET status = ?, invalidate_reason = ?, invalidated_by = ?, invalidated_at = CURRENT_TIMESTAMP WHERE id = ?').run('invalid', reason, req.user.id, parseInt(req.params.id));
    db.prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)').run(req.user.id, 'invalidate', 'file', file.id, `标注文件为无效：${file.original_name}`);
    res.json({ success: true, message: '文件已标注为无效' });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '操作失败' } });
  }
});

app.post('/api/files/:id/restore', authMiddleware, requirePermission('file_restore'), (req, res) => {
  try {
    const file = db.prepare('SELECT * FROM files WHERE id = ? AND status = ?').get(parseInt(req.params.id), 'invalid');
    if (!file) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '文件不存在或未标注为无效' } });
    db.prepare('UPDATE files SET status = ?, invalidate_reason = NULL, invalidated_by = NULL, invalidated_at = NULL WHERE id = ?').run('uploaded', parseInt(req.params.id));
    res.json({ success: true, message: '文件已恢复' });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '恢复失败' } });
  }
});

app.post('/api/files/:id/review', authMiddleware, requirePermission('file_approve'), (req, res) => {
  try {
    const { approved, comment } = req.body;
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(parseInt(req.params.id));
    if (!file) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '文件不存在' } });
    db.prepare('UPDATE files SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_comment = ? WHERE id = ?').run(approved ? 'approved' : 'rejected', req.user.id, comment || null, parseInt(req.params.id));
    res.json({ success: true, message: approved ? '审核通过' : '已退回' });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '审核失败' } });
  }
});

// Users routes
app.get('/api/users', authMiddleware, requirePermission('user_read'), (req, res) => {
  try {
    const { role, is_active } = req.query;
    let query = 'SELECT id, username, real_name, email, phone, role, account_type, title, organization, project_id, created_at, last_login, is_active FROM users WHERE 1=1';
    const params = [];
    if (role) { query += ' AND role = ?'; params.push(role); }
    if (is_active !== undefined) { query += ' AND is_active = ?'; params.push(parseInt(is_active)); }
    query += ' ORDER BY created_at DESC';
    const users = db.prepare(query).all(...params);
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取用户列表失败' } });
  }
});

app.post('/api/users', authMiddleware, requirePermission('user_create'), (req, res) => {
  try {
    const { username, realName, email, phone, password, role, accountType, title, organization } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '用户名和密码不能为空' } });
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email || '');
    if (existing) return res.status(400).json({ success: false, error: { code: 'USER_EXISTS', message: '用户名或邮箱已存在' } });
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, real_name, email, phone, password_hash, role, account_type, title, organization, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(username, realName || null, email || null, phone || null, hash, role || 'user', accountType || 'site', title || null, organization || null, req.user.id);
    const user = db.prepare('SELECT id, username, real_name, email, phone, role, account_type, title, organization, project_id, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '创建用户失败' } });
  }
});

app.put('/api/users/:id', authMiddleware, requirePermission('user_update'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(req.params.id));
    if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '用户不存在' } });
    const { realName, email, phone, role, accountType, title, organization, isActive } = req.body;
    db.prepare('UPDATE users SET real_name=?, email=?, phone=?, role=?, account_type=?, title=?, organization=?, is_active=? WHERE id=?').run(realName ?? existing.real_name, email ?? existing.email, phone ?? existing.phone, role ?? existing.role, accountType ?? existing.account_type, title ?? existing.title, organization ?? existing.organization, isActive !== undefined ? isActive : existing.is_active, parseInt(req.params.id));
    const user = db.prepare('SELECT id, username, real_name, email, phone, role, account_type, title, organization, project_id, created_at, last_login, is_active FROM users WHERE id = ?').get(parseInt(req.params.id));
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '更新用户失败' } });
  }
});

app.post('/api/users/:id/reset-password', authMiddleware, requirePermission('user_update'), (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '新密码不能为空' } });
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(req.params.id));
    if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '用户不存在' } });
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, parseInt(req.params.id));
    res.json({ success: true, message: '密码已重置' });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '重置密码失败' } });
  }
});

// Logs routes
app.get('/api/logs', authMiddleware, requirePermission('log_read'), (req, res) => {
  try {
    const { user_id, action, target_type, start_date, end_date } = req.query;
    let query = `SELECT l.*, u.username, u.real_name FROM activity_logs l LEFT JOIN users u ON l.user_id = u.id WHERE 1=1`;
    const params = [];
    if (user_id) { query += ' AND l.user_id = ?'; params.push(parseInt(user_id)); }
    if (action) { query += ' AND l.action = ?'; params.push(action); }
    if (target_type) { query += ' AND l.target_type = ?'; params.push(target_type); }
    if (start_date) { query += ' AND l.created_at >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND l.created_at <= ?'; params.push(end_date); }
    query += ' ORDER BY l.created_at DESC LIMIT 200';
    const logs = db.prepare(query).all(...params);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取日志失败' } });
  }
});

// Settings routes
const initSettings = () => {
  const defaults = [
    { key: 'max_file_size', value: '100', description: '最大文件大小 (MB)' },
    { key: 'allowed_extensions', value: 'pdf,doc,docx,xls,xlsx,jpg,png,zip,rar', description: '允许的文件类型' },
    { key: 'session_timeout', value: '30', description: '会话超时时间 (分钟)' },
    { key: 'password_min_length', value: '6', description: '密码最小长度' },
    { key: 'max_login_attempts', value: '5', description: '最大登录尝试次数' },
    { key: 'log_retention_days', value: '365', description: '日志保留天数' },
    { key: 'require_delete_reason', value: 'true', description: '删除文件必须填写原因' }
  ];
  for (const s of defaults) {
    const existing = db.prepare('SELECT id FROM system_settings WHERE key = ?').get(s.key);
    if (!existing) db.prepare('INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)').run(s.key, s.value, s.description);
  }
};
initSettings();

app.get('/api/settings', authMiddleware, (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM system_settings ORDER BY key').all();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取设置失败' } });
  }
});

app.post('/api/settings', authMiddleware, (req, res) => {
  try {
    const updates = req.body;
    const stmt = db.prepare('UPDATE system_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?');
    for (const [key, value] of Object.entries(updates)) { stmt.run(String(value), key); }
    res.json({ success: true, message: '设置已更新' });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '更新设置失败' } });
  }
});

// Search route
app.get('/api/search', authMiddleware, (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, data: [] });
    const files = db.prepare(`SELECT f.*, u.username as uploader_name FROM files f LEFT JOIN users u ON f.uploaded_by = u.id WHERE f.original_name LIKE ? AND f.status != 'invalid' ORDER BY f.uploaded_at DESC LIMIT 50`).all(`%${q}%`);
    res.json({ success: true, data: files });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '搜索失败' } });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'TMF API is running', timestamp: new Date().toISOString() });
});

// Static files for uploads
app.use('/uploads', express.static('/tmp/uploads'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' } });
});

// Export for Vercel
module.exports = app;
