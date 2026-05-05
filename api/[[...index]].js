/**
 * Vercel API 入口
 * 处理动态路由并分发到 Express 应用
 */

const path = require('path');

// 设置临时目录
process.env.TMPDIR = '/tmp';

// 安装依赖（Vercel 构建时已安装，但确保运行时可用）
let express, cors, multer, uuid;

try {
  // 尝试从 Vercel 的 node_modules 加载
  const modulePath = path.join(__dirname, '..', 'backend', 'node_modules');
  const Module = require('module');
  const originalResolve = Module._resolveFilename;
  
  Module._resolveFilename = function(request, parent, isMain, options) {
    try {
      return originalResolve.call(this, request, parent, isMain, options);
    } catch (e) {
      const vercelModules = path.join(process.env.LAMBDA_TASK_ROOT || '/var/task', 'node_modules');
      return originalResolve.call(this, request, { paths: [vercelModules, ...Module._nodeModulePaths(__dirname)] }, isMain, options);
    }
  };
} catch (e) {
  // 忽略，使用默认解析
}

const appModule = require('./app');

module.exports = async (req, res) => {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  return appModule(req, res);
};
