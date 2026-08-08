# OfficeGPT Mobile

独立的 Flutter 移动客户端，复用 OfficeGPT Web 的账号、会话、计费、文件工作区和实时预览服务。

## 当前功能

- 手机号密码登录、短信验证码登录和三个月会话持久化
- 历史会话加载、删除和连续追问
- WebSocket 流式正文、思考过程及停止生成
- 一次选择最多 10 个 PDF、Office、图片文件
- 生成文件卡片和移动端全屏 WebView 预览
- Android/iOS 自适应 OfficeGPT 视觉主题

工具中心、后台、充值和会员管理暂不包含在首版 App 中。

## 本地运行

Android 模拟器默认访问宿主机 `http://10.0.2.2:3000`：

```powershell
flutter run
```

真机调试需把地址换成电脑局域网 IP：

```powershell
flutter run --dart-define=OFFICEGPT_SERVER_URL=http://192.168.1.10:3000
```

生产构建必须使用 HTTPS 域名：

```powershell
flutter build apk --release --dart-define=OFFICEGPT_SERVER_URL=https://officegoai.com
```
