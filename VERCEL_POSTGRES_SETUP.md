# Vercel Postgres 部署指南

## 步骤 1：创建 Vercel Postgres 数据库

1. 访问 https://vercel.com/dashboard
2. 找到你的 TMF 项目
3. 点击 **"Storage"** 标签
4. 点击 **"Add Database"** → **"PostgreSQL"**
5. 选择数据库名称（例如：`tmf-db`）和区域
6. 点击 **"Create Database"**

## 步骤 2：连接数据库到项目

创建数据库后，Vercel 会自动将 `POSTGRES_URL` 环境变量添加到你的项目中。

## 步骤 3：部署项目

1. 推送代码到 GitHub（会自动触发 Vercel 部署）
2. 或者在 Vercel 控制台点击 **"Redeploy"**

## 步骤 4：初始化数据库

首次部署后，数据库表会自动创建（见 `api/[[...index]].js` 中的 `initTables()` 函数）。

## 步骤 5：创建管理员账户

使用 API 工具或直接访问：

```bash
curl -X POST https://你的项目.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","email":"admin@example.com"}'
```

然后手动在数据库中将角色设为 admin（或使用默认脚本）。

## 环境变量说明

| 变量名 | 说明 | 来源 |
|--------|------|------|
| `POSTGRES_URL` | Postgres 连接字符串 | Vercel 自动提供 |
| `JWT_SECRET` | JWT 密钥 | 在 Vercel > Settings > Environment Variables 中添加 |
| `NODE_ENV` | 运行环境 | 已在 vercel.json 配置 |
| `MAX_FILE_SIZE` | 最大上传文件大小（字节）| 可选 |

## 本地测试

如需本地连接 Vercel Postgres 测试：

1. 在 Vercel 控制台获取 `POSTGRES_URL`
2. 创建 `.env` 文件：
```
POSTGRES_URL=你的连接字符串
JWT_SECRET=tmf-production-secret-key-change-this
```
3. 运行后端：`cd backend && npm start`

## 故障排查

### 数据库连接失败
- 检查 `POSTGRES_URL` 是否正确
- 确认 Vercel 项目已连接 Postgres 数据库
- 查看 Vercel 部署日志

### 表不存在
- 首次部署时表会自动创建
- 检查 Vercel 函数日志中的 `initTables` 输出

### 上传文件丢失
- 文件存储在 `/tmp/uploads`，Vercel 重启后会清除
- 建议使用 Vercel Blob 或其他对象存储服务
