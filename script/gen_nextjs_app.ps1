# PowerShell 脚本：自动化创建 Next.js 项目
# 需在项目根目录下运行本脚本

$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
cd $projectPath

# 检查 node_modules 是否存在，避免重复初始化
if (!(Test-Path "node_modules")) {
    npx create-next-app@latest . `
        --typescript `
        --eslint `
        --tailwind `
        --src-dir `
        --app `
        --no-turbo `
        --import-alias "@/*"
} else {
    Write-Host "已存在 node_modules，跳过 create-next-app 初始化。"
} 