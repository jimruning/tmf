# TMF文档管理系统技术实现清单

## 一、技术架构评估

根据需求分析，我对readme.md中的任务拆解进行了审核，并结合用户指定的HTML、CSS、JS、SQLite技术栈，提出以下实现技术清单：

### 1. 前端技术栈

- **HTML5/CSS3**：构建响应式用户界面，支持各种设备访问
- **JavaScript框架**：推荐使用Vue.js或React.js，简化前端开发
- **UI组件库**：Element UI或Bootstrap，提供美观一致的界面组件
- **文件上传组件**：Dropzone.js或Fine-uploader，支持拖拽上传、进度显示等功能
- **PDF预览**：PDF.js，实现在线PDF文件预览
- **数据可视化**：Chart.js或ECharts，用于统计分析功能的图表展示
- **前端路由**：Vue Router或React Router，实现单页应用的路由管理

### 2. 后端技术栈

- **Web服务器**：Node.js + Express.js，轻量级服务器框架
- **数据库**：SQLite，符合用户要求的轻量级数据库
- **ORM框架**：Sequelize或Knex.js，简化数据库操作
- **PDF转换**：pdf-lib或jsPDF，实现文件转PDF功能
- **文件系统操作**：fs-extra，增强的文件系统操作库
- **身份验证**：JWT (JSON Web Tokens)，实现用户认证
- **加密库**：bcrypt.js，用于密码加密存储

## 二、数据库设计

基于SQLite实现以下数据表结构：

1. **用户表(users)**
   - id: INTEGER (主键)
   - username: TEXT (用户名)
   - password: TEXT (加密密码)
   - role: TEXT (角色：管理员、CRC、CRA等)
   - email: TEXT (邮箱)
   - created_at: TIMESTAMP
   - last_login: TIMESTAMP

2. **角色权限表(role_permissions)**
   - id: INTEGER (主键)
   - role: TEXT (角色名称)
   - permission: TEXT (权限代码)
   - folder_pattern: TEXT (可访问的文件夹模式)

3. **文件夹表(folders)**
   - id: INTEGER (主键)
   - zone_id: TEXT (区域ID，如"01")
   - zone_name: TEXT (区域名称，如"Trial Management")
   - section_id: TEXT (部分ID，如"01.01")
   - section_name: TEXT (部分名称，如"Trial Oversight")
   - artifact_id: TEXT (文档ID，如"01.01.01")
   - artifact_name: TEXT (文档名称，如"Trial Master File Plan")
   - path: TEXT (文件夹路径)

4. **文件表(files)**
   - id: INTEGER (主键)
   - folder_id: INTEGER (外键，关联folders表)
   - filename: TEXT (文件名)
   - original_filename: TEXT (原始文件名)
   - version: TEXT (版本号)
   - upload_date: TIMESTAMP
   - upload_user_id: INTEGER (上传用户ID)
   - file_size: INTEGER (文件大小)
   - mime_type: TEXT (文件类型)
   - is_deleted: INTEGER (是否删除，0-否，1-是)
   - delete_user_id: INTEGER (删除用户ID)
   - delete_date: TIMESTAMP
   - file_path: TEXT (文件存储路径)

5. **文件版本表(file_versions)**
   - id: INTEGER (主键)
   - file_id: INTEGER (外键，关联files表)
   - version: TEXT (版本号)
   - upload_date: TIMESTAMP
   - upload_user_id: INTEGER (上传用户ID)
   - file_path: TEXT (文件存储路径)

6. **权限申请表(permission_requests)**
   - id: INTEGER (主键)
   - user_id: INTEGER (申请用户ID)
   - file_id: INTEGER (申请文件ID)
   - request_date: TIMESTAMP
   - reason: TEXT (申请原因)
   - status: TEXT (状态：待审批、已批准、已拒绝)
   - approver_id: INTEGER (审批人ID)
   - approval_date: TIMESTAMP
   - comment: TEXT (审批意见)

7. **操作日志表(activity_logs)**
   - id: INTEGER (主键)
   - user_id: INTEGER (操作用户ID)
   - action: TEXT (操作类型：登录、上传、下载、删除等)
   - target_type: TEXT (操作对象类型：文件、文件夹等)
   - target_id: INTEGER (操作对象ID)
   - action_date: TIMESTAMP
   - ip_address: TEXT (IP地址)
   - details: TEXT (操作详情)

## 三、功能模块实现技术

### 1. 用户登录与权限管理模块
- JWT实现身份验证和会话管理
- bcrypt.js加密存储用户密码
- 基于角色的访问控制(RBAC)实现权限管理
- 前端使用Vuex或Redux管理用户状态

### 2. TMF文件夹结构化设置模块
- 使用递归算法构建多级目录树结构
- 基于fodes.txt数据初始化文件夹结构
- 使用树形控件展示文件夹结构
- 实现中英文双语显示功能

### 3. 文件上传与属性管理模块
- Dropzone.js实现拖拽上传功能
- pdf-lib实现文件转PDF功能
- 文件元数据提取与存储
- 版本控制机制实现

### 4. 文件虚拟删除模块
- 软删除实现，仅标记删除状态
- 回收站功能，支持文件恢复
- 权限控制，限制删除操作

### 5. 文件检索与权限申请模块
- 全文检索功能，支持多条件组合查询
- 权限申请流程实现
- 审批通知机制
- 临时访问权限控制

### 6. 安全技术实现
- HTTPS协议保障传输安全
- 输入验证防止SQL注入和XSS攻击
- CSRF防护措施
- 文件上传安全检查
- 敏感操作日志记录

### 7. 文件存储实现
- 基于文件系统的分层存储结构
- 文件命名规则设计，避免冲突
- 文件备份机制
- 大文件分块上传支持

## 四、开发工具与环境

1. **开发环境**
   - Visual Studio Code或WebStorm作为IDE
   - Node.js环境
   - SQLite数据库管理工具(如SQLite Browser)
   - Git版本控制

2. **构建工具**
   - Webpack或Vite进行前端资源打包
   - npm或yarn管理依赖包
   - Babel转译ES6+代码

3. **测试工具**
   - Jest或Mocha进行单元测试
   - Cypress进行端到端测试
   - Postman测试API接口

## 五、部署方案

1. **开发部署**
   - 本地开发服务器
   - SQLite本地数据库
   - 文件存储在本地文件系统

2. **生产部署**
   - Node.js应用部署在服务器或容器中
   - 使用PM2或Docker管理Node.js进程
   - 配置Nginx作为反向代理服务器
   - 实现定期数据库备份机制

## 六、项目实施计划

1. **第一阶段：基础架构搭建**
   - 前端框架选型与初始化
   - 后端服务器搭建
   - 数据库设计与初始化
   - 文件夹结构导入

2. **第二阶段：核心功能开发**
   - 用户认证与权限管理
   - 文件上传与管理
   - 文件夹浏览与导航
   - 基本检索功能

3. **第三阶段：高级功能开发**
   - 高级检索与过滤
   - 权限申请与审批流程
   - 文件版本控制
   - 统计分析功能

4. **第四阶段：优化与测试**
   - 性能优化
   - 安全测试
   - 用户体验优化
   - 兼容性测试

5. **第五阶段：部署与培训**
   - 系统部署
   - 用户培训
   - 文档编写
   - 系统维护计划