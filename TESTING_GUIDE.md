# 🧪 TMF系统测试指南

**测试日期：** 2025-01-15
**测试范围：** MVP核心功能
**测试人员：** 开发团队

---

## 📋 测试前准备

### 检查清单
- [ ] Node.js 16+ 已安装
- [ ] 当前在 tmf 项目根目录
- [ ] 有网络连接（下载依赖）

---

## 🚀 第一步：安装依赖

### 方法1：使用批处理脚本（推荐）
双击运行 `install.bat`

### 方法2：手动安装
```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install antd @ant-design/icons react-router-dom axios
```

### ✅ 预期结果
```
✅ 后端依赖安装完成
✅ 前端依赖安装完成
added 23 packages, and audited 24 packages in 15s
```

---

## 🗄️ 第二步：初始化数据库

### 方法1：使用批处理脚本（推荐）
双击运行 `init-db.bat`

### 方法2：手动执行
```bash
cd backend
npm run init-db
```

### ✅ 预期结果
```
🚀 开始初始化TMF数据库...

✅ 数据库表创建成功
✅ 默认管理员账户创建成功 (用户名: admin, 密码: admin123)

📁 开始导入TMF文件夹结构...
✅ 成功导入 251 个文件夹

✨ 数据库初始化完成！

📝 默认登录信息:
   用户名: admin
   密码: admin123

⚠️  生产环境请立即修改默认密码！
```

### 🔍 验证数据库
```bash
# 进入backend目录
cd backend

# 打开SQLite数据库
sqlite3 tmf.db

# 检查表
.tables
# 应该看到：activity_logs  files  folders  users

# 检查文件夹数量
SELECT COUNT(*) FROM folders;
# 应该返回：251

# 检查用户
SELECT username, role FROM users;
# 应该返回：admin|admin

# 退出
.quit
```

---

## 🎮 第三步：启动系统

### 方法1：使用批处理脚本（推荐）
双击运行 `start.bat`

### 方法2：手动启动（2个终端）

**终端1 - 后端：**
```bash
cd backend
npm start
```

**终端2 - 前端：**
```bash
cd frontend
npm start
```

### ✅ 预期结果

**后端终端：**
```
=================================
🚀 TMF 后端服务器启动成功
📍 地址: http://localhost:3001
🏥 健康检查: http://localhost:3001/health
=================================
```

**前端终端：**
```
Compiled successfully!

You can now view frontend in the browser.

  Local:            http://localhost:3000
  on Your Network:  http://192.168.x.x:3000
```

**浏览器自动打开：** http://localhost:3000

---

## ✅ 第四步：功能测试

### 测试1：用户登录 🔐

**步骤：**
1. 打开浏览器访问 http://localhost:3000
2. 应该看到登录页面
3. 输入用户名：`admin`
4. 输入密码：`admin123`
5. 点击"登录"按钮

**✅ 预期结果：**
- [ ] 显示消息提示："登录成功"
- [ ] 自动跳转到 `/dashboard`
- [ ] 页面顶部显示"欢迎, admin"
- [ ] 左侧显示文件夹树
- [ ] 右侧显示提示信息："请从左侧选择一个文件夹查看文件"

**❌ 如果失败：**
- 检查后端是否启动（http://localhost:3001/health）
- 检查数据库是否初始化
- 查看浏览器控制台错误信息

---

### 测试2：浏览TMF文件夹树 📁

**步骤：**
1. 登录后查看左侧文件夹树
2. 点击"01 Trial Management"展开
3. 继续点击"01.01 Trial Oversight"展开
4. 查看文档列表

**✅ 预期结果：**
- [ ] 显示11个一级区域（Zone）
- [ ] 每个区域可以展开/折叠
- [ ] 显示中英文双语名称
- [ ] 三层结构：Zone → Section → Artifact
- [ ] 点击最底层的artifact时，右侧会显示选中状态

**🔍 验证数据：**
```bash
# 在backend目录打开数据库
sqlite3 tmf.db

# 查看Zone分布
SELECT zone_id, zone_name, COUNT(*) as count
FROM folders
GROUP BY zone_id, zone_name
ORDER BY zone_id;

# 应该看到11个Zone：
# 01 | Trial Management
# 02 | Central Trial Documents
# 03 | Regulatory
# ... 等等
```

---

### 测试3：选择文件夹并查看文件 📄

**步骤：**
1. 在左侧文件夹树中选择任意一个artifact（如"01.01.01 Trial Master File Plan"）
2. 观察右侧内容区域变化

**✅ 预期结果：**
- [ ] 右侧显示文件列表表格
- [ ] 表头显示：文件名、版本、文件大小、上传时间、上传者、操作
- [ ] 表格为空或显示已有文件
- [ ] 显示"共 0 个文件"或实际数量
- [ ] 右上角显示"上传文件"按钮

---

### 测试4：上传文件 ⬆️

**步骤：**
1. 选择一个文件夹（如"01.01.01 Trial Master File Plan"）
2. 点击"上传文件"按钮
3. 在弹出的文件选择框中选择一个测试文件（建议小于1MB的PDF或图片）
4. 等待上传完成

**✅ 预期结果：**
- [ ] 显示文件选择对话框
- [ ] 选择文件后开始上传
- [ ] 显示上传进度
- [ ] 上传完成后显示消息："文件上传成功"
- [ ] 文件列表自动刷新，显示新上传的文件
- [ ] 文件信息正确：文件名、大小、时间

**🔍 验证文件：**
```bash
# 检查uploads目录
cd backend
dir uploads

# 检查数据库
sqlite3 tmf.db
SELECT * FROM files ORDER BY upload_date DESC LIMIT 1;
# 应该看到刚上传的文件记录
```

---

### 测试5：文件下载 ⬇️

**步骤：**
1. 在文件列表中找到刚上传的文件
2. 点击"下载"按钮

**✅ 预期结果：**
- [ ] 浏览器开始下载文件
- [ ] 下载的文件名为原始文件名
- [ ] 文件内容完整，可以正常打开

---

### 测试6：文件删除 🗑️

**步骤：**
1. 在文件列表中点击"删除"按钮
2. 确认删除操作

**✅ 预期结果：**
- [ ] 显示确认对话框
- [ ] 确认后显示消息："删除文件"
- [ ] 文件从列表中消失
- [ ] 文件实际上仍然在服务器（软删除）

**🔍 验证软删除：**
```bash
sqlite3 tmf.db

# 查看所有文件（包括已删除）
SELECT id, original_filename, is_deleted FROM files;

# 查看已删除文件
SELECT * FROM files WHERE is_deleted = 1;
# 应该看到刚删除的文件，is_deleted = 1
```

---

### 测试7：修改密码 🔑

**方法1：直接修改数据库（临时方案）**

创建一个修改密码脚本：
```bash
cd backend
node -e "
const bcrypt = require('bcryptjs');
const { db } = require('./config/database');
const newHash = bcrypt.hashSync('your_new_password', 10);
db.prepare('UPDATE users SET password = ? WHERE username = ?').run(newHash, 'admin');
console.log('✅ 密码已修改为: your_new_password');
"
```

**✅ 预期结果：**
- [ ] 显示"密码已修改"
- [ ] 退出登录
- [ ] 使用新密码可以登录
- [ ] 使用旧密码无法登录

---

### 测试8：API健康检查 🏥

**访问健康检查端点：**
```bash
# 在浏览器或curl访问
http://localhost:3001/health
```

**✅ 预期结果：**
```json
{
  "status": "ok",
  "message": "TMF Backend API is running",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

---

## 📊 数据验证清单

### 数据库表验证
```bash
cd backend
sqlite3 tmf.db
```

**检查1：文件夹数量**
```sql
SELECT COUNT(*) FROM folders;
-- ✅ 应该返回：251
```

**检查2：Zone分布**
```sql
SELECT zone_id, zone_name, COUNT(*) as artifacts
FROM folders
GROUP BY zone_id, zone_name
ORDER BY zone_id;
-- ✅ 应该返回11行，每个Zone一行
```

**检查3：完整的文件夹路径**
```sql
SELECT zone_id, section_id, artifact_id, path
FROM folders
LIMIT 10;
-- ✅ 路径格式：01/01.01/01.01.01
```

**检查4：用户账户**
```sql
SELECT id, username, email, role, created_at FROM users;
-- ✅ 应该有1个admin用户
```

**检查5：文件记录（上传文件后）**
```sql
SELECT
  f.id,
  f.original_filename,
  f.version,
  f.file_size,
  f.upload_date,
  u.username as uploader,
  fld.artifact_name
FROM files f
JOIN users u ON f.upload_user_id = u.id
JOIN folders fld ON f.folder_id = fld.id;
-- ✅ 显示所有文件的详细信息
```

---

## 🐛 常见问题排查

### 问题1：后端无法启动
**症状：** `npm start` 报错
**排查：**
```bash
# 检查端口占用
netstat -ano | findstr :3001

# 如果被占用，终止进程或修改端口（.env文件）
```

### 问题2：数据库初始化失败
**症状：** `npm run init-db` 报错
**排查：**
```bash
# 检查fodes.txt是否存在
dir fodes.txt

# 检查数据库文件权限
dir tmf.db

# 手动删除数据库重新初始化
del tmf.db
npm run init-db
```

### 问题3：前端无法连接后端
**症状：** 登录时CORS错误或网络错误
**排查：**
- 确认后端已启动
- 检查端口是否正确（3001）
- 查看浏览器控制台错误信息
- 检查前端代码中的API地址

### 问题4：文件上传失败
**症状：** 点击上传没反应或报错
**排查：**
- 检查uploads目录是否存在且有写权限
- 检查文件大小是否超过100MB
- 查看后端终端错误日志

---

## ✅ 测试完成清单

### 功能测试
- [ ] 用户登录成功
- [ ] JWT token正确存储
- [ ] 文件夹树正确显示
- [ ] 11个Zone完整显示
- [ ] 251个Artifact可访问
- [ ] 文件上传成功
- [ ] 文件下载正常
- [ ] 文件删除（软删除）正常
- [ ] 文件列表实时更新

### 数据验证
- [ ] 数据库4张表创建成功
- [ ] 251个文件夹数据正确
- [ ] 默认admin账户创建
- [ ] 上传的文件记录正确
- [ ] 软删除机制工作正常

### 安全验证
- [ ] 密码已修改（生产必须）
- [ ] JWT认证正常工作
- [ ] 错误处理友好
- [ ] 敏感信息不泄露

---

## 📝 测试报告模板

**测试日期：** _______________
**测试人员：** _______________
**环境：** Windows / Mac / Linux

| 测试项 | 结果 | 备注 |
|--------|------|------|
| 依赖安装 | ☐ 通过 ☐ 失败 | |
| 数据库初始化 | ☐ 通过 ☐ 失败 | 文件夹数量：___ |
| 后端启动 | ☐ 通过 ☐ 失败 | 端口：3001 |
| 前端启动 | ☐ 通过 ☐ 失败 | 端口：3000 |
| 用户登录 | ☐ 通过 ☐ 失败 | |
| 浏览文件夹 | ☐ 通过 ☐ 失败 | Zone数量：___ |
| 文件上传 | ☐ 通过 ☐ 失败 | |
| 文件下载 | ☐ 通过 ☐ 失败 | |
| 文件删除 | ☐ 通过 ☐ 失败 | |
| 密码修改 | ☐ 通过 ☐ 失败 | 新密码：____ |

**总体评价：** ☐ 优秀 ☐ 良好 ☐ 需要改进

**发现的问题：**
1. _________________________________
2. _________________________________
3. _________________________________

**建议改进：**
1. _________________________________
2. _________________________________

---

## 🎉 测试完成后的下一步

### 立即行动
- [ ] 修改默认管理员密码
- [ ] 记录测试结果
- [ ] 修复发现的问题

### 短期计划（本周）
- [ ] 实现文件搜索UI
- [ ] 实现文件属性编辑
- [ ] 添加操作日志查看

### 中期计划（下周）
- [ ] UI/UX优化
- [ ] 性能优化
- [ ] 单元测试

---

**测试指南版本：** v1.0
**最后更新：** 2025-01-15
**维护者：** TMF开发团队
