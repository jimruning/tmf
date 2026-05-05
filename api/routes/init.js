/**
 * 初始化 API - 用于首次设置
 * 访问：POST /api/init
 * 注意：生产环境应该在部署后删除此文件或添加访问限制
 */

const { sql } = require('@vercel/postgres');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const fodesPath = path.join(__dirname, '..', 'fodes.txt');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: '仅支持 POST 方法' } });
  }
  
  try {
    console.log('开始初始化...');
    
    // 1. 创建默认管理员
    const adminPassword = 'admin123';
    const hash = bcrypt.hashSync(adminPassword, 10);
    
    await sql`
      INSERT INTO users (username, real_name, email, password_hash, role, account_type, title, organization, is_active)
      VALUES ('admin', '系统管理员', 'admin@tmf.local', ${hash}, 'admin', 'internal', '系统管理员', 'TMF 项目组', true)
      ON CONFLICT (username) DO UPDATE SET role = 'admin', password_hash = ${hash}
    `;
    console.log('✅ 管理员已创建');
    
    // 2. 创建测试用户
    const testUsers = [
      { username: 'pi', role: 'pi', account_type: 'site', real_name: '主要研究者' },
      { username: 'subi', role: 'sub_i', account_type: 'site', real_name: '辅助研究者' },
      { username: 'crc', role: 'crc', account_type: 'site', real_name: '临床协调员' },
      { username: 'cra', role: 'cra', account_type: 'cro', real_name: '临床监查员' },
      { username: 'dm', role: 'dm', account_type: 'sponsor', real_name: '数据管理员' },
      { username: 'pm', role: 'pm', account_type: 'sponsor', real_name: '项目经理' },
      { username: 'qa', role: 'qa', account_type: 'internal', real_name: '质量保证' },
      { username: 'user', role: 'user', account_type: 'site', real_name: '普通用户' }
    ];
    
    for (const u of testUsers) {
      const pwd = bcrypt.hashSync('test123', 10);
      await sql`
        INSERT INTO users (username, real_name, email, password_hash, role, account_type, title, organization, is_active)
        VALUES (${u.username}, ${u.real_name}, ${u.username + '@tmf.local'}, ${pwd}, ${u.role}, ${u.account_type}, ${u.real_name}, '测试机构', true)
        ON CONFLICT (username) DO NOTHING
      `;
    }
    console.log('✅ 测试用户已创建');
    
    // 3. 导入 TMF 文件夹
    if (fs.existsSync(fodesPath)) {
      const content = fs.readFileSync(fodesPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
      
      for (const line of lines) {
        const [zone, section, artifact, zoneCn, zoneEn, sectionCn, sectionEn, artifactCn, artifactEn] = 
          line.split('|').map(s => s?.trim() || '');
        
        if (!zone || !section) continue;
        
        const level = artifact ? 3 : 1;
        const pathStr = `${zone}/${section}${artifact ? '/' + artifact : ''}`;
        
        await sql`
          INSERT INTO folders (project_id, zone, zone_cn, zone_en, section, section_cn, section_en, artifact, artifact_cn, artifact_en, level, path)
          VALUES (NULL, ${zone}, ${zoneCn||''}, ${zoneEn||''}, ${section}, ${sectionCn||''}, ${sectionEn||''}, ${artifact||''}, ${artifactCn||''}, ${artifactEn||''}, ${level}, ${pathStr})
          ON CONFLICT DO NOTHING
        `;
      }
      console.log('✅ TMF 文件夹已导入');
    }
    
    // 4. 验证
    const { rows: u } = await sql`SELECT COUNT(*) as count FROM users`;
    const { rows: f } = await sql`SELECT COUNT(*) as count FROM folders WHERE project_id IS NULL`;
    
    res.json({
      success: true,
      message: '初始化完成',
      data: {
        users: u[0].count,
        folders: f[0].count,
        admin: { username: 'admin', password: 'admin123' },
        testUsers: '所有测试用户密码均为：test123'
      }
    });
  } catch (error) {
    console.error('初始化错误:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INIT_FAILED', message: '初始化失败：' + error.message }
    });
  }
};
