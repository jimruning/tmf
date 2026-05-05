// TMF 系统角色定义及权限配置
const ROLES = {
  ADMIN: 'admin',
  PI: 'pi',           // 主要研究者 (Principal Investigator)
  SUB_I: 'sub_i',     // 助理研究者 (Sub-Investigator)
  CRC: 'crc',         // 临床协调员 (Clinical Research Coordinator)
  CRA: 'cra',         // 临床监查员 (Clinical Research Associate)
  DM: 'dm',           // 数据管理员 (Data Manager)
  PM: 'pm',           // 项目经理 (Project Manager)
  QA: 'qa',           // 质量保证 (Quality Assurance)
  USER: 'user'        // 普通用户
};

const ROLE_LABELS = {
  admin: '系统管理员',
  pi: '主要研究者 (PI)',
  sub_i: '助理研究者 (Sub-I)',
  crc: '临床协调员 (CRC)',
  cra: '临床监查员 (CRA)',
  dm: '数据管理员 (DM)',
  pm: '项目经理 (PM)',
  qa: '质量保证 (QA)',
  user: '普通用户'
};

// 账号类型定义（临床试验文档管理规范）
const ACCOUNT_TYPES = {
  SPONSOR: 'sponsor',       // 申办方
  CRO: 'cro',               // 合同研究组织
  SITE: 'site',             // 研究中心/医院
  VENDOR: 'vendor',         // 第三方供应商（中心实验室、影像等）
  INTERNAL: 'internal'      // 内部员工
};

const ACCOUNT_TYPE_LABELS = {
  sponsor: '申办方',
  cro: 'CRO',
  site: '研究中心',
  vendor: '第三方供应商',
  internal: '内部员工'
};

// 各角色可上传的 TMF 区域（Zone）权限
// 根据 ICH-GCP 和 TMF Reference Model 规范
const ROLE_UPLOAD_ZONES = {
  admin: ['all'],                                                                 // 管理员可上传所有区域
  pi: ['zone1', 'zone2', 'zone4', 'zone7', 'zone8'],                              // PI：试验管理、TMF核心、受试者文件、监管文件、研究者文件夹
  sub_i: ['zone4', 'zone8'],                                                       // Sub-I：受试者文件、研究者文件夹（医学评估相关）
  crc: ['zone4', 'zone5', 'zone7', 'zone8'],                                       // CRC：受试者文件、药物/器械、监管文件、研究者文件夹
  cra: ['zone1', 'zone6', 'zone7', 'zone10'],                                      // CRA：试验管理、监查文件、监管文件、站点管理
  dm: ['zone3', 'zone5', 'zone9'],                                                 // DM：数据管理、药物/器械（数据相关）、统计
  pm: ['zone1', 'zone2', 'zone10', 'zone11'],                                      // PM：试验管理、TMF核心、站点管理、中心文件
  qa: ['zone2', 'zone10', 'zone11'],                                               // QA：TMF核心（质量审核）、站点管理（质控）、中心文件
  user: ['zone4', 'zone7', 'zone8']                                                // 普通用户：受限上传
};

// 检查角色是否可以上传到指定 Zone
function canUploadToZone(role, zoneKey) {
  const allowedZones = ROLE_UPLOAD_ZONES[role];
  if (!allowedZones) return false;
  if (allowedZones.includes('all')) return true;
  return allowedZones.includes(zoneKey);
}

// 将 Zone 英文名转换为 zoneKey（zone1, zone2 等）
function getZoneKey(zoneEn) {
  const zoneMap = {
    'Zone 1. Trial Management and Oversight': 'zone1',
    'Zone 2. Trial Master File': 'zone2',
    'Zone 3. Data Management': 'zone3',
    'Zone 4. Subject Level Documents': 'zone4',
    'Zone 5. Drug/Device and Treatment': 'zone5',
    'Zone 6. Monitoring': 'zone6',
    'Zone 7. Regulatory and IRB/IEC': 'zone7',
    'Zone 8. Investigator\'s Trial File': 'zone8',
    'Zone 9. Statistics': 'zone9',
    'Zone 10. Site Management and Administration': 'zone10',
    'Zone 11. Central Documents': 'zone11'
  };
  return zoneMap[zoneEn] || null;
}

// 各角色权限定义
const PERMISSIONS = {
  admin: {
    // 用户管理
    user_create: true,
    user_read: true,
    user_update: true,
    user_delete: true,
    // 项目管理
    project_create: true,
    project_read: true,
    project_update: true,
    project_delete: true,
    // 文件夹管理
    folder_read: true,
    folder_create: true,
    // 文件操作
    file_upload: true,
    file_read: true,
    file_download: true,
    file_invalidate: true,    // 标注文件为无效
    file_restore: true,       // 恢复已标注无效的文件
    file_edit_meta: true,     // 编辑文件属性
    // 审核
    file_approve: true,       // 审核文件
    file_reject: true,        // 退回文件
    // 日志
    log_read: true,
    // 系统设置
    settings_update: true
  },
  pi: {
    user_create: false,
    user_read: true,
    user_update: false,
    user_delete: false,
    project_create: false,
    project_read: true,
    project_update: false,
    project_delete: false,
    folder_read: true,
    folder_create: false,
    file_upload: true,
    file_read: true,
    file_download: true,
    file_invalidate: true,
    file_restore: false,
    file_edit_meta: true,
    file_approve: true,
    file_reject: true,
    log_read: true,
    settings_update: false
  },
  sub_i: {
    user_create: false,
    user_read: true,
    user_update: false,
    user_delete: false,
    project_create: false,
    project_read: true,
    project_update: false,
    project_delete: false,
    folder_read: true,
    folder_create: false,
    file_upload: true,
    file_read: true,
    file_download: true,
    file_invalidate: true,
    file_restore: false,
    file_edit_meta: true,
    file_approve: false,
    file_reject: false,
    log_read: true,
    settings_update: false
  },
  crc: {
    user_create: false,
    user_read: false,
    user_update: false,
    user_delete: false,
    project_create: false,
    project_read: true,
    project_update: false,
    project_delete: false,
    folder_read: true,
    folder_create: false,
    file_upload: true,
    file_read: true,
    file_download: true,
    file_invalidate: true,
    file_restore: false,
    file_edit_meta: true,
    file_approve: false,
    file_reject: false,
    log_read: true,
    settings_update: false
  },
  crc: {
    user_create: false,
    user_read: false,
    user_update: false,
    user_delete: false,
    project_create: false,
    project_read: true,
    project_update: false,
    project_delete: false,
    folder_read: true,
    folder_create: false,
    file_upload: true,
    file_read: true,
    file_download: true,
    file_invalidate: true,
    file_restore: false,
    file_edit_meta: false,
    file_approve: false,
    file_reject: false,
    log_read: true,
    settings_update: false
  },
  dm: {
    user_create: false,
    user_read: false,
    user_update: false,
    user_delete: false,
    project_create: false,
    project_read: true,
    project_update: false,
    project_delete: false,
    folder_read: true,
    folder_create: false,
    file_upload: true,
    file_read: true,
    file_download: true,
    file_invalidate: true,
    file_restore: false,
    file_edit_meta: true,
    file_approve: false,
    file_reject: false,
    log_read: false,
    settings_update: false
  },
  cra: {
    user_create: false,
    user_read: false,
    user_update: false,
    user_delete: false,
    project_create: false,
    project_read: true,
    project_update: false,
    project_delete: false,
    folder_read: true,
    folder_create: false,
    file_upload: true,
    file_read: true,
    file_download: true,
    file_invalidate: true,
    file_restore: false,
    file_edit_meta: true,
    file_approve: true,
    file_reject: true,
    log_read: true,
    settings_update: false
  },
  qa: {
    user_create: false,
    user_read: true,
    user_update: false,
    user_delete: false,
    project_create: false,
    project_read: true,
    project_update: false,
    project_delete: false,
    folder_read: true,
    folder_create: false,
    file_upload: false,
    file_read: true,
    file_download: true,
    file_invalidate: false,
    file_restore: false,
    file_edit_meta: false,
    file_approve: false,
    file_reject: false,
    log_read: true,
    settings_update: false
  },
  user: {
    user_create: false,
    user_read: false,
    user_update: false,
    user_delete: false,
    project_create: false,
    project_read: true,
    project_update: false,
    project_delete: false,
    folder_read: true,
    folder_create: false,
    file_upload: true,
    file_read: true,
    file_download: true,
    file_delete: true,
    file_restore: false,
    file_edit_meta: false,
    file_approve: false,
    file_reject: false,
    log_read: false,
    settings_update: false
  }
};

// 检查用户是否有某项权限
function hasPermission(role, permission) {
  const perms = PERMISSIONS[role];
  if (!perms) return false;
  return perms[permission] === true;
}

// 权限检查中间件工厂
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '未认证' }
      });
    }
    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: `权限不足：需要 ${permission} 权限` }
      });
    }
    next();
  };
}

module.exports = {
  ROLES,
  ROLE_LABELS,
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  PERMISSIONS,
  ROLE_UPLOAD_ZONES,
  canUploadToZone,
  getZoneKey,
  hasPermission,
  requirePermission
};
