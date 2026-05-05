# TMF 文档管理系统 - Vercel 部署指南

## 项目结构

```
tmf/
├── api/                    # Vercel Serverless Functions
│   ├── [[...index]].js    # API 入口（动态路由）
│   ├── app.js             # Express 应用配置
│   └── database.js        # SQLite 数据库配置
├── backend/               # 后端源码（本地开发用）
├── frontend/              # React 前端
├── vercel.json            # Vercel 部署配置
└── package.json           # 根目录依赖
```

## 部署到 Vercel

### 方式一：通过 Vercel CLI

1. **安装 Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **部署项目**
   ```bash
   vercel
   ```

4. **部署到生产环境**
   ```bash
   vercel --prod
   ```

### 方式二：通过 GitHub 集成

1. 将代码推送到 GitHub 仓库
2. 登录 [Vercel](https://vercel.com)
3. 点击 "Add New..." → "Project"
4. 选择你的 GitHub 仓库
5. Vercel 会自动检测 `vercel.json` 配置
6. 点击 "Deploy"

### 方式三：通过 Vercel Dashboard

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 "Add New..." → "Project"
3. 选择 "Import Git Repository" 或手动上传
4. 配置构建设置：
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Output Directory**: `frontend/build`
5. 点击 "Deploy"

## 环境变量

在 Vercel Dashboard 的 Settings → Environment Variables 中配置：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `JWT_SECRET` | JWT 签名密钥 | `default-secret`（生产环境务必修改） |
| `JWT_EXPIRES_IN` | Token 过期时间 | `24h` |
| `NODE_ENV` | 运行环境 | `production` |
| `MAX_FILE_SIZE` | 最大文件大小（字节） | `104857600`（100MB） |

## 数据库说明

- Vercel Serverless 使用 `/tmp` 目录存储 SQLite 数据库
- 首次部署时，数据库会自动初始化（包含默认管理员和 TMF 文件夹结构）
- **注意**：Vercel 的 `/tmp` 目录在函数重启后可能丢失数据，生产环境建议使用 Vercel Postgres 或其他云数据库

## 默认账号

- **用户名**: `admin`
- **密码**: `admin123`

## 管理功能

管理员登录后可访问：

1. **文件管理** - TMF 文件夹浏览和文件上传/下载
2. **用户管理** - 创建/编辑用户，激活/失活，重置密码
3. **系统日志** - 查看所有操作记录，支持筛选
4. **系统设置** - 配置文件上传、安全、审计等参数

## 本地开发

```bash
# 后端
cd backend && npm install
npm run init-db    # 初始化数据库
npm start          # 启动后端 (port 3001)

# 前端
cd frontend && npm install
npm start          # 启动前端 (port 3000)
```

## 注意事项

1. **文件上传限制**：Vercel Serverless Functions 请求体限制为 4.5MB（Hobby 计划）或 100MB（Pro 计划）
2. **数据库持久化**：生产环境建议迁移到 Vercel Postgres 或外部数据库
3. **冷启动**：Serverless Functions 可能有几秒的冷启动延迟
4. **日志查看**：在 Vercel Dashboard → Functions → Logs 查看运行日志

## 故障排除

### 部署失败
- 检查 `vercel.json` 配置是否正确
- 确认 `frontend/build` 目录存在且包含构建产物
- 查看 Vercel 部署日志

### 数据库错误
- 确认 `/tmp` 目录有写权限
- 检查数据库文件是否正确初始化

### API 404 错误
- 确认 `api/[[...index]].js` 文件存在
- 检查路由配置是否正确
