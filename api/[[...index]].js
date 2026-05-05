/**
 * Vercel Serverless API Entry - Vercel Postgres
 */
const path = require('path');
const fs = require('fs');
const { sql } = require('@vercel/postgres');

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

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

// Multer setup
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

// Load roles config
const { requirePermission, canUploadToZone, getZoneKey } = require('../backend/config/roles');

// Auth middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未提供认证令牌' } });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    const { rows } = await sql`SELECT id, username, real_name, email, role, account_type, title, organization FROM users WHERE id = ${decoded.id} AND is_active = true`;
    if (rows.length === 0) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '用户不存在' } });
    req.user = rows[0];
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '认证失败' } });
  }
};

// Initialize database tables
const initTables = async () => {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      )
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        name_en TEXT,
        sponsor TEXT,
        protocol_number TEXT,
        phase TEXT,
        therapeutic_area TEXT,
        principal_investigator TEXT,
        status TEXT DEFAULT 'active',
        created_by INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS folders (
        id SERIAL PRIMARY KEY,
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
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        mime_type TEXT,
        version TEXT DEFAULT '1.0',
        folder_id INTEGER NOT NULL,
        uploaded_by INTEGER NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT false,
        deleted_by INTEGER,
        deleted_at TIMESTAMP,
        delete_reason TEXT,
        status TEXT DEFAULT 'uploaded',
        reviewed_by INTEGER,
        reviewed_at TIMESTAMP,
        review_comment TEXT,
        invalidate_reason TEXT,
        invalidated_by INTEGER,
        invalidated_at TIMESTAMP
      )
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id INTEGER,
        details TEXT,
        ip_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await sql`CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_files_status ON files(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_folders_project ON folders(project_id)`;
    
    // Insert default settings
    const defaults = [
      ['max_file_size', '100', '最大文件大小 (MB)'],
      ['allowed_extensions', 'pdf,doc,docx,xls,xlsx,jpg,png,zip,rar', '允许的文件类型'],
      ['session_timeout', '30', '会话超时时间 (分钟)'],
      ['password_min_length', '6', '密码最小长度'],
      ['max_login_attempts', '5', '最大登录尝试次数'],
      ['log_retention_days', '365', '日志保留天数'],
      ['require_delete_reason', 'true', '删除文件必须填写原因']
    ];
    
    for (const [key, value, desc] of defaults) {
      await sql`
        INSERT INTO system_settings (key, value, description) 
        VALUES (${key}, ${value}, ${desc})
        ON CONFLICT (key) DO NOTHING
      `;
    }
    
    console.log('Database tables initialized');
  } catch (error) {
    console.error('Database initialization error:', error.message);
  }
};

initTables();

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '用户名和密码不能为空' } });
    }
    const { rows } = await sql`SELECT * FROM users WHERE username = ${username} AND is_active = true`;
    if (rows.length === 0 || !bcrypt.compareSync(password, rows[0].password_hash)) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' } });
    }
    const user = rows[0];
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET || 'default-secret', { expiresIn: '24h' });
    await sql`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ${user.id}`;
    await sql`INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES (${user.id}, 'login', 'user', ${user.id}, '用户登录')`;
    res.json({ success: true, data: { token, user: { id: user.id, username: user.username, real_name: user.real_name, email: user.email, role: user.role, account_type: user.account_type, title: user.title, organization: user.organization } } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '登录失败' } });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '用户名和密码不能为空' } });
    const { rows } = await sql`SELECT id FROM users WHERE username = ${username} OR email = ${email || ''}`;
    if (rows.length > 0) return res.status(400).json({ success: false, error: { code: 'USER_EXISTS', message: '用户名或邮箱已存在' } });
    const hash = bcrypt.hashSync(password, 10);
    const { rows: users } = await sql`INSERT INTO users (username, email, password_hash, role) VALUES (${username}, ${email || null}, ${hash}, 'user') RETURNING id, username, email, role, created_at`;
    res.status(201).json({ success: true, data: { user: users[0] } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '注册失败' } });
  }
});

// Projects routes
app.get('/api/projects', authMiddleware, async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM projects ORDER BY created_at DESC`;
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取项目列表失败' } });
  }
});

app.get('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM projects WHERE id = ${parseInt(req.params.id)}`;
    if (rows.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取项目失败' } });
  }
});

app.post('/api/projects', authMiddleware, requirePermission('project_create'), async (req, res) => {
  try {
    const { name, nameEn, sponsor, protocolNumber, phase, therapeuticArea, principalInvestigator } = req.body;
    const { rows } = await sql`
      INSERT INTO projects (name, name_en, sponsor, protocol_number, phase, therapeutic_area, principal_investigator, created_by)
      VALUES (${name}, ${nameEn || null}, ${sponsor || null}, ${protocolNumber || null}, ${phase || null}, ${therapeuticArea || null}, ${principalInvestigator || null}, ${req.user.id})
      RETURNING *
    `;
    
    // Copy template folders
    const { rows: folders } = await sql`SELECT zone, zone_cn, zone_en, section, section_cn, section_en, artifact, artifact_cn, artifact_en, level, path FROM folders WHERE project_id IS NULL`;
    for (const f of folders) {
      await sql`
        INSERT INTO folders (project_id, zone, zone_cn, zone_en, section, section_cn, section_en, artifact, artifact_cn, artifact_en, level, path)
        VALUES (${rows[0].id}, ${f.zone}, ${f.zone_cn}, ${f.zone_en}, ${f.section}, ${f.section_cn}, ${f.section_en}, ${f.artifact}, ${f.artifact_cn}, ${f.artifact_en}, ${f.level}, ${f.path})
      `;
    }
    
    await sql`INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES (${req.user.id}, 'create', 'project', ${rows[0].id}, '创建项目')`;
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '创建项目失败' } });
  }
});

// Folders routes
app.get('/api/folders/tree', authMiddleware, async (req, res) => {
  try {
    const { project_id } = req.query;
    let query;
    if (project_id) {
      query = await sql`SELECT id, zone, zone_cn as "zoneCn", zone_en as "zoneEn", section, section_cn as "sectionCn", section_en as "sectionEn", artifact, artifact_cn as "artifactCn", artifact_en as "artifactEn", level FROM folders WHERE project_id = ${parseInt(project_id)} ORDER BY id`;
    } else {
      query = await sql`SELECT id, zone, zone_cn as "zoneCn", zone_en as "zoneEn", section, section_cn as "sectionCn", section_en as "sectionEn", artifact, artifact_cn as "artifactCn", artifact_en as "artifactEn", level FROM folders WHERE project_id IS NULL ORDER BY id`;
    }
    
    const folders = query.rows;
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
app.get('/api/files', authMiddleware, async (req, res) => {
  try {
    const { folder_id, include_invalid } = req.query;
    let query = `SELECT f.*, u.username as uploader_name, u.real_name as uploader_real_name, u.role as uploader_role FROM files f LEFT JOIN users u ON f.uploaded_by = u.id WHERE 1=1`;
    const params = [];
    if (include_invalid !== 'true') query += ` AND f.status != 'invalid'`;
    if (folder_id) { query += ` AND f.folder_id = ${parseInt(folder_id)}`; }
    query += ' ORDER BY f.uploaded_at DESC';
    const { rows } = await sql.unsafe(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取文件列表失败' } });
  }
});

app.post('/api/files/upload', authMiddleware, requirePermission('file_upload'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: '请选择要上传的文件' } });
    const { folder_id, description } = req.body;
    if (!folder_id) { fs.unlinkSync(req.file.path); return res.status(400).json({ success: false, error: { code: 'NO_FOLDER', message: '请选择目标文件夹' } }); }
    
    const { rows: folders } = await sql`SELECT id, zone, zone_en FROM folders WHERE id = ${parseInt(folder_id)}`;
    if (folders.length === 0) { fs.unlinkSync(req.file.path); return res.status(400).json({ success: false, error: { code: 'FOLDER_NOT_FOUND', message: '目标文件夹不存在' } }); }
    const folder = folders[0];
    
    const zoneKey = getZoneKey(folder.zone_en || folder.zone);
    if (zoneKey && !canUploadToZone(req.user.role, zoneKey)) { fs.unlinkSync(req.file.path); return res.status(403).json({ success: false, error: { code: 'ZONE_PERMISSION_DENIED', message: '您的角色无权上传到该区域' } }); }
    
    const { rows: existing } = await sql`SELECT version FROM files WHERE folder_id = ${parseInt(folder_id)} AND original_name = ${req.file.originalname} AND status != 'invalid' ORDER BY version DESC LIMIT 1`;
    let version = '1.0';
    if (existing.length > 0) { const parts = existing[0].version.split('.'); version = `${parts[0]}.${parseInt(parts[1]) + 1}`; }
    
    const { rows: files } = await sql`
      INSERT INTO files (original_name, stored_name, file_path, file_size, mime_type, version, folder_id, uploaded_by, status)
      VALUES (${req.file.originalname}, ${req.file.filename}, ${req.file.path}, ${req.file.size}, ${req.file.mimetype}, ${version}, ${parseInt(folder_id)}, ${req.user.id}, 'uploaded')
      RETURNING *
    `;
    
    await sql`INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES (${req.user.id}, 'upload', 'file', ${files[0].id}, '上传文件')`;
    res.status(201).json({ success: true, data: files[0] });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '文件上传失败' } });
  }
});

app.get('/api/files/:id/download', authMiddleware, requirePermission('file_download'), async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM files WHERE id = ${parseInt(req.params.id)}`;
    if (rows.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '文件不存在' } });
    const file = rows[0];
    if (!fs.existsSync(file.file_path)) return res.status(404).json({ success: false, error: { code: 'FILE_MISSING', message: '文件已丢失' } });
    
    await sql`INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES (${req.user.id}, 'download', 'file', ${file.id}, '下载文件')`;
    const encodedName = encodeURIComponent(file.original_name);
    res.setHeader('Content-Disposition', `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
    res.download(file.file_path, file.original_name);
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '文件下载失败' } });
  }
});

app.put('/api/files/:id/invalidate', authMiddleware, requirePermission('file_invalidate'), async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim() === '') return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '请填写标注无效的原因' } });
    
    const { rows } = await sql`SELECT * FROM files WHERE id = ${parseInt(req.params.id)} AND status != 'invalid'`;
    if (rows.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '文件不存在或已被标注为无效' } });
    
    await sql`UPDATE files SET status = 'invalid', invalidate_reason = ${reason}, invalidated_by = ${req.user.id}, invalidated_at = CURRENT_TIMESTAMP WHERE id = ${parseInt(req.params.id)}`;
    await sql`INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES (${req.user.id}, 'invalidate', 'file', ${parseInt(req.params.id)}, '标注文件为无效')`;
    res.json({ success: true, message: '文件已标注为无效' });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '操作失败' } });
  }
});

app.post('/api/files/:id/restore', authMiddleware, requirePermission('file_restore'), async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM files WHERE id = ${parseInt(req.params.id)} AND status = 'invalid'`;
    if (rows.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '文件不存在或未标注为无效' } });
    
    await sql`UPDATE files SET status = 'uploaded', invalidate_reason = NULL, invalidated_by = NULL, invalidated_at = NULL WHERE id = ${parseInt(req.params.id)}`;
    res.json({ success: true, message: '文件已恢复' });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '恢复失败' } });
  }
});

app.post('/api/files/:id/review', authMiddleware, requirePermission('file_approve'), async (req, res) => {
  try {
    const { approved, comment } = req.body;
    const { rows } = await sql`SELECT * FROM files WHERE id = ${parseInt(req.params.id)}`;
    if (rows.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '文件不存在' } });
    
    await sql`UPDATE files SET status = ${approved ? 'approved' : 'rejected'}, reviewed_by = ${req.user.id}, reviewed_at = CURRENT_TIMESTAMP, review_comment = ${comment || null} WHERE id = ${parseInt(req.params.id)}`;
    res.json({ success: true, message: approved ? '审核通过' : '已退回' });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '审核失败' } });
  }
});

// Users routes
app.get('/api/users', authMiddleware, requirePermission('user_read'), async (req, res) => {
  try {
    const { role, is_active } = req.query;
    let query = 'SELECT id, username, real_name, email, phone, role, account_type, title, organization, project_id, created_at, last_login, is_active FROM users WHERE 1=1';
    const params = [];
    if (role) { query += ` AND role = '${role}'`; }
    if (is_active !== undefined) { query += ` AND is_active = ${is_active === 'true'}`; }
    query += ' ORDER BY created_at DESC';
    const { rows } = await sql.unsafe(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取用户列表失败' } });
  }
});

app.post('/api/users', authMiddleware, requirePermission('user_create'), async (req, res) => {
  try {
    const { username, realName, email, phone, password, role, accountType, title, organization } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '用户名和密码不能为空' } });
    
    const { rows: existing } = await sql`SELECT id FROM users WHERE username = ${username} OR email = ${email || ''}`;
    if (existing.length > 0) return res.status(400).json({ success: false, error: { code: 'USER_EXISTS', message: '用户名或邮箱已存在' } });
    
    const hash = bcrypt.hashSync(password, 10);
    const { rows } = await sql`
      INSERT INTO users (username, real_name, email, phone, password_hash, role, account_type, title, organization, created_by)
      VALUES (${username}, ${realName || null}, ${email || null}, ${phone || null}, ${hash}, ${role || 'user'}, ${accountType || 'site'}, ${title || null}, ${organization || null}, ${req.user.id})
      RETURNING id, username, real_name, email, phone, role, account_type, title, organization, project_id, created_at
    `;
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '创建用户失败' } });
  }
});

app.put('/api/users/:id', authMiddleware, requirePermission('user_update'), async (req, res) => {
  try {
    const { rows: existing } = await sql`SELECT * FROM users WHERE id = ${parseInt(req.params.id)}`;
    if (existing.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '用户不存在' } });
    
    const { realName, email, phone, role, accountType, title, organization, isActive } = req.body;
    const user = existing[0];
    
    await sql`
      UPDATE users SET 
        real_name = ${realName !== undefined ? realName : user.real_name},
        email = ${email !== undefined ? email : user.email},
        phone = ${phone !== undefined ? phone : user.phone},
        role = ${role !== undefined ? role : user.role},
        account_type = ${accountType !== undefined ? accountType : user.account_type},
        title = ${title !== undefined ? title : user.title},
        organization = ${organization !== undefined ? organization : user.organization},
        is_active = ${isActive !== undefined ? isActive : user.is_active}
      WHERE id = ${parseInt(req.params.id)}
    `;
    
    const { rows } = await sql`SELECT id, username, real_name, email, phone, role, account_type, title, organization, project_id, created_at, last_login, is_active FROM users WHERE id = ${parseInt(req.params.id)}`;
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '更新用户失败' } });
  }
});

app.post('/api/users/:id/reset-password', authMiddleware, requirePermission('user_update'), async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '新密码不能为空' } });
    
    const { rows } = await sql`SELECT * FROM users WHERE id = ${parseInt(req.params.id)}`;
    if (rows.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '用户不存在' } });
    
    const hash = bcrypt.hashSync(newPassword, 10);
    await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${parseInt(req.params.id)}`;
    res.json({ success: true, message: '密码已重置' });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '重置密码失败' } });
  }
});

// Logs routes
app.get('/api/logs', authMiddleware, requirePermission('log_read'), async (req, res) => {
  try {
    const { user_id, action, target_type, start_date, end_date } = req.query;
    let query = `SELECT l.*, u.username, u.real_name FROM activity_logs l LEFT JOIN users u ON l.user_id = u.id WHERE 1=1`;
    if (user_id) query += ` AND l.user_id = ${parseInt(user_id)}`;
    if (action) query += ` AND l.action = '${action}'`;
    if (target_type) query += ` AND l.target_type = '${target_type}'`;
    if (start_date) query += ` AND l.created_at >= '${start_date}'`;
    if (end_date) query += ` AND l.created_at <= '${end_date}'`;
    query += ' ORDER BY l.created_at DESC LIMIT 200';
    const { rows } = await sql.unsafe(query);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取日志失败' } });
  }
});

// Settings routes
app.get('/api/settings', authMiddleware, async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM system_settings ORDER BY key`;
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取设置失败' } });
  }
});

app.post('/api/settings', authMiddleware, async (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await sql`UPDATE system_settings SET value = ${String(value)}, updated_at = CURRENT_TIMESTAMP WHERE key = ${key}`;
    }
    res.json({ success: true, message: '设置已更新' });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '更新设置失败' } });
  }
});

// Search route
app.get('/api/search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, data: [] });
    const { rows } = await sql`SELECT f.*, u.username as uploader_name FROM files f LEFT JOIN users u ON f.uploaded_by = u.id WHERE f.original_name LIKE ${`%${q}%`} AND f.status != 'invalid' ORDER BY f.uploaded_at DESC LIMIT 50`;
    res.json({ success: true, data: rows });
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
