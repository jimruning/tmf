#!/usr/bin/env node
/**
 * Vercel Postgres 初始化脚本
 * 创建默认管理员账户和 TMF 文件夹模板
 */

const { sql } = require('@vercel/postgres');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const fodesPath = path.join(__dirname, 'fodes.txt');

const initializeDatabase = async () => {
  console.log('正在初始化数据库...');
  
  try {
    // 1. 创建默认管理员账户
    const adminPassword = 'admin123';
    const hash = bcrypt.hashSync(adminPassword, 10);
    
    await sql`
      INSERT INTO users (username, real_name, email, password_hash, role, account_type, title, organization, is_active)
      VALUES (
        'admin',
        '系统管理员',
        'admin@tmf.local',
        ${hash},
        'admin',
        'internal',
        '系统管理员',
        'TMF 项目组',
        true
      )
      ON CONFLICT (username) DO UPDATE SET
        role = 'admin',
        email = 'admin@tmf.local',
        password_hash = ${hash}
    `;
    console.log('✅ 管理员账户已创建 (用户名：admin, 密码：admin123)');
    
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
    
    for (const user of testUsers) {
      const pwd = bcrypt.hashSync('test123', 10);
      await sql`
        INSERT INTO users (username, real_name, email, password_hash, role, account_type, title, organization, is_active)
        VALUES (${user.username}, ${user.real_name}, ${user.username + '@tmf.local'}, ${pwd}, ${user.role}, ${user.account_type}, ${user.real_name}, '测试机构', true)
        ON CONFLICT (username) DO NOTHING
      `;
    }
    console.log('✅ 测试用户已创建 (密码均为：test123)');
    
    // 3. 导入 TMF 文件夹模板
    if (fs.existsSync(fodesPath)) {
      const content = fs.readFileSync(fodesPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      
      let inserted = 0;
      let skipped = 0;
      
      for (const line of lines) {
        if (line.startsWith('#')) continue;
        
        const [zone, section, artifact, zoneCn, zoneEn, sectionCn, sectionEn, artifactCn, artifactEn] = 
          line.split('|').map(s => s?.trim() || '');
        
        if (!zone || !section || !artifact) continue;
        
        const level = artifact ? 3 : section ? 2 : 1;
        const pathStr = `${zone}/${section}${artifact ? '/' + artifact : ''}`;
        
        try {
          await sql`
            INSERT INTO folders (project_id, zone, zone_cn, zone_en, section, section_cn, section_en, artifact, artifact_cn, artifact_en, level, path)
            VALUES (
              NULL, ${zone}, ${zoneCn || ''}, ${zoneEn || ''}, ${section}, ${sectionCn || ''}, ${sectionEn || ''},
              ${artifact || ''}, ${artifactCn || ''}, ${artifactEn || ''}, ${level}, ${pathStr}
            )
            ON CONFLICT DO NOTHING
          `;
          inserted++;
        } catch (e) {
          skipped++;
        }
      }
      
      console.log(`✅ TMF 文件夹模板已导入：${inserted} 条记录 (${skipped} 条跳过)`);
    } else {
      console.log('⚠️  未找到 fodes.txt，跳过文件夹导入');
    }
    
    // 4. 验证数据
    const { rows: users } = await sql`SELECT COUNT(*) as count FROM users`;
    const { rows: folders } = await sql`SELECT COUNT(*) as count FROM folders WHERE project_id IS NULL`;
    
    console.log('\n=== 初始化完成 ===');
    console.log(`用户总数：${users[0].count}`);
    console.log(`模板文件夹数：${folders[0].count}`);
    console.log('\n默认管理员：');
    console.log('  用户名：admin');
    console.log('  密码：admin123');
    console.log('\n测试用户（密码均为 test123）：');
    console.log('  pi, subi, crc, cra, dm, pm, qa, user');
    console.log('===================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    console.error(error);
    process.exit(1);
  }
};

initializeDatabase();
