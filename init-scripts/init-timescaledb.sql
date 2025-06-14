-- 连接到iot2数据库
\c iot2;

-- 创建TimescaleDB扩展
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- 打印确认信息
\echo 'TimescaleDB扩展已成功安装'; 