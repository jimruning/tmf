# 🚀 TMF文档管理系统 - 快速启动指南

## ⚡ 5分钟快速启动

### 前置要求
- Node.js 16+ 已安装
- npm 或 yarn 包管理器

---

## 📦 第一步：安装依赖

### 前端
```bash
cd frontend
npm install antd @ant-design/icons react-router-dom axios
```

### 后端
```bash
cd backend
npm install
```

---

## 🗄️ 第二步：初始化数据库

```bash
cd backend
npm run init-db
```

这将：
- ✅ 创建SQLite数据库和表
- ✅ 导入251个TMF文件夹（从fodes.txt）
- ✅ 创建默认管理员账户

**默认登录信息：**
```
用户名: admin
密码: admin123
```

⚠️ **生产环境请立即修改默认密码！**

---

## 🚀 第三步：启动服务

### 终端1 - 启动后端（3001端口）
```bash
cd backend
npm start
```

看到以下输出表示成功：
```
=================================
🚀 TMF 后端服务器启动成功
📍 地址: http://localhost:3001
🏥 健康检查: http://localhost:3001/health
=================================
```

### 终端2 - 启动前端（3000端口）
```bash
cd frontend
npm start
```

浏览器会自动打开 http://localhost:3000

---

## ✨ 第四步：测试系统

### 1. 登录
- 访问 http://localhost:3000
- 使用默认账户登录（admin/admin123）

### 2. 浏览文件夹
- 左侧显示TMF标准文件夹树（11个区域，251个条目）
- 点击展开/折叠文件夹

### 3. 上传文件
- 选择任意文件夹
- 点击"上传文件"按钮
- 选择文件上传（最大100MB）

### 4. 下载/删除文件
- 在文件列表中点击下载或删除按钮

### 5. 搜索文件
- 使用搜索框查找文件（暂未在UI实现，API已就绪）

---

## 📁 项目结构

```
tmf/
├── frontend/                 # 前端React应用
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   │   ├── LoginPage.js      # 登录页
│   │   │   └── DashboardPage.js  # 主仪表板
│   │   ├── components/      # 业务组件
│   │   │   ├── FolderTree.js     # 文件夹树
│   │   │   ├── FileList.js       # 文件列表
│   │   │   └── FileUpload.js     # 文件上传
│   │   └── App.js           # 应用入口
│   └── package.json
│
├── backend/                 # 后端Express应用
│   ├── config/              # 配置
│   │   └── database.js      # 数据库配置
│   ├── routes/              # API路由
│   │   ├── auth.js          # 认证API
│   │   ├── folders.js       # 文件夹API
│   │   ├── files.js         # 文件API
│   │   └── search.js        # 搜索API
│   ├── middleware/           # 中间件
│   │   └── auth.js          # JWT认证
│   ├── scripts/             # 工具脚本
│   │   └── init-db.js       # 数据库初始化
│   ├── uploads/             # 文件上传目录
│   ├── server.js            # 服务器入口
│   └── package.json
│
├── fodes.txt                # TMF文件夹数据
├── MVP_PLAN.md             # MVP开发计划
└── README.md               # 项目说明
```

---

## 🔌 API端点

### 认证
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录

### 文件夹
- `GET /api/folders/tree` - 获取文件夹树
- `GET /api/folders/:id` - 获取文件夹详情

### 文件
- `GET /api/files?folder_id=1` - 获取文件列表
- `POST /api/files/upload` - 上传文件
- `GET /api/files/:id/download` - 下载文件
- `DELETE /api/files/:id` - 删除文件（软删除）

### 搜索
- `GET /api/search?q=keyword` - 搜索文件

---

## 🎯 当前功能状态

### ✅ 已实现（MVP核心功能）
- [x] 用户注册和登录
- [x] JWT认证和权限控制
- [x] TMF文件夹树（251个条目）
- [x] 文件上传（拖拽支持）
- [x] 文件列表查看
- [x] 文件下载
- [x] 文件虚拟删除
- [x] 基础搜索API

### 🚧 开发中
- [ ] 文件搜索UI
- [ ] 文件属性编辑
- [ ] 操作日志查看
- [ ] 用户管理界面

### 📝 计划中（V2.0）
- [ ] 文件版本控制
- [ ] 文件转PDF
- [ ] 权限申请审批
- [ ] 高级搜索
- [ ] 统计分析

---

## 🐛 常见问题

### 1. 端口冲突
**问题：** 端口3000或3001已被占用
**解决：**
```bash
# 修改前端端口（frontend/package.json）
"start": "react-scripts start --port 3001"

# 或修改后端端口（backend/.env）
PORT=3002
```

### 2. 数据库初始化失败
**问题：** 找不到fodes.txt
**解决：** 确保fodes.txt在项目根目录

### 3. 前端连接后端失败
**问题：** CORS错误或连接超时
**解决：** 确保后端已启动，检查端口是否正确

### 4. 文件上传失败
**问题：** 文件太大或格式不支持
**解决：** 当前限制100MB，仅支持PDF文件（MVP阶段）

---

## 🛠️ 开发模式

### 后端开发（自动重启）
```bash
cd backend
npm run dev
```

### 前端开发（热更新）
```bash
cd frontend
npm start
```

---

## 📊 数据库表结构

```sql
-- 用户表
users (id, username, email, password, role, created_at, last_login)

-- 文件夹表
folders (id, zone_id, zone_name, section_id, section_name,
         artifact_id, artifact_name, path, created_at)

-- 文件表
files (id, folder_id, filename, original_filename, version,
       file_size, mime_type, upload_date, upload_user_id,
       is_deleted, delete_date, delete_user_id, file_path)

-- 操作日志表
activity_logs (id, user_id, action, target_type, target_id,
               action_date, details)
```

---

## 🔒 安全说明

### 开发环境
- ✅ JWT认证
- ✅ 密码bcrypt加密
- ✅ CORS配置
- ⚠️ 使用默认JWT密钥（.env.example）

### 生产环境（必须修改）
1. 修改JWT密钥（.env文件）
2. 修改默认管理员密码
3. 启用HTTPS
4. 配置防火墙
5. 设置数据库备份
6. 限制文件上传类型

---

## 📝 下一步

### 优先级P0（立即）
- [ ] 修改默认管理员密码
- [ ] 测试所有核心功能
- [ ] 修复发现的Bug

### 优先级P1（本周）
- [ ] 实现文件搜索UI
- [ ] 实现文件属性编辑
- [ ] 添加操作日志查看

### 优先级P2（下周）
- [ ] 优化UI/UX
- [ ] 添加单元测试
- [ ] 完善错误处理

---

## 🎉 完成！

现在你可以开始使用TMF文档管理系统了！

有问题？查看：
- `MVP_PLAN.md` - 完整开发计划
- `MVP_PLAN_REVIEW.md` - 计划审查报告
- `backend/routes/*.js` - API实现细节

---

**MVP版本：** v0.1.0
**最后更新：** 2025-01-15
**开发团队：** TMF项目组
