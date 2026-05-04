# TMF文档管理系统 MVP 开发计划

## 📋 目录
1. [MVP目标](#mvp目标)
2. [核心功能范围](#核心功能范围)
3. [技术架构](#技术架构)
4. [数据库设计](#数据库设计)
5. [前端架构](#前端架构)
6. [后端API设计](#后端api设计)
7. [开发阶段划分](#开发阶段划分)
8. [时间估算](#时间估算)

---

## 🎯 MVP目标

### 核心价值
在**4-6周**内构建一个可运行的TMF文档管理系统最小可行产品，实现：
- ✅ 用户注册、登录和基础权限管理
- ✅ 符合TMF V3.3.1标准的文件夹结构
- ✅ 文件上传、下载、浏览功能
- ✅ 基础文件检索功能
- ✅ 操作日志记录

### MVP不包括（后续版本）
- ❌ 复杂的权限申请审批流程
- ❌ 文件版本控制（仅保留最新版本）
- ❌ 高级统计分析和报表
- ❌ 与第三方系统集成
- ❌ 电子签名功能

---

## 🔧 核心功能范围

### 1. 用户认证模块 ⭐⭐⭐
**优先级：最高**

| 功能 | 描述 | MVP实现 |
|------|------|---------|
| 用户注册 | 支持邮箱注册 | ✅ 简化注册，需要管理员审批 |
| 用户登录 | JWT token认证 | ✅ 实现登录页面和token管理 |
| 角色管理 | 基础角色：Admin/User | ✅ 仅两种角色 |
| 权限控制 | 文件夹访问权限 | ✅ Admin全部，User只读 |

**数据表：**
- `users` (用户表)
- 简化的 `role_permissions` (仅两种角色)

---

### 2. TMF文件夹结构模块 ⭐⭐⭐
**优先级：最高**

| 功能 | 描述 | MVP实现 |
|------|------|---------|
| 文件夹树初始化 | 导入fodes.txt数据 | ✅ 启动时自动创建 |
| 树形展示 | 三层结构（Zone/Section/Artifact） | ✅ 使用Ant Design Tree组件 |
| 文件夹导航 | 点击展开/折叠 | ✅ 基础导航功能 |
| 中英文显示 | 双语文件夹名称 | ✅ 数据库存储双语 |

**数据表：**
- `folders` (文件夹表，基于fodes.txt)

---

### 3. 文件管理模块 ⭐⭐⭐
**优先级：最高**

| 功能 | 描述 | MVP实现 |
|------|------|---------|
| 文件上传 | 支持拖拽上传 | ✅ 已有FileUpload组件 |
| 文件转PDF | 自动转换为PDF | ❌ MVP暂不实现，直接存储原文件 |
| 文件下载 | 点击下载 | ✅ 基础下载功能 |
| 文件列表 | 显示文件夹内文件 | ✅ 表格展示 |
| 文件属性编辑 | 修改文件名、版本等 | ✅ 简单编辑弹窗 |
| 虚拟删除 | 软删除机制 | ✅ 标记删除状态 |

**数据表：**
- `files` (文件表)
- ❌ 暂不实现 `file_versions` (版本表)

---

### 4. 文件检索模块 ⭐⭐
**优先级：中等**

| 功能 | 描述 | MVP实现 |
|------|------|---------|
| 基础搜索 | 按文件名搜索 | ✅ 简单LIKE查询 |
| 高级筛选 | 多条件组合 | ❌ MVP暂不实现 |
| 搜索结果高亮 | 关键词高亮 | ✅ 前端实现 |

---

### 5. 操作日志模块 ⭐
**优先级：低**

| 功能 | 描述 | MVP实现 |
|------|------|---------|
| 日志记录 | 记录用户操作 | ✅ 基础日志（登录、上传、删除） |
| 日志查询 | 管理员查看日志 | ❌ MVP暂不实现 |

**数据表：**
- `activity_logs` (操作日志表，简化字段)

---

## 🏗️ 技术架构

### 前端技术栈
```
React 19.1.0 + Redux Toolkit
├── UI框架: Ant Design 5.x (推荐安装)
├── 路由: React Router 6.x
├── HTTP客户端: Axios
├── 状态管理: Redux Toolkit (已配置)
└── 构建工具: Create React App (已配置)
```

**需要安装的依赖：**
```bash
npm install antd @ant-design/icons react-router-dom axios
```

### 后端技术栈
```
Node.js + Express.js
├── 数据库: SQLite3 (better-sqlite3)
├── ORM: 无 (直接SQL，保持轻量)
├── 认证: JWT (jsonwebtoken)
├── 加密: bcryptjs
├── 文件上传: multer
└── CORS: cors
```

**后端目录结构（需创建）：**
```
backend/
├── server.js           # 主服务器入口
├── config/
│   └── database.js     # SQLite数据库配置
├── routes/
│   ├── auth.js         # 认证路由
│   ├── folders.js      # 文件夹路由
│   ├── files.js        # 文件路由
│   └── search.js       # 搜索路由
├── middleware/
│   ├── auth.js         # JWT验证中间件
│   └── upload.js       # 文件上传中间件
├── controllers/        # 控制器（可选）
└── uploads/            # 文件存储目录
```

---

## 💾 数据库设计 (MVP简化版)

### 1. users (用户表)
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,           -- bcrypt加密
    role TEXT NOT NULL DEFAULT 'user', -- 'admin' 或 'user'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);
```

### 2. folders (文件夹表)
```sql
CREATE TABLE folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id TEXT NOT NULL,              -- 如 '01'
    zone_name TEXT NOT NULL,            -- 如 'Trial Management'
    section_id TEXT NOT NULL,           -- 如 '01.01'
    section_name TEXT NOT NULL,         -- 如 'Trial Oversight'
    artifact_id TEXT UNIQUE NOT NULL,   -- 如 '01.01.01'
    artifact_name TEXT NOT NULL,        -- 如 'Trial Master File Plan'
    path TEXT NOT NULL,                 -- 完整路径 '01/01.01/01.01.01'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3. files (文件表)
```sql
CREATE TABLE files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id INTEGER NOT NULL,         -- 外键关联folders
    filename TEXT NOT NULL,             -- 存储文件名（UUID）
    original_filename TEXT NOT NULL,    -- 原始文件名
    version TEXT DEFAULT '1.0',         -- 版本号（字符串）
    file_size INTEGER,                  -- 文件大小（字节）
    mime_type TEXT,                     -- 文件类型
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    upload_user_id INTEGER,             -- 上传用户ID
    is_deleted INTEGER DEFAULT 0,       -- 0-正常，1-已删除
    delete_date DATETIME,
    delete_user_id INTEGER,
    file_path TEXT NOT NULL,            -- 服务器存储路径
    FOREIGN KEY (folder_id) REFERENCES folders(id),
    FOREIGN KEY (upload_user_id) REFERENCES users(id)
);
```

### 4. activity_logs (操作日志表)
```sql
CREATE TABLE activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,               -- 'login', 'upload', 'download', 'delete'
    target_type TEXT,                   -- 'file' 或 'folder'
    target_id INTEGER,
    action_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    details TEXT,                       -- JSON格式的详细信息
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 初始化脚本
从 `fodes.txt` 导入文件夹数据到 `folders` 表。

---

## 🎨 前端架构设计

### 页面结构（React Router配置）
```javascript
/                           → LoginPage (登录页)
/dashboard                  → DashboardPage (主仪表板)
  /folders                  → FolderTreeView (文件夹树)
  /files/:folderId          → FileListView (文件列表)
  /upload/:folderId         → UploadPage (上传页面)
  /search                   → SearchPage (搜索页面)
  /profile                  → ProfilePage (个人资料)
/admin                      → AdminDashboard (管理员面板)
  /admin/users              → UserManagement (用户管理)
  /admin/logs               → ActivityLogs (操作日志)
```

### 组件层次结构
```
App
├── LoginPage
├── DashboardLayout
│   ├── Sidebar (文件夹树)
│   ├── Header (用户信息、登出)
│   └── Content
│       ├── FileList (文件列表表格)
│       ├── FileUpload (上传组件，已存在)
│       ├── SearchBar (搜索框)
│       └── FileEditModal (编辑弹窗)
└── AdminDashboard
    └── UserManagement
```

### Redux Store结构
```javascript
{
  auth: {
    user: { id, username, email, role },
    token: 'jwt_token_string',
    isAuthenticated: boolean
  },
  folders: {
    tree: [],          // 文件夹树数据
    selectedFolder: null
  },
  files: {
    list: [],          // 当前文件夹的文件列表
    loading: false,
    error: null
  },
  search: {
    results: [],
    query: ''
  }
}
```

---

## 🔌 后端API设计

### 认证相关 API

#### POST /api/auth/register
**注册新用户（需要管理员权限或开放注册）**
```json
Request:
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123"
}

Response:
{
  "message": "用户创建成功",
  "user": { "id": 1, "username": "testuser", "role": "user" }
}
```

#### POST /api/auth/login
**用户登录**
```json
Request:
{
  "username": "testuser",
  "password": "password123"
}

Response:
{
  "token": "jwt_token_string",
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "role": "user"
  }
}
```

---

### 文件夹相关 API

#### GET /api/folders/tree
**获取文件夹树结构**
```json
Response:
[
  {
    "id": 1,
    "zone_id": "01",
    "zone_name": "Trial Management",
    "children": [
      {
        "id": 2,
        "section_id": "01.01",
        "section_name": "Trial Oversight",
        "artifact_id": "01.01.01",
        "artifact_name": "Trial Master File Plan",
        "children": []
      }
    ]
  }
]
```

#### GET /api/folders/:id
**获取单个文件夹详情**
```json
Response:
{
  "id": 1,
  "zone_id": "01",
  "zone_name": "Trial Management",
  "section_id": "01.01",
  "section_name": "Trial Oversight",
  "artifact_id": "01.01.01",
  "artifact_name": "Trial Master File Plan",
  "path": "01/01.01/01.01.01"
}
```

---

### 文件相关 API

#### GET /api/files?folder_id=1
**获取指定文件夹的文件列表**
```json
Response:
{
  "files": [
    {
      "id": 1,
      "filename": "uuid_filename.pdf",
      "original_filename": "TMF Plan.pdf",
      "version": "1.0",
      "file_size": 1024000,
      "upload_date": "2025-01-15T10:30:00Z",
      "upload_user": { "id": 1, "username": "admin" },
      "is_deleted": 0
    }
  ]
}
```

#### POST /api/files/upload
**上传文件到指定文件夹**
```javascript
Request: FormData
{
  file: File object,
  folder_id: 1,
  version: "1.0"
}

Response:
{
  "message": "文件上传成功",
  "file": {
    "id": 2,
    "filename": "uuid_filename.pdf",
    "original_filename": "uploaded.pdf",
    "file_size": 2048000,
    "upload_date": "2025-01-15T11:00:00Z"
  }
}
```

#### GET /api/files/:id/download
**下载文件**
```
Response: File stream
```

#### PUT /api/files/:id
**更新文件属性**
```json
Request:
{
  "version": "2.0",
  "original_filename": "Updated Filename.pdf"
}

Response:
{
  "message": "文件更新成功",
  "file": { "id": 1, "version": "2.0", ... }
}
```

#### DELETE /api/files/:id
**虚拟删除文件**
```json
Response:
{
  "message": "文件已删除",
  "file": { "id": 1, "is_deleted": 1, "delete_date": "2025-01-15T12:00:00Z" }
}
```

---

### 搜索相关 API

#### GET /api/search?q=keyword
**搜索文件**
```json
Response:
{
  "results": [
    {
      "id": 1,
      "original_filename": "TMF Plan.pdf",
      "folder": {
        "artifact_name": "Trial Master File Plan",
        "path": "01/01.01/01.01.01"
      },
      "upload_date": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 1
}
```

---

### 日志相关 API (管理员)

#### GET /api/logs?user_id=1&action=upload
**获取操作日志（仅管理员）**
```json
Response:
{
  "logs": [
    {
      "id": 1,
      "user": { "username": "admin" },
      "action": "upload",
      "target_type": "file",
      "target_id": 1,
      "action_date": "2025-01-15T10:30:00Z",
      "details": { "filename": "test.pdf" }
    }
  ],
  "total": 10
}
```

---

## 📅 开发阶段划分

### 第1周：项目初始化与数据库搭建
**目标：搭建基础架构**

#### Day 1-2：环境搭建
- [ ] 初始化后端项目（Express + SQLite）
- [ ] 安装并配置前端依赖（Ant Design、Router、Axios）
- [ ] 设置CORS和环境变量

#### Day 3-4：数据库实现
- [ ] 创建SQLite数据库和4张表
- [ ] 编写fodes.txt导入脚本
- [ ] 创建初始化SQL脚本

#### Day 5-7：基础认证系统
- [ ] 实现用户注册API
- [ ] 实现用户登录API（JWT）
- [ ] 创建登录页面（前端）
- [ ] 实现路由守卫（Protected Route）

**交付物：**
- ✅ 可运行的前后端项目
- ✅ 数据库初始化完成
- ✅ 用户可以注册并登录

---

### 第2周：文件夹结构模块
**目标：实现TMF文件夹树**

#### Day 8-10：文件夹API
- [ ] 实现获取文件夹树API
- [ ] 实现获取单个文件夹详情API
- [ ] 编写文件夹树构建逻辑（递归）

#### Day 11-14：文件夹UI
- [ ] 使用Ant Design Tree组件展示文件夹
- [ ] 实现文件夹点击展开/折叠
- [ ] 实现选中文件夹状态管理（Redux）
- [ ] 显示中英文双语名称

**交付物：**
- ✅ 完整的11个区域文件夹树
- ✅ 用户可以浏览和导航文件夹

---

### 第3周：文件上传与管理
**目标：核心文件操作功能**

#### Day 15-17：文件上传
- [ ] 配置multer文件上传中间件
- [ ] 实现文件上传API
- [ ] 集成已有FileUpload组件
- [ ] 实现上传进度显示

#### Day 18-19：文件列表与下载
- [ ] 实现获取文件列表API
- [ ] 创建文件列表表格组件
- [ ] 实现文件下载功能
- [ ] 添加文件大小、日期等元数据展示

#### Day 20-21：文件属性编辑
- [ ] 实现文件更新API
- [ ] 创建文件编辑弹窗组件
- [ ] 实现版本号修改
- [ ] 实现文件名修改

**交付物：**
- ✅ 用户可以上传文件到指定文件夹
- ✅ 用户可以查看和下载文件
- ✅ 用户可以编辑文件属性

---

### 第4周：文件删除与搜索
**目标：完善基础功能**

#### Day 22-23：虚拟删除
- [ ] 实现文件删除API（软删除）
- [ ] 添加删除按钮到文件列表
- [ ] 实现删除确认对话框
- [ ] 过滤已删除文件

#### Day 24-26：搜索功能
- [ ] 实现基础搜索API（LIKE查询）
- [ ] 创建搜索页面和搜索框
- [ ] 实现搜索结果展示
- [ ] 添加关键词高亮

#### Day 27-28：操作日志
- [ ] 实现日志记录中间件
- [ ] 记录关键操作（登录、上传、删除）
- [ ] 创建管理员日志查看页面（基础）

**交付物：**
- ✅ 完整的文件管理功能（上传、下载、编辑、删除）
- ✅ 基础搜索功能
- ✅ 操作日志记录

---

### 第5-6周：测试、优化与部署
**目标：打磨MVP**

#### Day 29-31：测试与Bug修复
- [ ] 端到端功能测试
- [ ] 修复发现的Bug
- [ ] 优化错误提示
- [ ] 添加加载状态

#### Day 32-34：UI/UX优化
- [ ] 统一界面风格
- [ ] 优化响应式布局
- [ ] 添加图标和徽章
- [ ] 改进颜色方案

#### Day 35-37：安全加固
- [ ] 输入验证和SQL注入防护
- [ ] XSS防护
- [ ] 文件上传安全检查
- [ ] 敏感信息过滤

#### Day 38-42：部署准备
- [ ] 编写部署文档
- [ ] 配置生产环境
- [ ] 设置数据库备份
- [ ] 编写用户使用手册

**最终交付物：**
- ✅ 功能完整的MVP系统
- ✅ 部署文档和用户手册
- ✅ 源代码和数据库脚本

---

## ⏱️ 时间估算

| 阶段 | 工作日 | 累计天数 |
|------|--------|----------|
| 第1周：项目初始化与数据库 | 7天 | 7天 |
| 第2周：文件夹结构模块 | 7天 | 14天 |
| 第3周：文件上传与管理 | 7天 | 21天 |
| 第4周：文件删除与搜索 | 7天 | 28天 |
| 第5-6周：测试与优化 | 10-14天 | 38-42天 |

**总计：6周（42个工作日）**

---

## 🚀 快速启动命令

### 后端启动
```bash
cd backend
npm init -y
npm install express sqlite3 better-sqlite3 jsonwebtoken bcryptjs cors multer
node server.js
```

### 前端启动
```bash
cd frontend
npm install antd @ant-design/icons react-router-dom axios
npm start
```

---

## 📊 MVP功能检查清单

### 功能完整性
- [ ] 用户注册和登录
- [ ] JWT token认证
- [ ] TMF文件夹树展示（11个区域）
- [ ] 文件上传（支持拖拽）
- [ ] 文件列表查看
- [ ] 文件下载
- [ ] 文件属性编辑
- [ ] 虚拟删除文件
- [ ] 文件搜索（按文件名）
- [ ] 操作日志记录
- [ ] 基础权限控制（Admin/User）

### 技术完整性
- [ ] SQLite数据库配置
- [ ] RESTful API实现
- [ ] 前端路由配置
- [ ] Redux状态管理
- [ ] 错误处理机制
- [ ] 响应式UI设计

---

## 📝 后续版本规划

### V2.0 计划功能
1. 文件版本控制和历史记录
2. 权限申请审批工作流
3. 高级搜索和多条件筛选
4. 统计分析和图表
5. 文件预览（PDF在线查看）
6. 批量文件操作

### V3.0 计划功能
1. 电子签名集成
2. 与临床试验管理系统对接
3. 高级报表生成
4. 移动端App
5. 文件自动归档规则

---

**文档版本：** v1.0
**创建日期：** 2025-01-15
**最后更新：** 2025-01-15
**作者：** TMF项目组
