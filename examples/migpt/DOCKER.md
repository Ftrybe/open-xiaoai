# Docker Compose 使用说明

## 📦 生产环境部署

### 快速启动
```bash
# 构建并启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 配置文件说明
确保以下文件存在并正确配置：
- `config.ts` - 主配置文件
- `custom-rules.json` - 自定义规则配置
- `custom-settings.json` - 自定义设置配置

### 端口映射
- `3000` - Web管理界面
- `4399` - 小爱音响连接端口

## 🔧 开发环境

### 启动开发环境
```bash
# 使用开发配置启动
docker-compose -f docker-compose.dev.yml up -d

# 查看开发日志
docker-compose -f docker-compose.dev.yml logs -f
```

### 开发特性
- 源码热重载
- Node.js调试端口(9229)
- 详细日志输出
- 开发模式启动

## 🗂️ 目录结构

```
examples/migpt/
├── docker-compose.yml          # 生产环境配置
├── docker-compose.dev.yml      # 开发环境配置
├── config.ts                   # 主配置文件
├── custom-rules.json           # 自定义规则
├── custom-settings.json        # 自定义设置
├── logs/                       # 日志目录
├── data/                       # 数据目录
└── web/                        # Web界面文件
```

## 🚀 常用命令

### 生产环境
```bash
# 启动服务
docker-compose up -d

# 重启服务
docker-compose restart

# 更新镜像并重启
docker-compose pull && docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看资源使用
docker stats migpt-app

# 进入容器
docker-compose exec migpt bash
```

### 开发环境
```bash
# 启动开发环境
docker-compose -f docker-compose.dev.yml up -d

# 重新构建开发镜像
docker-compose -f docker-compose.dev.yml build --no-cache

# 查看开发日志
docker-compose -f docker-compose.dev.yml logs -f migpt-dev
```

## 🔧 配置选项

### 环境变量
- `NODE_ENV` - 运行环境 (production/development)
- `TZ` - 时区设置
- `DEBUG` - 调试日志级别

### 资源限制
生产环境默认设置：
- 内存限制：1GB
- CPU限制：1核心
- 保留资源：512MB内存，0.5核心

### SSH配置
如果使用SSH远程执行功能：
1. 确保 `~/.ssh` 目录包含必要的密钥文件
2. 容器内会以只读方式挂载SSH配置

## 🏥 健康检查

服务包含自动健康检查：
- 检查间隔：30秒
- 超时时间：10秒
- 重试次数：3次
- 启动等待：40秒

## 📊 监控

### 查看日志
```bash
# 实时日志
docker-compose logs -f

# 最近100行日志
docker-compose logs --tail=100

# 特定服务日志
docker-compose logs migpt
```

### 性能监控
```bash
# 资源使用情况
docker stats

# 容器信息
docker-compose ps
docker-compose top
```

## 🔄 备份与恢复

### 备份配置
```bash
# 备份配置文件
tar -czf migpt-config-$(date +%Y%m%d).tar.gz config.ts custom-rules.json custom-settings.json

# 备份日志
tar -czf migpt-logs-$(date +%Y%m%d).tar.gz logs/
```

### 数据迁移
配置文件通过volume映射，可以直接在宿主机上编辑和备份。
