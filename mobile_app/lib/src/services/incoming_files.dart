import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/services.dart';

class IncomingFiles {
  IncomingFiles._();

  static const _channel = MethodChannel('officegpt/incoming_files');
  // Keep files received on the login screen queued until ChatState subscribes.
  static final _controller = StreamController<List<PlatformFile>>();
  static bool _initialized = false;

  static Stream<List<PlatformFile>> get stream => _controller.stream;

  static Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'incomingFiles') {
        _emit(call.arguments);
      }
    });
    try {
      _emit(await _channel.invokeMethod<Object?>('getInitialFiles'));
    } on MissingPluginException {
      // Desktop and web builds do not provide the native inbox.
    }
  }

  static void _emit(Object? value) {
    if (value is! List) return;
    final files = value
        .whereType<Map>()
        .map((item) {
          final map = Map<String, dynamic>.from(item);
          return PlatformFile(
            name: '${map['name'] ?? '文件'}',
            path: map['path']?.toString(),
            size: int.tryParse('${map['size'] ?? 0}') ?? 0,
          );
        })
        .where((file) => file.path != null)
        .toList();
    if (files.isNotEmpty) _controller.add(files);
  }
}
