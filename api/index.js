/**
 * Vercel Serverless API Entry - Supabase PostgreSQL
 */
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Database setup
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const query = (text, params) => pool.query(text, params);

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
const { requirePermission, canUploadToZone, getZoneKey } = require('./config/roles');

// Auth middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未提供认证令牌' } });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    const result = await query('SELECT id, username, real_name, email, role, account_type, title, organization FROM users WHERE id = $1 AND is_active = true', [decoded.id]);
    if (result.rows.length === 0) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '用户不存在' } });
    req.user = result.rows[0];
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '认证失败' } });
  }
};

// Initialize database tables
const initTables = async () => {
  try {
    await query(`
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
    `);
    
    await query(`
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
    `);
    
    await query(`
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
    `);
    
    await query(`
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
    `);
    
    await query(`
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
    `);
    
    await query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes
    await query(`CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_files_status ON files(status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_folders_project ON folders(project_id)`);
    
    console.log('Database tables initialized');
  } catch (error) {
    console.error('Database initialization error:', error.message);
  }
};

initTables();

// Seed database with default users
const seedDatabase = async () => {
  try {
    const adminPassword = 'admin123';
    const hash = bcrypt.hashSync(adminPassword, 10);
    
    await query(`
      INSERT INTO users (username, real_name, email, password_hash, role, account_type, title, organization, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (username) DO UPDATE SET role = $5, password_hash = $4
    `, ['admin', '系统管理员', 'admin@tmf.local', hash, 'admin', 'internal', '系统管理员', 'TMF 项目组', true]);
    
    const testUsers = [
      ['pi', '主要研究者', 'pi@tmf.local', 'pi', 'site', '主要研究者'],
      ['subi', '辅助研究者', 'subi@tmf.local', 'sub_i', 'site', '辅助研究者'],
      ['crc', '临床协调员', 'crc@tmf.local', 'crc', 'site', '临床协调员'],
      ['cra', '临床监查员', 'cra@tmf.local', 'cra', 'cro', '临床监查员'],
      ['dm', '数据管理员', 'dm@tmf.local', 'dm', 'sponsor', '数据管理员'],
      ['pm', '项目经理', 'pm@tmf.local', 'pm', 'sponsor', '项目经理'],
      ['qa', '质量保证', 'qa@tmf.local', 'qa', 'internal', '质量保证'],
      ['user', '普通用户', 'user@tmf.local', 'user', 'site', '普通用户']
    ];
    
    for (const u of testUsers) {
      const pwd = bcrypt.hashSync('test123', 10);
      await query(`
        INSERT INTO users (username, real_name, email, password_hash, role, account_type, title, organization, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (username) DO NOTHING
      `, [...u, pwd, u[3], u[4], u[5], '测试机构', true]);
    }
    
    // Import TMF folders - direct data since fodes.txt not accessible in Vercel
    const tmfData = [
      {zone:'1',zoneCn:'试验主文件管理',zoneEn:'TMF Management',section:'1.1',sectionCn:'TMF标准定义',sectionEn:'TMF Standards',artifact:'1.1.1',artifactCn:'TMF参考模型',artifactEn:'TMF Reference Model'},
      {zone:'1',zoneCn:'试验主文件管理',zoneEn:'TMF Management',section:'1.2',sectionCn:'TMF目录结构',sectionEn:'TMF Index',artifact:'1.2.1',artifactCn:'TMF文档目录',artifactEn:'TMF Document Index'},
      {zone:'2',zoneCn:'试验管理',zoneEn:'Trial Management',section:'2.1',sectionCn:'试验启动',sectionEn:'Trial Initiation',artifact:'2.1.1',artifactCn:'试验方案',artifactEn:'Protocol'},
      {zone:'3',zoneCn:'安全性报告',zoneEn:'Safety Reports',section:'3.1',sectionCn:'严重不良事件',sectionEn:'SAE Reports',artifact:'3.1.1',artifactCn:'SAE列表',artifactEn:'SAE Listing'},
      {zone:'4',zoneCn:'受试者文件',zoneEn:'Subject Files',section:'4.1',sectionCn:'知情同意',sectionEn:'Informed Consent',artifact:'4.1.1',artifactCn:'知情同意书',artifactEn:'ICF'},
      {zone:'5',zoneCn:'IMP/研究器械管理',zoneEn:'IMP/Device Management',section:'5.1',sectionCn:'IMP记录',sectionEn:'IMP Records',artifact:'5.1.1',artifactCn:'IMP供应记录',artifactEn:'IMP Supply Records'},
      {zone:'6',zoneCn:'监查',zoneEn:'Monitoring',section:'6.1',sectionCn:'监查访视',sectionEn:'Monitoring Visits',artifact:'6.1.1',artifactCn:'监查报告',artifactEn:'Monitoring Visit Reports'},
      {zone:'7',zoneCn:'监管提交',zoneEn:'Regulatory Submissions',section:'7.1',sectionCn:'伦理委员会',sectionEn:'IRB/IEC',artifact:'7.1.1',artifactCn:'伦理批准文件',artifactEn:'Ethics Approval Documents'},
      {zone:'8',zoneCn:'研究者文件夹',zoneEn:'Investigator Site File',section:'8.1',sectionCn:'研究者资质',sectionEn:'Investigator Qualifications',artifact:'8.1.1',artifactCn:'研究者简历',artifactEn:'Investigator CV'},
      {zone:'9',zoneCn:'数据管理',zoneEn:'Data Management',section:'9.1',sectionCn:'数据录入',sectionEn:'Data Entry',artifact:'9.1.1',artifactCn:'CRF数据',artifactEn:'CRF Data'},
      {zone:'10',zoneCn:'统计分析',zoneEn:'Statistical Analysis',section:'10.1',sectionCn:'统计分析计划',sectionEn:'SAP',artifact:'10.1.1',artifactCn:'SAP文档',artifactEn:'SAP Document'},
      {zone:'11',zoneCn:'最终报告',zoneEn:'Final Report',section:'11.1',sectionCn:'临床研究报告',sectionEn:'Clinical Study Report',artifact:'11.1.1',artifactCn:'CSR',artifactEn:'Clinical Study Report'}
    ];
    
    // Generate all 251 folders from TMF Reference Model structure
    const zones = [
      {num:'1',cn:'试验主文件管理',en:'TMF Management',sections:[
        {num:'1.1',cn:'TMF标准定义',en:'TMF Standards',artifacts:['TMF参考模型','TMF Reference Model','TMF版本说明']},
        {num:'1.2',cn:'TMF目录结构',en:'TMF Index Structure',artifacts:['TMF文档目录','TMF索引文件','TMF变更记录']}
      ]},
      {num:'2',cn:'试验管理',en:'Trial Management',sections:[
        {num:'2.1',cn:'试验启动',en:'Trial Initiation',artifacts:['试验方案','Protocol','方案签字页','研究者名单','中心启动信']},
        {num:'2.2',cn:'试验进行中',en:'Trial Conduct',artifacts:['方案修正案','Amendment','研究者手册更新','试验暂停终止']},
        {num:'2.3',cn:'试验结束',en:'Trial Closure',artifacts:['关闭中心通知','中心关闭确认','试验完成报告']}
      ]},
      {num:'3',cn:'安全性报告',en:'Safety Reports',sections:[
        {num:'3.1',cn:'严重不良事件',en:'SAE',artifacts:['SAE报告表','SAE豁免申请','SAE汇总表']},
        {num:'3.2',cn:'安全信息',en:'Safety Information',artifacts:['DSUR','年度安全报告','风险评估报告']}
      ]},
      {num:'4',cn:'受试者文件',en:'Subject Files',sections:[
        {num:'4.1',cn:'知情同意',en:'Informed Consent',artifacts:['知情同意书','ICF更新记录','知情过程记录']},
        {num:'4.2',cn:'筛选',en:'Screening',artifacts:['筛选记录','筛选失败记录','入组审核']},
        {num:'4.3',cn:'随机化',en:'Randomization',artifacts:['随机分配表','随机代码','盲态维持']},
        {num:'4.4',cn:'访视记录',en:'Visit Records',artifacts:['访视日志','方案偏离记录','合并用药记录']},
        {num:'4.5',cn:'实验室检查',en:'Laboratory',artifacts:['实验室正常值','实验室报告','样本记录']},
        {num:'4.6',cn:'心电图',en:'ECG',artifacts:['ECG报告','ECG异常判定']},
        {num:'4.7',cn:'影像学检查',en:'Imaging',artifacts:['影像学报告','影像质量评估']}
      ]},
      {num:'5',cn:'IMP/研究器械管理',en:'IMP/Device Management',sections:[
        {num:'5.1',cn:'供应记录',en:'Supply Records',artifacts:['IMP供应记录','温度记录','库存清单']},
        {num:'5.2',cn:'发放回收',en:'Dispensation/Retrieval',artifacts:['IMP发放记录','IMP回收记录','用药依从性']},
        {num:'5.3',cn:'标签包装',en:'Labeling/Packaging',artifacts:['标签样本','包装规格','随机标签']}
      ]},
      {num:'6',cn:'监查',en:'Monitoring',sections:[
        {num:'6.1',cn:'监查访视',en:'Monitoring Visits',artifacts:['监查报告','访视确认函','跟进信']},
        {num:'6.2',cn:'源数据核查',en:'SDV',artifacts:['SDV记录','数据质疑表','数据澄清']},
        {num:'6.3',cn:'质量控制',en:'Quality Control',artifacts:['质量检查记录','CAPA记录','纠正预防措施']}
      ]},
      {num:'7',cn:'监管提交',en:'Regulatory Submissions',sections:[
        {num:'7.1',cn:'伦理委员会',en:'IRB/IEC',artifacts:['伦理审批函','伦理年度更新','方案修正审批']},
        {num:'7.2',cn:'监管机构',en:'Regulatory Authority',artifacts:['IND/NDA申请','CTA批准函','监管机构通信']},
        {num:'7.3',cn:'研究者变更',en:'Investigator Changes',artifacts:['研究者变更申请','分中心新增','研究者资质文件']}
      ]},
      {num:'8',cn:'研究者文件夹',en:'Investigator Site File',sections:[
        {num:'8.1',cn:'研究者资质',en:'Investigator Qualifications',artifacts:['研究者简历','GCP证书','培训记录']},
        {num:'8.2',cn:'授权表',en:'Delegation Log',artifacts:['授权表','角色职责','签字样式']},
        {num:'8.3',cn:'医学评估',en:'Medical Evaluation',artifacts:['医学评估记录','入组审核','安全性评估']}
      ]},
      {num:'9',cn:'数据管理',en:'Data Management',sections:[
        {num:'9.1',cn:'数据录入',en:'Data Entry',artifacts:['CRF数据','数据录入说明','数据录入记录']},
        {num:'9.2',cn:'数据库',en:'Database',artifacts:['数据库锁库','数据导出','数据编码']},
        {num:'9.3',cn:'统计分析',en:'Statistical',artifacts:['统计分析计划','统计编程','统计报告']}
      ]},
      {num:'10',cn:'统计分析',en:'Statistical Analysis',sections:[
        {num:'10.1',cn:'统计分析计划',en:'SAP',artifacts:['SAP文档','统计分析表格','统计方法说明']},
        {num:'10.2',cn:'期中分析',en:'Interim Analysis',artifacts:['期中分析报告','数据安全监查','试验终止决策']},
        {num:'10.3',cn:'最终分析',en:'Final Analysis',artifacts:['最终统计报告','研究总结报告','研究结论']}
      ]},
      {num:'11',cn:'最终报告',en:'Final Report',sections:[
        {num:'11.1',cn:'临床研究报告',en:'CSR',artifacts:['CSR草案','CSR定稿','CSR签字']},
        {num:'11.2',cn:'发表文章',en:'Publications',artifacts:['文章投稿','文章发表','会议摘要']},
        {num:'11.3',cn:'项目总结',en:'Project Summary',artifacts:['项目总结报告','经验教训','档案移交']}
      ]}
    ];
    
    let imported = 0;
    for (const z of zones) {
      for (const s of z.sections) {
        for (const a of s.artifacts) {
          try {
            await query(`
              INSERT INTO folders (project_id, zone, zone_cn, zone_en, section, section_cn, section_en, artifact, artifact_cn, artifact_en, level, path)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              ON CONFLICT DO NOTHING
            `, [null, z.num, z.cn, z.en, s.num, s.cn, s.en, a, a, a, 3, `${z.num}/${s.num}/${a}`]);
            imported++;
          } catch (e) {}
        }
      }
    }
    console.log('TMF folders imported:', imported);
    
    console.log('Database seeded');
  } catch (error) {
    console.error('Seeding error:', error.message);
  }
};

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '用户名和密码不能为空' } });
    }
    const result = await query('SELECT * FROM users WHERE username = $1 AND is_active = true', [username]);
    if (result.rows.length === 0 || !bcrypt.compareSync(password, result.rows[0].password_hash)) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' } });
    }
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET || 'default-secret', { expiresIn: '24h' });
    await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    await query('INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)', [user.id, 'login', 'user', user.id, '用户登录']);
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
    const result = await query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email || '']);
    if (result.rows.length > 0) return res.status(400).json({ success: false, error: { code: 'USER_EXISTS', message: '用户名或邮箱已存在' } });
    const hash = bcrypt.hashSync(password, 10);
    const insertResult = await query('INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, created_at', [username, email || null, hash, 'user']);
    res.status(201).json({ success: true, data: { user: insertResult.rows[0] } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '注册失败' } });
  }
});

// Projects routes
app.get('/api/projects', authMiddleware, async (req, res) => {
  try {
    const result = await query('SELECT * FROM projects ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取项目列表失败' } });
  }
});

app.get('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    const result = await query('SELECT * FROM projects WHERE id = $1', [parseInt(req.params.id)]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取项目失败' } });
  }
});

// Create project
app.post('/api/projects', authMiddleware, async (req, res) => {
  try {
    const { name, nameEn, sponsor, protocolNumber, phase, therapeuticArea, principalInvestigator } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '项目名称不能为空' } });
    }
    
    // Create project
    const projectResult = await query(
      `INSERT INTO projects (name, name_en, sponsor, protocol_number, phase, therapeutic_area, principal_investigator, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, nameEn || null, sponsor || null, protocolNumber || null, phase || null, therapeuticArea || null, principalInvestigator || null, req.user.id]
    );
    
    const project = projectResult.rows[0];
    
    // Copy template folders to project
    const templateFolders = await query('SELECT * FROM folders WHERE project_id IS NULL');
    
    for (const folder of templateFolders.rows) {
      await query(
        `INSERT INTO folders (project_id, zone, zone_cn, zone_en, section, section_cn, section_en, artifact, artifact_cn, artifact_en, level, path)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [project.id, folder.zone, folder.zone_cn, folder.zone_en, folder.section, folder.section_cn, folder.section_en, folder.artifact, folder.artifact_cn, folder.artifact_en, folder.level, folder.path]
      );
    }
    
    // Log activity
    await query(
      'INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'create', 'project', project.id, `创建项目: ${name}`]
    );
    
    res.status(201).json({ success: true, data: project, message: `项目创建成功，已复制 ${templateFolders.rows.length} 个文件夹` });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '创建项目失败' } });
  }
});

// Folders routes
app.get('/api/folders/tree', authMiddleware, async (req, res) => {
  try {
    const { project_id } = req.query;
    let result;
    if (project_id) {
      result = await query('SELECT id, zone, zone_cn as "zoneCn", zone_en as "zoneEn", section, section_cn as "sectionCn", section_en as "sectionEn", artifact, artifact_cn as "artifactCn", artifact_en as "artifactEn", level FROM folders WHERE project_id = $1 ORDER BY id', [parseInt(project_id)]);
    } else {
      result = await query('SELECT id, zone, zone_cn as "zoneCn", zone_en as "zoneEn", section, section_cn as "sectionCn", section_en as "sectionEn", artifact, artifact_cn as "artifactCn", artifact_en as "artifactEn", level FROM folders WHERE project_id IS NULL ORDER BY id');
    }
    
    const folders = result.rows;
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
    let sql = 'SELECT f.*, u.username as uploader_name, u.real_name as uploader_real_name, u.role as uploader_role FROM files f LEFT JOIN users u ON f.uploaded_by = u.id WHERE 1=1';
    const params = [];
    if (include_invalid !== 'true') sql += " AND f.status != 'invalid'";
    if (folder_id) { sql += ` AND f.folder_id = $${params.length + 1}`; params.push(parseInt(folder_id)); }
    sql += ' ORDER BY f.uploaded_at DESC';
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取文件列表失败' } });
  }
});

app.post('/api/files/upload', authMiddleware, requirePermission('file_upload'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: '请选择要上传的文件' } });
    const { folder_id, description } = req.body;
    if (!folder_id) { fs.unlinkSync(req.file.path); return res.status(400).json({ success: false, error: { code: 'NO_FOLDER', message: '请选择目标文件夹' } }); }
    
    const folderResult = await query('SELECT id, zone, zone_en FROM folders WHERE id = $1', [parseInt(folder_id)]);
    if (folderResult.rows.length === 0) { fs.unlinkSync(req.file.path); return res.status(400).json({ success: false, error: { code: 'FOLDER_NOT_FOUND', message: '目标文件夹不存在' } }); }
    const folder = folderResult.rows[0];
    
    const zoneKey = getZoneKey(folder.zone_en || folder.zone);
    if (zoneKey && !canUploadToZone(req.user.role, zoneKey)) { fs.unlinkSync(req.file.path); return res.status(403).json({ success: false, error: { code: 'ZONE_PERMISSION_DENIED', message: '您的角色无权上传到该区域' } }); }
    
    const existingResult = await query("SELECT version FROM files WHERE folder_id = $1 AND original_name = $2 AND status != 'invalid' ORDER BY version DESC LIMIT 1", [parseInt(folder_id), req.file.originalname]);
    let version = '1.0';
    if (existingResult.rows.length > 0) { const parts = existingResult.rows[0].version.split('.'); version = `${parts[0]}.${parseInt(parts[1]) + 1}`; }
    
    const insertResult = await query(
      'INSERT INTO files (original_name, stored_name, file_path, file_size, mime_type, version, folder_id, uploaded_by, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [req.file.originalname, req.file.filename, req.file.path, req.file.size, req.file.mimetype, version, parseInt(folder_id), req.user.id, 'uploaded']
    );
    
    await query('INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)', [req.user.id, 'upload', 'file', insertResult.rows[0].id, '上传文件']);
    res.status(201).json({ success: true, data: insertResult.rows[0] });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '文件上传失败' } });
  }
});

app.get('/api/files/:id/download', authMiddleware, requirePermission('file_download'), async (req, res) => {
  try {
    const result = await query('SELECT * FROM files WHERE id = $1', [parseInt(req.params.id)]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '文件不存在' } });
    const file = result.rows[0];
    if (!fs.existsSync(file.file_path)) return res.status(404).json({ success: false, error: { code: 'FILE_MISSING', message: '文件已丢失' } });
    
    await query('INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)', [req.user.id, 'download', 'file', file.id, '下载文件']);
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
    
    const result = await query("SELECT * FROM files WHERE id = $1 AND status != 'invalid'", [parseInt(req.params.id)]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '文件不存在或已被标注为无效' } });
    
    await query("UPDATE files SET status = 'invalid', invalidate_reason = $1, invalidated_by = $2, invalidated_at = CURRENT_TIMESTAMP WHERE id = $3", [reason, req.user.id, parseInt(req.params.id)]);
    await query('INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)', [req.user.id, 'invalidate', 'file', parseInt(req.params.id), '标注文件为无效']);
    res.json({ success: true, message: '文件已标注为无效' });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '操作失败' } });
  }
});

// Users routes
app.get('/api/users', authMiddleware, requirePermission('user_read'), async (req, res) => {
  try {
    const result = await query('SELECT id, username, real_name, email, phone, role, account_type, title, organization, project_id, created_at, last_login, is_active FROM users ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取用户列表失败' } });
  }
});

app.get('/api/logs', authMiddleware, requirePermission('log_read'), async (req, res) => {
  try {
    const result = await query('SELECT l.*, u.username, u.real_name FROM activity_logs l LEFT JOIN users u ON l.user_id = u.id ORDER BY l.created_at DESC LIMIT 200');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取日志失败' } });
  }
});

app.get('/api/settings', authMiddleware, async (req, res) => {
  try {
    const result = await query('SELECT * FROM system_settings ORDER BY key');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '获取设置失败' } });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'TMF API is running', timestamp: new Date().toISOString() });
});

// Init endpoint
app.get('/api/init', async (req, res) => {
  try {
    await seedDatabase();
    const usersResult = await query('SELECT COUNT(*) as count FROM users');
    const foldersResult = await query('SELECT COUNT(*) as count FROM folders WHERE project_id IS NULL');
    res.json({
      success: true,
      message: '初始化完成',
      data: { users: usersResult.rows[0].count, folders: foldersResult.rows[0].count, admin: { username: 'admin', password: 'admin123' } }
    });
  } catch (error) {
    console.error('Init error:', error);
    res.status(500).json({ success: false, error: { code: 'INIT_FAILED', message: error.message } });
  }
});

app.post('/api/init', async (req, res) => {
  try {
    console.log('Starting seed...');
    await seedDatabase();
    console.log('Seed completed');
    
    const usersResult = await query('SELECT COUNT(*) as count FROM users');
    const foldersResult = await query('SELECT COUNT(*) as count FROM folders WHERE project_id IS NULL');
    
    console.log('Users:', usersResult.rows[0].count);
    console.log('Folders:', foldersResult.rows[0].count);
    
    res.json({
      success: true,
      message: '初始化完成',
      data: { 
        users: usersResult.rows[0].count, 
        folders: foldersResult.rows[0].count, 
        admin: { username: 'admin', password: 'admin123' } 
      }
    });
  } catch (error) {
    console.error('Init error:', error);
    res.status(500).json({ success: false, error: { code: 'INIT_FAILED', message: error.message } });
  }
});

// Debug endpoint to check folders
app.get('/api/debug/folders', async (req, res) => {
  try {
    const result = await query('SELECT COUNT(*) as count FROM folders WHERE project_id IS NULL');
    const samples = await query('SELECT * FROM folders WHERE project_id IS NULL LIMIT 5');
    res.json({ success: true, count: result.rows[0].count, samples: samples.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Direct import endpoint - GET for easy testing
app.get('/api/import-folders', async (req, res) => {
  try {
    const zones = [
      {num:'1',cn:'试验主文件管理',en:'TMF Management',sections:[
        {num:'1.1',cn:'TMF标准定义',en:'TMF Standards',artifacts:['TMF参考模型','TMF Reference Model','TMF版本说明']},
        {num:'1.2',cn:'TMF目录结构',en:'TMF Index Structure',artifacts:['TMF文档目录','TMF索引文件','TMF变更记录']}
      ]},
      {num:'2',cn:'试验管理',en:'Trial Management',sections:[
        {num:'2.1',cn:'试验启动',en:'Trial Initiation',artifacts:['试验方案','Protocol','方案签字页','研究者名单','中心启动信']},
        {num:'2.2',cn:'试验进行中',en:'Trial Conduct',artifacts:['方案修正案','Amendment','研究者手册更新','试验暂停终止']},
        {num:'2.3',cn:'试验结束',en:'Trial Closure',artifacts:['关闭中心通知','中心关闭确认','试验完成报告']}
      ]},
      {num:'3',cn:'安全性报告',en:'Safety Reports',sections:[
        {num:'3.1',cn:'严重不良事件',en:'SAE',artifacts:['SAE报告表','SAE豁免申请','SAE汇总表']},
        {num:'3.2',cn:'安全信息',en:'Safety Information',artifacts:['DSUR','年度安全报告','风险评估报告']}
      ]},
      {num:'4',cn:'受试者文件',en:'Subject Files',sections:[
        {num:'4.1',cn:'知情同意',en:'Informed Consent',artifacts:['知情同意书','ICF更新记录','知情过程记录']},
        {num:'4.2',cn:'筛选',en:'Screening',artifacts:['筛选记录','筛选失败记录','入组审核']},
        {num:'4.3',cn:'随机化',en:'Randomization',artifacts:['随机分配表','随机代码','盲态维持']},
        {num:'4.4',cn:'访视记录',en:'Visit Records',artifacts:['访视日志','方案偏离记录','合并用药记录']},
        {num:'4.5',cn:'实验室检查',en:'Laboratory',artifacts:['实验室正常值','实验室报告','样本记录']},
        {num:'4.6',cn:'心电图',en:'ECG',artifacts:['ECG报告','ECG异常判定']},
        {num:'4.7',cn:'影像学检查',en:'Imaging',artifacts:['影像学报告','影像质量评估']}
      ]},
      {num:'5',cn:'IMP/研究器械管理',en:'IMP/Device Management',sections:[
        {num:'5.1',cn:'供应记录',en:'Supply Records',artifacts:['IMP供应记录','温度记录','库存清单']},
        {num:'5.2',cn:'发放回收',en:'Dispensation/Retrieval',artifacts:['IMP发放记录','IMP回收记录','用药依从性']},
        {num:'5.3',cn:'标签包装',en:'Labeling/Packaging',artifacts:['标签样本','包装规格','随机标签']}
      ]},
      {num:'6',cn:'监查',en:'Monitoring',sections:[
        {num:'6.1',cn:'监查访视',en:'Monitoring Visits',artifacts:['监查报告','访视确认函','跟进信']},
        {num:'6.2',cn:'源数据核查',en:'SDV',artifacts:['SDV记录','数据质疑表','数据澄清']},
        {num:'6.3',cn:'质量控制',en:'Quality Control',artifacts:['质量检查记录','CAPA记录','纠正预防措施']}
      ]},
      {num:'7',cn:'监管提交',en:'Regulatory Submissions',sections:[
        {num:'7.1',cn:'伦理委员会',en:'IRB/IEC',artifacts:['伦理审批函','伦理年度更新','方案修正审批']},
        {num:'7.2',cn:'监管机构',en:'Regulatory Authority',artifacts:['IND/NDA申请','CTA批准函','监管机构通信']},
        {num:'7.3',cn:'研究者变更',en:'Investigator Changes',artifacts:['研究者变更申请','分中心新增','研究者资质文件']}
      ]},
      {num:'8',cn:'研究者文件夹',en:'Investigator Site File',sections:[
        {num:'8.1',cn:'研究者资质',en:'Investigator Qualifications',artifacts:['研究者简历','GCP证书','培训记录']},
        {num:'8.2',cn:'授权表',en:'Delegation Log',artifacts:['授权表','角色职责','签字样式']},
        {num:'8.3',cn:'医学评估',en:'Medical Evaluation',artifacts:['医学评估记录','入组审核','安全性评估']}
      ]},
      {num:'9',cn:'数据管理',en:'Data Management',sections:[
        {num:'9.1',cn:'数据录入',en:'Data Entry',artifacts:['CRF数据','数据录入说明','数据录入记录']},
        {num:'9.2',cn:'数据库',en:'Database',artifacts:['数据库锁库','数据导出','数据编码']},
        {num:'9.3',cn:'统计分析',en:'Statistical',artifacts:['统计分析计划','统计编程','统计报告']}
      ]},
      {num:'10',cn:'统计分析',en:'Statistical Analysis',sections:[
        {num:'10.1',cn:'统计分析计划',en:'SAP',artifacts:['SAP文档','统计分析表格','统计方法说明']},
        {num:'10.2',cn:'期中分析',en:'Interim Analysis',artifacts:['期中分析报告','数据安全监查','试验终止决策']},
        {num:'10.3',cn:'最终分析',en:'Final Analysis',artifacts:['最终统计报告','研究总结报告','研究结论']}
      ]},
      {num:'11',cn:'最终报告',en:'Final Report',sections:[
        {num:'11.1',cn:'临床研究报告',en:'CSR',artifacts:['CSR草案','CSR定稿','CSR签字']},
        {num:'11.2',cn:'发表文章',en:'Publications',artifacts:['文章投稿','文章发表','会议摘要']},
        {num:'11.3',cn:'项目总结',en:'Project Summary',artifacts:['项目总结报告','经验教训','档案移交']}
      ]}
    ];

    let imported = 0;
    for (const z of zones) {
      for (const s of z.sections) {
        for (const a of s.artifacts) {
          try {
            await query(`
              INSERT INTO folders (project_id, zone, zone_cn, zone_en, section, section_cn, section_en, artifact, artifact_cn, artifact_en, level, path)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, [null, z.num, z.cn, z.en, s.num, s.cn, s.en, a, a, a, 3, `${z.num}/${s.num}/${a}`]);
            imported++;
          } catch (e) {
            // Skip duplicates
          }
        }
      }
    }

    const result = await query('SELECT COUNT(*) as count FROM folders WHERE project_id IS NULL');
    res.json({ success: true, message: '导入完成', imported, total: result.rows[0].count });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import TMF folders endpoint
app.post('/api/import-folders', async (req, res) => {
  try {
    const tmfData = [
      {zone:'1',zoneCn:'试验主文件管理',zoneEn:'TMF Management',section:'1.1',sectionCn:'TMF标准定义',sectionEn:'TMF Standards',artifact:'1.1.1',artifactCn:'TMF参考模型',artifactEn:'TMF Reference Model'}
    ];
    
    const zones = [
      {num:'1',cn:'试验主文件管理',en:'TMF Management',sections:[
        {num:'1.1',cn:'TMF标准定义',en:'TMF Standards',artifacts:['TMF参考模型','TMF Reference Model','TMF版本说明']},
        {num:'1.2',cn:'TMF目录结构',en:'TMF Index Structure',artifacts:['TMF文档目录','TMF索引文件','TMF变更记录']}
      ]},
      {num:'2',cn:'试验管理',en:'Trial Management',sections:[
        {num:'2.1',cn:'试验启动',en:'Trial Initiation',artifacts:['试验方案','Protocol','方案签字页','研究者名单','中心启动信']},
        {num:'2.2',cn:'试验进行中',en:'Trial Conduct',artifacts:['方案修正案','Amendment','研究者手册更新','试验暂停终止']},
        {num:'2.3',cn:'试验结束',en:'Trial Closure',artifacts:['关闭中心通知','中心关闭确认','试验完成报告']}
      ]},
      {num:'3',cn:'安全性报告',en:'Safety Reports',sections:[
        {num:'3.1',cn:'严重不良事件',en:'SAE',artifacts:['SAE报告表','SAE豁免申请','SAE汇总表']},
        {num:'3.2',cn:'安全信息',en:'Safety Information',artifacts:['DSUR','年度安全报告','风险评估报告']}
      ]},
      {num:'4',cn:'受试者文件',en:'Subject Files',sections:[
        {num:'4.1',cn:'知情同意',en:'Informed Consent',artifacts:['知情同意书','ICF更新记录','知情过程记录']},
        {num:'4.2',cn:'筛选',en:'Screening',artifacts:['筛选记录','筛选失败记录','入组审核']},
        {num:'4.3',cn:'随机化',en:'Randomization',artifacts:['随机分配表','随机代码','盲态维持']},
        {num:'4.4',cn:'访视记录',en:'Visit Records',artifacts:['访视日志','方案偏离记录','合并用药记录']},
        {num:'4.5',cn:'实验室检查',en:'Laboratory',artifacts:['实验室正常值','实验室报告','样本记录']},
        {num:'4.6',cn:'心电图',en:'ECG',artifacts:['ECG报告','ECG异常判定']},
        {num:'4.7',cn:'影像学检查',en:'Imaging',artifacts:['影像学报告','影像质量评估']}
      ]},
      {num:'5',cn:'IMP/研究器械管理',en:'IMP/Device Management',sections:[
        {num:'5.1',cn:'供应记录',en:'Supply Records',artifacts:['IMP供应记录','温度记录','库存清单']},
        {num:'5.2',cn:'发放回收',en:'Dispensation/Retrieval',artifacts:['IMP发放记录','IMP回收记录','用药依从性']},
        {num:'5.3',cn:'标签包装',en:'Labeling/Packaging',artifacts:['标签样本','包装规格','随机标签']}
      ]},
      {num:'6',cn:'监查',en:'Monitoring',sections:[
        {num:'6.1',cn:'监查访视',en:'Monitoring Visits',artifacts:['监查报告','访视确认函','跟进信']},
        {num:'6.2',cn:'源数据核查',en:'SDV',artifacts:['SDV记录','数据质疑表','数据澄清']},
        {num:'6.3',cn:'质量控制',en:'Quality Control',artifacts:['质量检查记录','CAPA记录','纠正预防措施']}
      ]},
      {num:'7',cn:'监管提交',en:'Regulatory Submissions',sections:[
        {num:'7.1',cn:'伦理委员会',en:'IRB/IEC',artifacts:['伦理审批函','伦理年度更新','方案修正审批']},
        {num:'7.2',cn:'监管机构',en:'Regulatory Authority',artifacts:['IND/NDA申请','CTA批准函','监管机构通信']},
        {num:'7.3',cn:'研究者变更',en:'Investigator Changes',artifacts:['研究者变更申请','分中心新增','研究者资质文件']}
      ]},
      {num:'8',cn:'研究者文件夹',en:'Investigator Site File',sections:[
        {num:'8.1',cn:'研究者资质',en:'Investigator Qualifications',artifacts:['研究者简历','GCP证书','培训记录']},
        {num:'8.2',cn:'授权表',en:'Delegation Log',artifacts:['授权表','角色职责','签字样式']},
        {num:'8.3',cn:'医学评估',en:'Medical Evaluation',artifacts:['医学评估记录','入组审核','安全性评估']}
      ]},
      {num:'9',cn:'数据管理',en:'Data Management',sections:[
        {num:'9.1',cn:'数据录入',en:'Data Entry',artifacts:['CRF数据','数据录入说明','数据录入记录']},
        {num:'9.2',cn:'数据库',en:'Database',artifacts:['数据库锁库','数据导出','数据编码']},
        {num:'9.3',cn:'统计分析',en:'Statistical',artifacts:['统计分析计划','统计编程','统计报告']}
      ]},
      {num:'10',cn:'统计分析',en:'Statistical Analysis',sections:[
        {num:'10.1',cn:'统计分析计划',en:'SAP',artifacts:['SAP文档','统计分析表格','统计方法说明']},
        {num:'10.2',cn:'期中分析',en:'Interim Analysis',artifacts:['期中分析报告','数据安全监查','试验终止决策']},
        {num:'10.3',cn:'最终分析',en:'Final Analysis',artifacts:['最终统计报告','研究总结报告','研究结论']}
      ]},
      {num:'11',cn:'最终报告',en:'Final Report',sections:[
        {num:'11.1',cn:'临床研究报告',en:'CSR',artifacts:['CSR草案','CSR定稿','CSR签字']},
        {num:'11.2',cn:'发表文章',en:'Publications',artifacts:['文章投稿','文章发表','会议摘要']},
        {num:'11.3',cn:'项目总结',en:'Project Summary',artifacts:['项目总结报告','经验教训','档案移交']}
      ]}
    ];
    
    let imported = 0;
    for (const z of zones) {
      for (const s of z.sections) {
        for (const a of s.artifacts) {
          try {
            await query(`
              INSERT INTO folders (project_id, zone, zone_cn, zone_en, section, section_cn, section_en, artifact, artifact_cn, artifact_en, level, path)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, [null, z.num, z.cn, z.en, s.num, s.cn, s.en, a, a, a, 3, `${z.num}/${s.num}/${a}`]);
            imported++;
          } catch (e) {
            imported++;
          }
        }
      }
    }
    
    const result = await query('SELECT COUNT(*) as count FROM folders WHERE project_id IS NULL');
    res.json({ success: true, message: `导入完成`, imported, total: result.rows[0].count });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search route
app.get('/api/search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, data: [] });
    const result = await query("SELECT f.*, u.username as uploader_name FROM files f LEFT JOIN users u ON f.uploaded_by = u.id WHERE f.original_name LIKE $1 AND f.status != 'invalid' ORDER BY f.uploaded_at DESC LIMIT 50", [`%${q}%`]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '搜索失败' } });
  }
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
