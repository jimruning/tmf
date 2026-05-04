@echo off
echo ====================================
echo TMF 系统依赖安装脚本
echo ====================================
echo.

echo [1/2] 正在安装后端依赖...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo 后端依赖安装失败！
    pause
    exit /b 1
)
echo ✅ 后端依赖安装完成
echo.

echo [2/2] 正在安装前端依赖...
cd ..\frontend
call npm install antd @ant-design/icons react-router-dom axios
if %errorlevel% neq 0 (
    echo 前端依赖安装失败！
    pause
    exit /b 1
)
echo ✅ 前端依赖安装完成
echo.

echo ====================================
echo 🎉 所有依赖安装完成！
echo ====================================
echo.
echo 下一步：运行 npm run init-db 初始化数据库
echo.
pause
