# 创建数据目录（如果不存在）
$pgDataPath = Join-Path -Path (Get-Location).Path -ChildPath "..\pgdata"
if (-not (Test-Path -Path $pgDataPath)) {
    New-Item -ItemType Directory -Path $pgDataPath -Force | Out-Null
    Write-Host "已创建数据目录: $pgDataPath"
}

# 停止并删除现有容器（如果存在）
Write-Host "停止并删除现有的pg_tsdb容器（如果存在）..."
docker stop pg_tsdb 2>$null
docker rm pg_tsdb 2>$null

# 启动PostgreSQL 17 + TimescaleDB容器
Write-Host "启动PostgreSQL 17 + TimescaleDB容器..."
$initScriptsPath = Join-Path -Path (Get-Location).Path -ChildPath "..\init-scripts"
docker run -d `
    --name pg_tsdb `
    -e POSTGRES_USER=postgres `
    -e POSTGRES_PASSWORD=123654789 `
    -e POSTGRES_DB=iot2 `
    -v "${pgDataPath}:/var/lib/postgresql/data" `
    -v "${initScriptsPath}:/docker-entrypoint-initdb.d" `
    -p 6666:5432 `
    timescale/timescaledb-ha:pg17

# 等待数据库启动
Write-Host "等待数据库启动..."
Start-Sleep -Seconds 5

# 检查容器是否成功启动
$container = docker ps -q -f name=pg_tsdb
if ($container) {
    Write-Host "PostgreSQL 17 + TimescaleDB 容器已成功启动"
    Write-Host "数据库信息:"
    Write-Host "  - 主机: localhost"
    Write-Host "  - 端口: 6666"
    Write-Host "  - 用户名: postgres"
    Write-Host "  - 密码: 123654789"
    Write-Host "  - 数据库名: iot2"
} else {
    Write-Host "容器启动失败，请检查日志"
    docker logs pg_tsdb
} 