const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

let dbInstance = null;

const getDb = () => {
  if (dbInstance) return dbInstance;

  // Vercel 使用 /tmp 目录存储数据库（可读写）
  const dbDir = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(__dirname, '..', 'backend');
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'tmf.db');
  
  // 如果是生产环境且数据库不存在，从模板复制
  if (process.env.NODE_ENV === 'production' && !fs.existsSync(dbPath)) {
    const templatePath = path.join(__dirname, '..', 'backend', 'tmf.db');
    if (fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, dbPath);
    }
  }

  dbInstance = new Database(dbPath);
  dbInstance.pragma('journal_mode = WAL');
  
  // 确保表存在
  createTables(dbInstance);
  
  return dbInstance;
};

const createTables = (db) => {
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
      description TEXT,
      status TEXT DEFAULT 'uploaded',
      reviewed_by INTEGER,
      reviewed_at DATETIME,
      review_comment TEXT
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
    CREATE INDEX IF NOT EXISTS idx_folders_zone ON folders(zone);
    CREATE INDEX IF NOT EXISTS idx_folders_section ON folders(section);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_project ON users(project_id);
  `);
};

// 导出 db getter
module.exports = { getDb };
