import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../models.dart';
import '../services/api_client.dart';
import '../theme.dart';

class PreviewPage extends StatefulWidget {
  const PreviewPage({super.key, required this.file, required this.api});
  final ChatAttachment file;
  final ApiClient api;
  @override
  State<PreviewPage> createState() => _PreviewPageState();
}

class _PreviewPageState extends State<PreviewPage> {
  late final WebViewController controller;
  int progress = 0;
  String? error;

  @override
  void initState() {
    super.initState();
    final target = widget.api
        .absolute(widget.file.previewUrl ?? widget.file.url)
        .toString();
    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (value) => setState(() => progress = value),
          onPageFinished: (_) => setState(() => progress = 100),
          onWebResourceError: (value) =>
              setState(() => error = value.description),
        ),
      );
    _load(target);
  }

  Future<void> _load(String target) async {
    final uri = Uri.parse(target);
    final value = widget.api.cookieHeader.replaceFirst('auth_token=', '');
    if (value.isNotEmpty) {
      await WebViewCookieManager().setCookie(
        WebViewCookie(
          name: 'auth_token',
          value: value,
          domain: uri.host,
          path: '/',
        ),
      );
    }
    await controller.loadRequest(uri);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      titleSpacing: 8,
      title: Text(
        widget.file.name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      actions: [
        IconButton(
          onPressed: controller.reload,
          icon: const Icon(Icons.refresh_rounded),
          tooltip: '重新加载',
        ),
      ],
    ),
    body: Column(
      children: [
        if (progress < 100)
          LinearProgressIndicator(
            value: progress == 0 ? null : progress / 100,
            minHeight: 3,
            color: officeGreen,
          ),
        Expanded(
          child: error == null
              ? WebViewWidget(controller: controller)
              : Center(
                  child: Padding(
                    padding: const EdgeInsets.all(28),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.cloud_off_rounded,
                          size: 48,
                          color: Color(0xFF94A3B8),
                        ),
                        const SizedBox(height: 14),
                        const Text(
                          '预览暂时无法加载',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 18,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Color(0xFF64748B)),
                        ),
                        const SizedBox(height: 18),
                        FilledButton.icon(
                          onPressed: () {
                            setState(() => error = null);
                            controller.reload();
                          },
                          icon: const Icon(Icons.refresh),
                          label: const Text('重试'),
                        ),
                      ],
                    ),
                  ),
                ),
        ),
      ],
    ),
  );
}
