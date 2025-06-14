# PostgreSQL 数据库启动脚本

本目录包含用于启动 PostgreSQL 17 + TimescaleDB 数据库容器的脚本。

## 脚本说明

- `start_postgres.ps1`: Windows PowerShell 脚本，用于在 Windows 环境中启动数据库
- `start_postgres.sh`: Bash 脚本，用于在 Linux/Mac 环境中启动数据库

## 配置说明

脚本会自动配置以下内容：

1. 使用 `timescale/timescaledb-ha:pg17` 镜像
2. 容器名称设置为 `pg_tsdb`
3. 数据持久化存储在项目根目录的 `pgdata` 文件夹
4. 初始化脚本位于项目根目录的 `init-scripts` 文件夹
5. 配置以下环境变量：
   - 用户名: postgres
   - 密码: 123654789
   - 数据库名称: iot2
6. 端口映射: 6666:5432（主机:容器）

## 使用方法

### Windows 环境

在 PowerShell 中执行：

```powershell
cd script
.\start_postgres.ps1
```

### Linux/Mac 环境

在终端中执行：

```bash
cd script
chmod +x start_postgres.sh
./start_postgres.sh
```

## 连接信息

启动成功后，可以使用以下信息连接数据库：

- 主机: localhost
- 端口: 6666
- 用户名: postgres
- 密码: 123654789
- 数据库名: iot2 