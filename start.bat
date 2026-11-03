@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title 技能库管理原型

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 pnpm，请先安装 Node.js 和 pnpm。
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo 首次运行，正在安装项目依赖...
  call pnpm install --frozen-lockfile
  if errorlevel 1 goto error
)

echo 正在启动技能库管理原型...
echo 访问地址：http://localhost:8443
echo 关闭此窗口即可停止服务。
echo.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:8443'"
call pnpm dev --host 0.0.0.0 --port 8443 --strictPort
if errorlevel 1 goto error
exit /b 0

:error
echo.
echo [错误] 项目启动失败，请查看上方错误信息。
pause
exit /b 1
