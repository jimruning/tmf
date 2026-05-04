@echo off
echo ====================================
echo 重置管理员密码工具
echo ====================================
echo.

cd backend

echo 检查数据库...
if not exist tmf.db (
    echo ❌ 数据库不存在！
    echo 请先运行 init-db.bat 初始化数据库
    echo.
    pause
    exit /b 1
)

echo 数据库存在
echo.

echo 正在重置管理员密码...
node -e "const bcrypt = require('bcryptjs'); const { db } = require('./config/database'); const newHash = bcrypt.hashSync('admin123', 10); db.prepare('UPDATE users SET password = ? WHERE username = ?').run(newHash, 'admin'); console.log('✅ 密码已重置为: admin123');"

echo.
echo ====================================
echo 密码重置完成！
echo ====================================
echo.
echo 请使用以下信息登录:
echo   用户名: admin
echo   密码: admin123
echo.
pause
