/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  // @officecli/officecli 在运行时定位并 spawn 自带的原生二进制（vendor/officecli），
  // 走 Turbopack 打包后 require 会失败，导致文档预览恒定报 OFFICECLI_NOT_FOUND。
  // 标记为外部依赖，让它保持原生的 Node require 语义。
  serverExternalPackages: ['@officecli/officecli'],
};

export default nextConfig;
