@echo off
echo ====================================
echo TMF 系统启动脚本
echo ====================================
echo.

echo 启动后端服务器（端口 3001）...
start "TMF Backend" cmd /k "cd backend && npm start"

timeout /t 3 /nobreak >nul

echo 启动前端应用（端口 3000）...
start "TMF Frontend" cmd /k "cd frontend && npm start"

echo.
echo ====================================
echo 🚀 系统启动完成！
echo ====================================
echo.
echo 后端地址: http://localhost:3001
echo 前端地址: http://localhost:3000
echo.
echo 浏览器会自动打开前端页面
echo.
echo 默认登录：
echo   用户名: admin
echo   密码: admin123
echo.
echo ====================================
echo.
