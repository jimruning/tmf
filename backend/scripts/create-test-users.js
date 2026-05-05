const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'tmf.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

console.log('开始创建测试账号...\n');

// 测试用户列表：包含不同角色和账号类型
const testUsers = [
  // 申办方人员
  {
    username: 'sponsor_pm',
    real_name: '李明',
    email: 'liming@pharma.com',
    phone: '13800001001',
    role: 'pm',
    account_type: 'sponsor',
    title: '临床项目经理',
    organization: 'XX制药有限公司',
    password: 'test123',
    description: '申办方项目经理 - 可管理试验、审核文件'
  },
  {
    username: 'sponsor_cra',
    real_name: '王芳',
    email: 'wangfang@pharma.com',
    phone: '13800001002',
    role: 'cra',
    account_type: 'sponsor',
    title: '临床监查员',
    organization: 'XX制药有限公司',
    password: 'test123',
    description: '申办方CRA - 负责监查和文件审核'
  },
  {
    username: 'sponsor_qa',
    real_name: '张伟',
    email: 'zhangwei@pharma.com',
    phone: '13800001003',
    role: 'qa',
    account_type: 'sponsor',
    title: '质量保证专员',
    organization: 'XX制药有限公司',
    password: 'test123',
    description: '申办方QA - 负责质量审核'
  },
  
  // CRO 人员
  {
    username: 'cro_cra',
    real_name: '赵丽',
    email: 'zhaoli@cro.com',
    phone: '13800002001',
    role: 'cra',
    account_type: 'cro',
    title: '高级监查员',
    organization: 'YY临床研究中心',
    password: 'test123',
    description: 'CRO监查员 - 负责站点监查'
  },
  {
    username: 'cro_pm',
    real_name: '陈强',
    email: 'chenqiang@cro.com',
    phone: '13800002002',
    role: 'pm',
    account_type: 'cro',
    title: 'CRO项目经理',
    organization: 'YY临床研究中心',
    password: 'test123',
    description: 'CRO项目经理 - 负责项目整体管理'
  },
  {
    username: 'cro_dm',
    real_name: '刘洋',
    email: 'liuyang@cro.com',
    phone: '13800002003',
    role: 'dm',
    account_type: 'cro',
    title: '数据管理员',
    organization: 'YY临床研究中心',
    password: 'test123',
    description: 'CRO数据管理员 - 负责数据管理'
  },
  
  // 研究中心人员
  {
    username: 'pi_zhang',
    real_name: '张教授',
    email: 'zhangprof@hospital.com',
    phone: '13800003001',
    role: 'pi',
    account_type: 'site',
    title: '主任医师/教授',
    organization: 'XX医院肿瘤科',
    password: 'test123',
    description: '主要研究者(PI) - 可审核和批准文件'
  },
  {
    username: 'sub_i_li',
    real_name: '李医生',
    email: 'lidoc@hospital.com',
    phone: '13800003002',
    role: 'sub_i',
    account_type: 'site',
    title: '副主任医师',
    organization: 'XX医院肿瘤科',
    password: 'test123',
    description: '助理研究者(Sub-I) - 协助PI工作'
  },
  {
    username: 'crc_wang',
    real_name: '王护士',
    email: 'wangcrc@hospital.com',
    phone: '13800003003',
    role: 'crc',
    account_type: 'site',
    title: '临床协调员',
    organization: 'XX医院临床试验机构',
    password: 'test123',
    description: '临床协调员(CRC) - 负责受试者文件上传'
  },
  {
    username: 'crc_chen',
    real_name: '陈协调员',
    email: 'chencrc@hospital.com',
    phone: '13800003004',
    role: 'crc',
    account_type: 'site',
    title: '临床协调员',
    organization: 'XX医院临床试验机构',
    password: 'test123',
    description: '临床协调员(CRC) - 第二CRC'
  },
  
  // 第三方供应商
  {
    username: 'vendor_lab',
    real_name: '孙技师',
    email: 'sunlab@centrallab.com',
    phone: '13800004001',
    role: 'dm',
    account_type: 'vendor',
    title: '实验室数据专员',
    organization: 'ZZ中心实验室',
    password: 'test123',
    description: '中心实验室数据专员 - 上传实验室数据'
  },
  {
    username: 'vendor_img',
    real_name: '周医师',
    email: 'zhouimg@imaging.com',
    phone: '13800004002',
    role: 'dm',
    account_type: 'vendor',
    title: '影像评估医师',
    organization: 'AA影像评估中心',
    password: 'test123',
    description: '影像评估医师 - 上传影像评估报告'
  }
];

const existingUsers = db.prepare('SELECT username FROM users').all().map(u => u.username);
let createdCount = 0;
let skippedCount = 0;

for (const user of testUsers) {
  if (existingUsers.includes(user.username)) {
    console.log(`⏭ 跳过: ${user.username} (${user.description}) - 已存在`);
    skippedCount++;
    continue;
  }
  
  const passwordHash = bcrypt.hashSync(user.password, 10);
  db.prepare(
    'INSERT INTO users (username, real_name, email, phone, password_hash, role, account_type, title, organization) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    user.username,
    user.real_name,
    user.email,
    user.phone,
    passwordHash,
    user.role,
    user.account_type,
    user.title,
    user.organization
  );
  
  console.log(`✅ 创建: ${user.username} | ${user.real_name} | ${user.description}`);
  createdCount++;
}

console.log(`\n${'='.repeat(60)}`);
console.log(`📊 测试账号创建完成！`);
console.log(`   - 新建: ${createdCount} 个`);
console.log(`   - 跳过: ${skippedCount} 个`);
console.log(`   - 总计: ${testUsers.length} 个`);
console.log(`${'='.repeat(60)}\n`);

console.log('📋 测试账号列表（密码统一为: test123）：\n');

const allUsers = db.prepare(`
  SELECT username, real_name, role, account_type, title, organization, is_active 
  FROM users 
  ORDER BY 
    CASE account_type 
      WHEN 'sponsor' THEN 1 
      WHEN 'cro' THEN 2 
      WHEN 'site' THEN 3 
      WHEN 'vendor' THEN 4 
      WHEN 'internal' THEN 5 
    END,
    username
`).all();

const roleLabels = {
  admin: '系统管理员',
  pi: '主要研究者(PI)',
  sub_i: '助理研究者(Sub-I)',
  crc: '临床协调员(CRC)',
  cra: '临床监查员(CRA)',
  dm: '数据管理员(DM)',
  pm: '项目经理(PM)',
  qa: '质量保证(QA)',
  user: '普通用户'
};

const accountTypeLabels = {
  sponsor: '申办方',
  cro: 'CRO',
  site: '研究中心',
  vendor: '第三方供应商',
  internal: '内部员工'
};

let currentType = '';
for (const user of allUsers) {
  if (user.account_type !== currentType) {
    currentType = user.account_type;
    console.log(`\n--- ${accountTypeLabels[currentType] || currentType} ---`);
  }
  const status = user.is_active ? '✅ 激活' : '❌ 失活';
  console.log(`  ${user.username.padEnd(15)} | ${user.real_name.padEnd(10)} | ${(roleLabels[user.role] || user.role).padEnd(20)} | ${status}`);
}

console.log(`\n${'='.repeat(60)}`);
console.log('💡 管理员操作提示：');
console.log('   - 编辑用户: 点击"编辑"按钮可修改所有用户信息');
console.log('   - 激活/失活: 点击绿色/红色按钮切换用户状态');
console.log('   - 初始化密码: 点击钥匙图标可重置用户密码');
console.log(`${'='.repeat(60)}\n`);

db.close();
