FROM node:24-slim

# OfficeCLI is provisioned by @officecli/sdk. ICU is required by its .NET binary.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libicu-dev \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 复制依赖配置
COPY package*.json ./

# 安装依赖
RUN npm ci

# 暴露端口
EXPOSE 3000

# 默认命令 (开发模式)，在 docker-compose 中会被覆盖
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
