# 微信支付 API v3 部署配置

OfficeWeb 使用微信支付 Native 模式生成二维码。支付金额以人民币“分”存储，到账 Credits 使用订单创建时的系统兑换比例计算。

## 商户平台准备

1. 在微信支付商户平台开通 Native 支付，并将应用 AppID 与商户号关联。
2. 创建商户 API 证书，取得商户私钥、证书序列号和 API v3 密钥。
3. 下载微信支付平台公钥（或平台证书）并记录对应序列号/公钥 ID。
4. 将生产域名的 HTTPS 回调地址设置为：`https://你的域名/api/payments/wechat/notify`。

## 服务器环境变量

参照 `.env.example` 配置所有 `WECHAT_PAY_*` 变量。私钥和平台公钥支持两种格式：

- PEM 文本，其中换行可写成 `\n`；
- 完整 PEM 文件内容经过 Base64 编码后的字符串。
- 使用 `WECHAT_PAY_PRIVATE_KEY_FILE` 和 `WECHAT_PAY_PLATFORM_PUBLIC_KEY_FILE` 指向服务器上的绝对文件路径（推荐）。

密钥不得使用 `NEXT_PUBLIC_` 前缀，也不要通过管理后台、日志或浏览器传输。

## 数据库要求

微信支付入账使用 MongoDB 事务，生产 MongoDB 必须以副本集或分片集群运行。事务会将以下操作作为一个原子单元提交：

- 支付订单状态更新；
- 用户 Credits 增加；
- 充值账单流水写入。

## 回调安全

服务端会验证 `Wechatpay-*` 响应头、五分钟时间窗和平台公钥签名，再使用 API v3 密钥执行 AES-256-GCM 解密。只有 AppID、商户号、订单号和支付金额均与本地订单一致时才会入账。重复通知通过订单状态和账单唯一键幂等处理。
