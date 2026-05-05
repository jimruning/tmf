require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const folderRoutes = require('./routes/folders');
const fileRoutes = require('./routes/files');
const searchRoutes = require('./routes/search');
const projectRoutes = require('./routes/projects');
const userRoutes = require('./routes/users');
const logRoutes = require('./routes/logs');
const settingsRoutes = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 3001;

// 确保上传目录存在
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use('/uploads', express.static(uploadDir));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/users', userRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/settings', settingsRoutes);

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误'
    }
  });
});

// 数据库迁移：为现有数据库添加新字段
const db = require('./config/database');
try {
  // 检查并添加 account_type 列
  const columns = db.pragma("table_info('users')");
  const hasAccountType = columns.some(col => col.name === 'account_type');
  if (!hasAccountType) {
    db.exec("ALTER TABLE users ADD COLUMN account_type TEXT DEFAULT 'site'");
    console.log('数据库迁移：已添加 account_type 列');
  }

  // 检查并添加 delete_reason 列
  const fileColumns = db.pragma("table_info('files')");
  const hasDeleteReason = fileColumns.some(col => col.name === 'delete_reason');
  if (!hasDeleteReason) {
    db.exec("ALTER TABLE files ADD COLUMN delete_reason TEXT");
    console.log('数据库迁移：已添加 delete_reason 列');
  }

  // 检查并添加 status 列到 files 表
  const hasStatus = fileColumns.some(col => col.name === 'status');
  if (!hasStatus) {
    db.exec("ALTER TABLE files ADD COLUMN status TEXT DEFAULT 'uploaded'");
    console.log('数据库迁移：已添加 files.status 列');
  }

  // 检查并添加 reviewed_by 列
  const hasReviewedBy = fileColumns.some(col => col.name === 'reviewed_by');
  if (!hasReviewedBy) {
    db.exec("ALTER TABLE files ADD COLUMN reviewed_by INTEGER");
    db.exec("ALTER TABLE files ADD COLUMN reviewed_at DATETIME");
    db.exec("ALTER TABLE files ADD COLUMN review_comment TEXT");
    console.log('数据库迁移：已添加文件审核相关列');
  }

  // 检查并添加 invalidate 相关列
  const hasInvalidateReason = fileColumns.some(col => col.name === 'invalidate_reason');
  if (!hasInvalidateReason) {
    db.exec("ALTER TABLE files ADD COLUMN invalidate_reason TEXT");
    db.exec("ALTER TABLE files ADD COLUMN invalidated_by INTEGER");
    db.exec("ALTER TABLE files ADD COLUMN invalidated_at DATETIME");
    console.log('数据库迁移：已添加文件标注无效相关列');
  }
} catch (error) {
  console.error('数据库迁移失败:', error.message);
}

app.listen(PORT, () => {
  console.log(`TMF Backend running on http://localhost:${PORT}`);
});

module.exports = app;
