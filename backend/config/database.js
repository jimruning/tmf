const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Vercel 使用 /tmp 目录，本地开发使用 backend 目录
const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const dbDir = isVercel ? '/tmp' : path.join(__dirname, '..');
const dbPath = path.join(dbDir, 'tmf.db');

// 确保目录存在
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 如果是 Vercel 环境且数据库不存在，从模板复制
if (isVercel && !fs.existsSync(dbPath)) {
  const templatePath = path.join(__dirname, '..', 'tmf.db');
  if (fs.existsSync(templatePath)) {
    fs.copyFileSync(templatePath, dbPath);
  }
}

const db = new Database(dbPath);

// 启用 WAL 模式以提高并发性能
db.pragma('journal_mode = WAL');

// 创建表
const createTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      account_type TEXT DEFAULT 'site',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      zone TEXT NOT NULL,
      zone_en TEXT,
      section TEXT NOT NULL,
      section_en TEXT,
      artifact TEXT NOT NULL,
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
      invalidated_at DATETIME,
      FOREIGN KEY (folder_id) REFERENCES folders(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id),
      FOREIGN KEY (deleted_by) REFERENCES users(id),
      FOREIGN KEY (reviewed_by) REFERENCES users(id),
      FOREIGN KEY (invalidated_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
    CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);
    CREATE INDEX IF NOT EXISTS idx_files_is_deleted ON files(is_deleted);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
  `);
};

createTables();

module.exports = db;
