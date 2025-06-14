#!/bin/bash

# 创建数据目录（如果不存在）
mkdir -p ../pgdata

# 停止并删除现有容器（如果存在）
echo "停止并删除现有的pg_tsdb容器（如果存在）..."
docker stop pg_tsdb 2>/dev/null || true
docker rm pg_tsdb 2>/dev/null || true

# 启动PostgreSQL 17 + TimescaleDB容器
echo "启动PostgreSQL 17 + TimescaleDB容器..."
docker run -d \
  --name pg_tsdb \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=123654789 \
  -e POSTGRES_DB=iot2 \
  -v "$(pwd)/../pgdata:/var/lib/postgresql/data" \
  -v "$(pwd)/../init-scripts:/docker-entrypoint-initdb.d" \
  -p 6666:5432 \
  timescale/timescaledb-ha:pg17

# 等待数据库启动
echo "等待数据库启动..."
sleep 5

# 检查容器是否成功启动
if [ "$(docker ps -q -f name=pg_tsdb)" ]; then
  echo "PostgreSQL 17 + TimescaleDB 容器已成功启动"
  echo "数据库信息:"
  echo "  - 主机: localhost"
  echo "  - 端口: 6666"
  echo "  - 用户名: postgres"
  echo "  - 密码: 123654789"
  echo "  - 数据库名: iot2"
else
  echo "容器启动失败，请检查日志"
  docker logs pg_tsdb
fi 