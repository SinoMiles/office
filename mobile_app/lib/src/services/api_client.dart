import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';

import '../config.dart';
import '../models.dart';
import 'session_store.dart';

class ApiException implements Exception {
  const ApiException(this.message, [this.status]);
  final String message;
  final int? status;
  @override
  String toString() => message;
}

class ProcessResult {
  const ProcessResult({
    required this.taskId,
    required this.conversationId,
    required this.workspace,
  });
  final String taskId;
  final String conversationId;
  final String workspace;
}

class ApiClient {
  ApiClient(this.store)
    : dio = Dio(
        BaseOptions(
          baseUrl: AppConfig.serverUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 60),
        ),
      );
  final SessionStore store;
  final Dio dio;
  String? cookie;

  Future<void> initialize() async => cookie = await store.readCookie();

  Options _options({Map<String, dynamic>? headers, String? contentType}) =>
      Options(
        contentType: contentType,
        headers: {...?headers, if (cookie != null) 'Cookie': cookie},
      );

  Never _fail(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      final message = data is Map ? data['error']?.toString() : null;
      throw ApiException(message ?? '网络连接失败，请稍后重试', error.response?.statusCode);
    }
    throw ApiException(error.toString());
  }

  Future<Map<String, dynamic>> _json(Future<Response<dynamic>> request) async {
    try {
      final response = await request;
      return Map<String, dynamic>.from(response.data as Map);
    } catch (error) {
      _fail(error);
    }
  }

  Future<void> _captureSession(Response<dynamic> response) async {
    final values = response.headers.map['set-cookie'] ?? const [];
    final auth = values
        .map(
          (value) => RegExp(r'auth_token=([^;]+)').firstMatch(value)?.group(1),
        )
        .whereType<String>()
        .firstOrNull;
    if (auth == null) throw const ApiException('服务器没有返回登录凭证');
    cookie = 'auth_token=$auth';
    await store.saveCookie(cookie!);
  }

  Future<UserProfile?> currentUser() async {
    try {
      final data = await _json(dio.get('/api/auth/me', options: _options()));
      return UserProfile.fromJson(
        Map<String, dynamic>.from(data['user'] as Map),
      );
    } on ApiException catch (error) {
      if (error.status == 401) return null;
      rethrow;
    }
  }

  Future<UserProfile> passwordLogin(String phone, String password) async {
    try {
      final response = await dio.post(
        '/api/auth/phone/password-login',
        data: {'phone': phone, 'password': password},
        options: _options(contentType: Headers.jsonContentType),
      );
      await _captureSession(response);
      return UserProfile.fromJson(
        Map<String, dynamic>.from((response.data as Map)['user'] as Map),
      );
    } catch (error) {
      _fail(error);
    }
  }

  Future<Map<String, String>> captcha() async {
    final data = await _json(dio.get('/api/auth/captcha', options: _options()));
    return {'id': '${data['id']}', 'image': '${data['image']}'};
  }

  Future<void> sendSms(String phone, String captchaId, String answer) async {
    await _json(
      dio.post(
        '/api/auth/phone/send-code',
        data: {'phone': phone, 'captchaId': captchaId, 'captchaAnswer': answer},
        options: _options(contentType: Headers.jsonContentType),
      ),
    );
  }

  Future<UserProfile> smsLogin(String phone, String code) async {
    try {
      final response = await dio.post(
        '/api/auth/phone/login',
        data: {'phone': phone, 'code': code},
        options: _options(contentType: Headers.jsonContentType),
      );
      await _captureSession(response);
      return UserProfile.fromJson(
        Map<String, dynamic>.from((response.data as Map)['user'] as Map),
      );
    } catch (error) {
      _fail(error);
    }
  }

  Future<void> logout() async {
    try {
      await dio.post('/api/auth/logout', options: _options());
    } catch (_) {}
    cookie = null;
    await store.clear();
  }

  Future<List<ConversationSummary>> conversations() async {
    final data = await _json(dio.get('/api/user/stats', options: _options()));
    final recent =
        ((data['stats'] as Map?)?['recentTasks'] as List?) ?? const [];
    return recent
        .whereType<Map>()
        .map((e) => ConversationSummary.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<ChatMessage>> conversation(String taskId) async {
    final data = await _json(
      dio.get('/api/tasks/$taskId/conversation', options: _options()),
    );
    final tasks = (data['tasks'] as List? ?? const [])
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
    var messages = (data['messages'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => ChatMessage.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    if (messages.isEmpty) {
      messages = tasks.expand((task) {
        final status = '${task['status'] ?? ''}';
        final response =
            '${task['aiTextResponse'] ?? (task['runtime'] is Map ? (task['runtime'] as Map)['streamedText'] : '') ?? ''}';
        final fallback = status == 'cancelled'
            ? '任务已取消。'
            : status == 'failed'
            ? '处理失败：${task['errorMessage'] ?? '未记录错误详情'}'
            : response;
        return [
          ChatMessage(role: 'user', text: '${task['prompt'] ?? ''}'),
          ChatMessage(
            role: 'assistant',
            text: fallback,
            error: status == 'failed',
          ),
        ];
      }).toList();
    }
    final users = messages.where((item) => item.role == 'user').toList();
    final assistants = messages
        .where((item) => item.role == 'assistant')
        .toList();
    for (var index = 0; index < tasks.length; index++) {
      final task = tasks[index];
      final id = '${task['_id']}';
      final uploads = (task['attachments'] as List? ?? const [])
          .whereType<Map>()
          .toList();
      if (index < users.length) {
        for (
          var attachmentIndex = 0;
          attachmentIndex < uploads.length;
          attachmentIndex++
        ) {
          final name = '${uploads[attachmentIndex]['filename'] ?? '文件'}';
          final extension = name.split('.').last.toLowerCase();
          final office = [
            'doc',
            'docx',
            'xls',
            'xlsx',
            'ppt',
            'pptx',
          ].contains(extension);
          users[index].attachments.add(
            ChatAttachment(
              id: '$id:attachment-$attachmentIndex',
              name: name,
              type: extension,
              previewUrl: office
                  ? '/api/tasks/$id/office-preview/attachment/$attachmentIndex/'
                  : '/api/tasks/$id/download?attachmentIndex=$attachmentIndex&inline=1',
              url: '/api/tasks/$id/download?attachmentIndex=$attachmentIndex',
            ),
          );
        }
      }
      if (index < assistants.length) {
        try {
          final generated = await artifacts(id);
          for (final file in generated) {
            if (!assistants[index].attachments.any(
              (item) => item.id == file.id || item.name == file.name,
            ))
              assistants[index].attachments.add(file);
          }
        } catch (_) {}
      }
    }
    return messages;
  }

  Future<ChatAttachment> startOfficePreview({
    required String taskId,
    required String workspace,
    required String filePath,
  }) async {
    final data = await _json(
      dio.post(
        '/api/tasks/$taskId/office-preview/start',
        data: {'workspace': workspace, 'filePath': filePath},
        options: _options(contentType: Headers.jsonContentType),
      ),
    );
    return ChatAttachment.fromJson(data);
  }

  Future<ProcessResult> process({
    required String prompt,
    String? taskId,
    List<PlatformFile> files = const [],
    ProgressCallback? onSendProgress,
  }) async {
    final form = FormData();
    form.fields.add(MapEntry('prompt', prompt));
    if (taskId != null) form.fields.add(MapEntry('taskId', taskId));
    for (final file in files) {
      final MultipartFile part;
      if (file.path != null) {
        part = await MultipartFile.fromFile(file.path!, filename: file.name);
      } else {
        final Uint8List bytes = file.bytes ?? Uint8List(0);
        part = MultipartFile.fromBytes(bytes, filename: file.name);
      }
      form.files.add(MapEntry('files', part));
    }
    final data = await _json(
      dio.post(
        '/api/process',
        data: form,
        options: _options(headers: {'Accept-Language': 'zh-CN'}),
        onSendProgress: onSendProgress,
      ),
    );
    return ProcessResult(
      taskId: '${data['taskId']}',
      conversationId: '${data['aionConversationId']}',
      workspace: '${data['aionWorkspace'] ?? ''}',
    );
  }

  Future<List<ChatAttachment>> artifacts(String taskId) async {
    final data = await _json(
      dio.get('/api/tasks/$taskId/artifacts', options: _options()),
    );
    return (data['artifacts'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => ChatAttachment.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<void> finish(String taskId, String text) async {
    await _json(
      dio.put(
        '/api/tasks/$taskId/finish',
        data: {'text': text},
        options: _options(contentType: Headers.jsonContentType),
      ),
    );
  }

  Future<void> cancel(String taskId, String? conversationId) async {
    if (conversationId != null) {
      try {
        final state = await _json(
          dio.get(
            '/api/aioncore/api/conversations/$conversationId',
            options: _options(),
          ),
        );
        final root = state['data'] is Map ? state['data'] as Map : state;
        final runtime = root['runtime'] is Map
            ? root['runtime'] as Map
            : const {};
        final turnId = runtime['turn_id']?.toString();
        if (turnId != null && turnId.isNotEmpty) {
          await _json(
            dio.post(
              '/api/aioncore/api/conversations/$conversationId/cancel',
              data: {'turn_id': turnId},
              options: _options(contentType: Headers.jsonContentType),
            ),
          );
        }
      } catch (_) {}
    }
    await _json(dio.post('/api/tasks/$taskId/cancel', options: _options()));
  }

  Future<void> approvePermission(Map<String, dynamic> event) async {
    final data = event['data'] is Map
        ? Map<String, dynamic>.from(event['data'] as Map)
        : event;
    final callId =
        data['call_id']?.toString() ??
        (data['tool_call'] is Map
            ? (data['tool_call'] as Map)['tool_call_id']?.toString()
            : null) ??
        data['tool_call_id']?.toString();
    final options = (data['options'] as List? ?? const [])
        .whereType<Map>()
        .toList();
    const preferred = [
      'proceed_once',
      'allow_once',
      'allow',
      'yes',
      'proceed_always',
    ];
    String? selected;
    for (final key in preferred) {
      if (options.any(
        (item) => '${item['value'] ?? item['option_id'] ?? item['id']}' == key,
      )) {
        selected = key;
        break;
      }
    }
    selected ??= options
        .map((item) => '${item['value'] ?? item['option_id'] ?? item['id']}')
        .where(
          (value) =>
              value.isNotEmpty &&
              !['deny', 'cancel', 'reject', 'no'].contains(value),
        )
        .firstOrNull;
    final conversationId = event['conversation_id']?.toString();
    final messageId = event['msg_id']?.toString();
    if (callId == null ||
        selected == null ||
        conversationId == null ||
        messageId == null)
      return;
    final legacy = options.any((item) => item.containsKey('value'));
    await _json(
      dio.post(
        '/api/aioncore/api/conversations/$conversationId/confirmations/$callId/confirm',
        data: {
          'msg_id': messageId,
          'data': legacy ? {'value': selected} : selected,
          'always_allow': false,
        },
        options: _options(contentType: Headers.jsonContentType),
      ),
    );
  }

  Future<void> deleteConversation(String taskId) async =>
      _json(dio.delete('/api/tasks/$taskId', options: _options()));

  Uri absolute(String? path) => path == null
      ? Uri.parse(AppConfig.serverUrl)
      : Uri.parse(AppConfig.serverUrl).resolve(path);
  String get cookieHeader => cookie ?? '';
  String encodeCookieForPreview() => base64Encode(utf8.encode(cookieHeader));
}
