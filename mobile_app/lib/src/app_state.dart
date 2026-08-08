import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';

import 'models.dart';
import 'services/api_client.dart';
import 'services/chat_realtime.dart';
import 'services/incoming_files.dart';
import 'services/session_store.dart';

class AppState extends ChangeNotifier {
  AppState() : api = ApiClient(SessionStore());
  final ApiClient api;
  UserProfile? user;
  bool initialized = false;

  Future<void> initialize() async {
    await IncomingFiles.initialize();
    await api.initialize();
    if (api.cookie != null) user = await api.currentUser();
    initialized = true;
    notifyListeners();
  }

  Future<void> passwordLogin(String phone, String password) async {
    user = await api.passwordLogin(phone, password);
    notifyListeners();
  }

  Future<void> smsLogin(String phone, String code) async {
    user = await api.smsLogin(phone, code);
    notifyListeners();
  }

  Future<void> logout() async {
    await api.logout();
    user = null;
    notifyListeners();
  }
}

class ChatState extends ChangeNotifier {
  ChatState(this.api) {
    realtime = ChatRealtime(cookie: api.cookieHeader)..connect();
    _subscription = realtime.events.listen(_handleEvent);
    refreshConversations();
    IncomingFiles.initialize();
    _incomingSubscription = IncomingFiles.stream.listen(addFiles);
  }
  final ApiClient api;
  late final ChatRealtime realtime;
  StreamSubscription<RealtimeEvent>? _subscription;
  StreamSubscription<List<PlatformFile>>? _incomingSubscription;
  List<ConversationSummary> conversations = [];
  List<ChatMessage> messages = [];
  List<PlatformFile> pendingFiles = [];
  double uploadProgress = 0;
  bool uploadFailed = false;
  ConversationSummary? active;
  String? activeTaskId;
  String? activeConversationId;
  String activeWorkspace = '';
  ChatAttachment? pendingPreview;
  bool loadingHistory = false;
  bool processing = false;
  String? error;
  Timer? _artifactPoll;
  final Map<String, MessageBlock> _streamBlocks = {};
  final Set<String> _seenArtifacts = {};
  final List<Map<String, dynamic>> _pendingOfficeEvents = [];
  String? _finishingTaskId;

  Future<void> refreshConversations() async {
    try {
      conversations = await api.conversations();
    } catch (e) {
      error = '$e';
    }
    notifyListeners();
  }

  Future<void> openConversation(ConversationSummary item) async {
    active = item;
    activeTaskId = item.id;
    activeConversationId = item.conversationId;
    activeWorkspace = item.workspace ?? '';
    loadingHistory = true;
    messages = [];
    notifyListeners();
    try {
      messages = await api.conversation(item.id);
      if (item.conversationId != null)
        realtime.send('chat:history:load', {
          'conversation_id': item.conversationId,
        });
    } catch (e) {
      error = '$e';
    }
    loadingHistory = false;
    notifyListeners();
  }

  void newConversation() {
    active = null;
    activeTaskId = null;
    activeConversationId = null;
    activeWorkspace = '';
    pendingPreview = null;
    _streamBlocks.clear();
    _seenArtifacts.clear();
    messages = [];
    pendingFiles = [];
    error = null;
    notifyListeners();
  }

  Future<void> pickFiles() async {
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: true,
      withData: kIsWeb,
      allowedExtensions: [
        'pdf',
        'xlsx',
        'xls',
        'csv',
        'docx',
        'pptx',
        'png',
        'jpg',
        'jpeg',
        'webp',
      ],
      type: FileType.custom,
    );
    if (result == null) return;
    addFiles(result.files);
  }

  Future<void> pickImages() async {
    final images = await ImagePicker().pickMultiImage(imageQuality: 95);
    addFiles(await Future.wait(images.map(_platformFile)));
  }

  Future<void> takePhoto() async {
    final image = await ImagePicker().pickImage(
      source: ImageSource.camera,
      imageQuality: 95,
    );
    if (image != null) addFiles([await _platformFile(image)]);
  }

  Future<PlatformFile> _platformFile(XFile file) async =>
      PlatformFile(name: file.name, path: file.path, size: await file.length());

  void addFiles(List<PlatformFile> files) {
    final keys = pendingFiles.map((e) => '${e.name}:${e.size}').toSet();
    pendingFiles = [
      ...pendingFiles,
      ...files.where((file) => keys.add('${file.name}:${file.size}')),
    ].take(10).toList();
    uploadFailed = false;
    notifyListeners();
  }

  void removePending(PlatformFile file) {
    pendingFiles.remove(file);
    notifyListeners();
  }

  Future<void> send(String text) async {
    if (processing || text.trim().isEmpty) return;
    final files = List<PlatformFile>.from(pendingFiles);
    pendingFiles = [];
    uploadProgress = files.isEmpty ? 0 : .01;
    uploadFailed = false;
    messages.add(
      ChatMessage(
        role: 'user',
        text: text.trim(),
        attachments: files.map((f) => ChatAttachment(name: f.name)).toList(),
      ),
    );
    processing = true;
    error = null;
    _streamBlocks.clear();
    messages.add(ChatMessage(role: 'assistant', loading: true));
    notifyListeners();
    try {
      final result = await api.process(
        prompt: text.trim(),
        taskId: activeTaskId,
        files: files,
        onSendProgress: files.isEmpty
            ? null
            : (sent, total) {
                if (total <= 0) return;
                uploadProgress = sent / total;
                notifyListeners();
              },
      );
      uploadProgress = 0;
      activeTaskId = result.taskId;
      activeConversationId = result.conversationId;
      activeWorkspace = result.workspace;
      final waitingPreviewEvents = List<Map<String, dynamic>>.from(
        _pendingOfficeEvents,
      );
      _pendingOfficeEvents.clear();
      for (final event in waitingPreviewEvents)
        unawaited(_openRealtimePreview(event));
      _startArtifactPolling();
    } catch (e) {
      pendingFiles = files;
      uploadProgress = 0;
      uploadFailed = files.isNotEmpty;
      processing = false;
      messages.last.text = '处理失败：$e';
      messages.last.error = true;
      messages.last.loading = false;
      error = '$e';
      notifyListeners();
    }
  }

  void _handleEvent(RealtimeEvent event) {
    final data = event.data;
    if (activeConversationId != null &&
        data['conversation_id'] != null &&
        '${data['conversation_id']}' != activeConversationId)
      return;
    if (event.name == 'chat:history:page' && data['items'] is List) return;
    if (event.name == 'workspaceOfficeWatch.fileAdded') {
      if (activeTaskId == null || activeWorkspace.isEmpty) {
        _pendingOfficeEvents.add(data);
        return;
      }
      unawaited(_openRealtimePreview(data));
      return;
    }
    if (event.name == 'message.stream') {
      final type = '${data['type'] ?? ''}';
      if (type == 'permission' || type == 'acp_permission') {
        unawaited(api.approvePermission(data));
      }
      if (['finish', 'error', 'cancelled'].contains(type)) {
        processing = false;
        final message = _assistant();
        message.loading = false;
        for (final block in message.blocks.where(
          (item) => item.type == 'thinking',
        ))
          block.done = true;
        if (type == 'error') {
          message.error = true;
          final detail = _text(data);
          if (detail.isNotEmpty)
            message.blocks.add(
              MessageBlock(
                type: 'tip',
                id: 'error:${data['msg_id'] ?? DateTime.now().millisecondsSinceEpoch}',
                content: detail,
                level: 'error',
                done: true,
              ),
            );
        }
        _completeTask();
      } else {
        processing = true;
        final message = _assistant();
        message.loading = true;
        _mergeBlock(message, type, data);
      }
      notifyListeners();
    } else if (event.name == 'turn.completed') {
      processing = false;
      final message = _assistant()..loading = false;
      for (final block in message.blocks.where(
        (item) => item.type == 'thinking',
      ))
        block.done = true;
      _completeTask();
      notifyListeners();
    } else if (event.name == 'realtime.error') {
      processing = false;
      error = _text(data).isEmpty ? '生成失败，请重试' : _text(data);
      final message = _assistant()
        ..loading = false
        ..error = true;
      message.blocks.add(
        MessageBlock(
          type: 'tip',
          id: 'realtime-error:${DateTime.now().millisecondsSinceEpoch}',
          content: error!,
          level: 'error',
          done: true,
        ),
      );
      notifyListeners();
    }
  }

  ChatMessage _assistant() {
    if (messages.isEmpty || messages.last.role != 'assistant')
      messages.add(ChatMessage(role: 'assistant', loading: processing));
    return messages.last;
  }

  void _mergeBlock(
    ChatMessage message,
    String type,
    Map<String, dynamic> data,
  ) {
    if (['start', 'finish', 'permission', 'acp_permission'].contains(type))
      return;
    final messageId = '${data['msg_id'] ?? 'stream'}';
    final normalized = type == 'thought'
        ? 'thinking'
        : type == 'content'
        ? 'text'
        : type;
    final key = '$messageId:$normalized';
    final payload = data['data'] is Map
        ? Map<String, dynamic>.from(data['data'] as Map)
        : data['content'] is Map
        ? Map<String, dynamic>.from(data['content'] as Map)
        : <String, dynamic>{};
    if (normalized == 'thinking' || normalized == 'text') {
      final chunk = _text(data);
      if (chunk.isEmpty) return;
      final block = _streamBlocks.putIfAbsent(key, () {
        final value = MessageBlock(
          type: normalized,
          id: key,
          title: normalized == 'thinking'
              ? '${payload['subject'] ?? '深度思考中'}'
              : '',
        );
        message.blocks.add(value);
        return value;
      });
      block.content += chunk;
      block.done = payload['status'] == 'done';
      block.durationMs =
          int.tryParse(
            '${payload['duration'] ?? payload['duration_ms'] ?? block.durationMs}',
          ) ??
          block.durationMs;
      if (normalized == 'text') message.text += chunk;
      return;
    }
    if (normalized == 'plan') {
      final block = MessageBlock(
        type: 'plan',
        id: key,
        title: '${payload['title'] ?? '任务计划'}',
        entries:
            (payload['entries'] as List? ??
                    payload['steps'] as List? ??
                    const [])
                .whereType<Map>()
                .map((item) => Map<String, dynamic>.from(item))
                .toList(),
      );
      _replaceBlock(message, key, block);
      return;
    }
    if (normalized == 'agent_status' || normalized == 'tips') {
      final content =
          '${payload['message'] ?? payload['content'] ?? payload['description'] ?? _text(data)}';
      if (content.isEmpty) return;
      _replaceBlock(
        message,
        key,
        MessageBlock(
          type: normalized == 'tips' ? 'tip' : 'status',
          id: key,
          content: content,
          level: '${payload['type'] ?? data['status'] ?? 'info'}',
          done: true,
        ),
      );
      return;
    }
    if (['tool_group', 'tool_call', 'acp_tool_call'].contains(normalized)) {
      _replaceBlock(
        message,
        key,
        MessageBlock(type: 'tools', id: key, title: '正在处理任务', done: false),
      );
    }
  }

  void _replaceBlock(ChatMessage message, String key, MessageBlock block) {
    final existing = message.blocks.indexWhere((item) => item.id == key);
    if (existing >= 0)
      message.blocks[existing] = block;
    else
      message.blocks.add(block);
    _streamBlocks[key] = block;
  }

  Future<void> _openRealtimePreview(Map<String, dynamic> event) async {
    final task = activeTaskId;
    final workspace = activeWorkspace.isNotEmpty
        ? activeWorkspace
        : '${event['workspace'] ?? ''}';
    final filePath = '${event['file_path'] ?? ''}';
    if (task == null || workspace.isEmpty || filePath.isEmpty) return;
    try {
      final file = await api.startOfficePreview(
        taskId: task,
        workspace: workspace,
        filePath: filePath,
      );
      _attachArtifact(file, autoOpen: true);
    } catch (_) {}
  }

  String _text(Map<String, dynamic> data) {
    final content = data['content'];
    if (content is String) return content;
    if (content is Map)
      return '${content['content'] ?? content['description'] ?? ''}';
    final nested = data['data'];
    if (nested is String) return nested;
    if (nested is Map)
      return '${nested['content'] ?? nested['description'] ?? ''}';
    return '';
  }

  void _startArtifactPolling() {
    _artifactPoll?.cancel();
    _artifactPoll = Timer.periodic(const Duration(seconds: 2), (_) async {
      final task = activeTaskId;
      if (task == null) return;
      try {
        final files = await api.artifacts(task);
        for (final file in files) _attachArtifact(file, autoOpen: true);
        notifyListeners();
      } catch (_) {}
      if (!processing) _artifactPoll?.cancel();
    });
  }

  Future<void> _completeTask() async {
    _artifactPoll?.cancel();
    final task = activeTaskId;
    if (task != null) {
      if (_finishingTaskId == task) return;
      _finishingTaskId = task;
      try {
        final text = messages.lastOrNull?.text ?? '';
        await api.finish(task, text);
        final files = await api.artifacts(task);
        for (final file in files) _attachArtifact(file);
        await refreshConversations();
      } catch (_) {
      } finally {
        if (_finishingTaskId == task) _finishingTaskId = null;
      }
    }
  }

  void _attachArtifact(ChatAttachment file, {bool autoOpen = false}) {
    final assistant = _assistant();
    final identity = file.id ?? '${file.name}:${file.previewUrl}';
    final existing = assistant.attachments.indexWhere(
      (item) => (item.id ?? '${item.name}:${item.previewUrl}') == identity,
    );
    if (existing >= 0)
      assistant.attachments[existing] = file;
    else
      assistant.attachments.add(file);
    if (_seenArtifacts.add(identity) && autoOpen) pendingPreview = file;
    notifyListeners();
  }

  ChatAttachment? takePendingPreview() {
    final value = pendingPreview;
    pendingPreview = null;
    return value;
  }

  Future<void> cancel() async {
    final task = activeTaskId;
    if (task == null) return;
    await api.cancel(task, activeConversationId);
    processing = false;
    notifyListeners();
  }

  Future<void> delete(ConversationSummary item) async {
    await api.deleteConversation(item.id);
    if (active?.id == item.id) newConversation();
    await refreshConversations();
  }

  @override
  void dispose() {
    _artifactPoll?.cancel();
    _subscription?.cancel();
    _incomingSubscription?.cancel();
    realtime.close();
    super.dispose();
  }
}
