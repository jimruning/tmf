@echo off
echo ====================================
echo TMF 数据库初始化脚本
echo ====================================
echo.

cd backend
echo 正在初始化数据库...
echo.

node scripts/init-db.js

if %errorlevel% neq 0 (
    echo.
    echo ❌ 数据库初始化失败！
    pause
    exit /b 1
)

echo.
echo ====================================
echo ✅ 数据库初始化完成！
echo ====================================
echo.
echo 默认登录信息：
echo   用户名: admin
echo   密码: admin123
echo.
echo ⚠️  请登录后立即修改密码！
echo.
pause
