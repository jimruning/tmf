const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { zoneCn, sectionCn, artifactCn } = require('./tmf-translations');

const dbPath = path.join(__dirname, '..', 'tmf.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

console.log('初始化 TMF 数据库...');

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
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
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
    description TEXT,
    status TEXT DEFAULT 'uploaded',
    reviewed_by INTEGER,
    reviewed_at DATETIME,
    review_comment TEXT,
    FOREIGN KEY (folder_id) REFERENCES folders(id),
    FOREIGN KEY (uploaded_by) REFERENCES users(id),
    FOREIGN KEY (deleted_by) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
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
  CREATE INDEX IF NOT EXISTS idx_folders_project ON folders(project_id);
  CREATE INDEX IF NOT EXISTS idx_folders_zone ON folders(zone);
  CREATE INDEX IF NOT EXISTS idx_folders_section ON folders(section);
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  CREATE INDEX IF NOT EXISTS idx_users_project ON users(project_id);
`);

// 创建默认管理员
const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!existingAdmin) {
  const passwordHash = bcrypt.hashSync('admin123', 10);
  db.prepare(
    'INSERT INTO users (username, real_name, email, password_hash, role, account_type) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('admin', '系统管理员', 'admin@tmf.local', passwordHash, 'admin', 'internal');
  console.log('默认管理员已创建: admin / admin123');
}

// 导入 TMF 模板文件夹结构（project_id = NULL 表示模板）
const fodesPath = path.join(__dirname, '..', '..', 'fodes.txt');
if (fs.existsSync(fodesPath)) {
  const content = fs.readFileSync(fodesPath, 'utf-8');
  const lines = content.trim().split('\n');

  const existingTemplate = db.prepare('SELECT COUNT(*) as count FROM folders WHERE project_id IS NULL').get();
  if (existingTemplate.count === 0) {
    const insertFolder = db.prepare(
      `INSERT INTO folders (project_id, zone, zone_cn, zone_en, section, section_cn, section_en, artifact, artifact_cn, artifact_en, level) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 3)`
    );

    const insertMany = db.transaction((folders) => {
      for (const folder of folders) {
        insertFolder.run(...folder);
      }
    });

    const foldersToInsert = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split('\t').map(s => s.trim());
      if (parts.length >= 6) {
        const [, zoneEn, , sectionEn, , artifactEn] = parts;
        if (zoneEn && sectionEn && artifactEn) {
          foldersToInsert.push([
            null,
            zoneEn, zoneCn[zoneEn] || '', zoneEn,
            sectionEn, sectionCn[sectionEn] || '', sectionEn,
            artifactEn, artifactCn[artifactEn] || '', artifactEn
          ]);
        }
      }
    }

    if (foldersToInsert.length > 0) {
      insertMany(foldersToInsert);
      console.log(`已导入 ${foldersToInsert.length} 个 TMF 模板文件夹`);
    }
  } else {
    console.log('TMF 模板文件夹已存在，跳过导入');
  }
}

// 创建默认项目并生成 TMF 文件夹结构
const existingProject = db.prepare('SELECT id FROM projects LIMIT 1').get();
if (!existingProject) {
  const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  const createdBy = adminUser ? adminUser.id : 1;

  const projectResult = db.prepare(
    'INSERT INTO projects (name, name_en, sponsor, protocol_number, phase, therapeutic_area, principal_investigator, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    '示例临床试验项目',
    'Demo Clinical Trial Project',
    'XX制药有限公司',
    'DEMO-2024-001',
    'III',
    '肿瘤学',
    '张教授',
    createdBy
  );

  const projectId = projectResult.lastInsertRowid;
  console.log(`默认项目已创建: 示例临床试验项目 (ID: ${projectId})`);

  // 复制 TMF 模板文件夹到该项目
  const templateFolders = db.prepare('SELECT * FROM folders WHERE project_id IS NULL AND is_active = 1').all();
  
  if (templateFolders.length > 0) {
    const insertProjectFolder = db.prepare(
      'INSERT INTO folders (project_id, zone, zone_cn, zone_en, section, section_cn, section_en, artifact, artifact_cn, artifact_en, level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    const insertMany = db.transaction((folders) => {
      for (const folder of folders) {
        insertProjectFolder.run(
          projectId,
          folder.zone, folder.zone_cn, folder.zone_en,
          folder.section, folder.section_cn, folder.section_en,
          folder.artifact, folder.artifact_cn, folder.artifact_en,
          folder.level
        );
      }
    });

    const projectFolders = templateFolders.map(f => ({
      zone: f.zone, zone_cn: f.zone_cn, zone_en: f.zone_en,
      section: f.section, section_cn: f.section_cn, section_en: f.section_en,
      artifact: f.artifact, artifact_cn: f.artifact_cn, artifact_en: f.artifact_en,
      level: f.level
    }));

    insertMany(projectFolders);
    console.log(`已为默认项目生成 ${projectFolders.length} 个 TMF 文件夹`);
  }
} else {
  console.log('项目已存在，跳过默认项目创建');
}

db.close();
console.log('数据库初始化完成!');
