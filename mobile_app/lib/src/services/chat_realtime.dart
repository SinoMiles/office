import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/io.dart';

import '../config.dart';

class RealtimeEvent {
  const RealtimeEvent(this.name, this.data);
  final String name;
  final Map<String, dynamic> data;
}

class ChatRealtime {
  ChatRealtime({required this.cookie});
  final String cookie;
  final _events = StreamController<RealtimeEvent>.broadcast();
  IOWebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _reconnect;
  bool _closed = false;

  Stream<RealtimeEvent> get events => _events.stream;

  void connect() {
    if (_closed || _channel != null) return;
    try {
      final channel = IOWebSocketChannel.connect(
        AppConfig.ws('/ws'),
        headers: {'Cookie': cookie},
        pingInterval: const Duration(seconds: 20),
      );
      _channel = channel;
      _subscription = channel.stream.listen(
        _onData,
        onError: (_) => _lost(),
        onDone: _lost,
      );
    } catch (_) {
      _lost();
    }
  }

  void _onData(dynamic raw) {
    try {
      final frame = Map<String, dynamic>.from(jsonDecode('$raw') as Map);
      final name = '${frame['name'] ?? frame['event'] ?? ''}';
      final rawData = frame['data'] ?? frame['payload'];
      final data = rawData is Map
          ? Map<String, dynamic>.from(rawData)
          : <String, dynamic>{'content': rawData};
      if (name == 'ping') {
        send('pong', {'timestamp': DateTime.now().millisecondsSinceEpoch});
      } else if (name.isNotEmpty) {
        _events.add(RealtimeEvent(name, data));
      }
    } catch (_) {}
  }

  void _lost() {
    _subscription?.cancel();
    _subscription = null;
    _channel = null;
    if (!_closed) _reconnect = Timer(const Duration(seconds: 2), connect);
  }

  void send(String name, Map<String, dynamic> data) =>
      _channel?.sink.add(jsonEncode({'name': name, 'data': data}));

  Future<void> close() async {
    _closed = true;
    _reconnect?.cancel();
    await _subscription?.cancel();
    await _channel?.sink.close();
    await _events.close();
  }
}
