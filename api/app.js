/**
 * Express 应用配置
 * 用于 Vercel Serverless Functions
 */

const path = require('path');
const fs = require('fs');

// 从 backend 的 node_modules 加载
const backendModules = path.join(__dirname, '..', 'backend', 'node_modules');

const loadModule = (name) => {
  const p = path.join(backendModules, name);
  if (fs.existsSync(p)) {
    return require(p);
  }
  return require(name);
};

const express = loadModule('express');
const cors = loadModule('cors');
const multer = loadModule('multer');

const authRoutes = require('../backend/routes/auth');
const folderRoutes = require('../backend/routes/folders');
const fileRoutes = require('../backend/routes/files');
const searchRoutes = require('../backend/routes/search');
const projectRoutes = require('../backend/routes/projects');
const userRoutes = require('../backend/routes/users');
const logRoutes = require('../backend/routes/logs');
const settingsRoutes = require('../backend/routes/settings');

const app = express();

// 中间件
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 确保上传目录存在
const uploadDir = process.env.NODE_ENV === 'production' ? '/tmp/uploads' : path.join(__dirname, '..', 'backend', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'TMF API is running', timestamp: new Date().toISOString() });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' }
  });
});

module.exports = app;
