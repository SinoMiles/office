class UserProfile {
  const UserProfile({
    required this.phone,
    required this.balance,
    required this.membership,
  });
  final String phone;
  final num balance;
  final String membership;

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
    phone: '${json['phone'] ?? ''}',
    balance: json['balance'] as num? ?? 0,
    membership: '${json['membershipLevel'] ?? 'FREE'}',
  );
}

class ConversationSummary {
  const ConversationSummary({
    required this.id,
    required this.title,
    this.conversationId,
    this.workspace,
    this.pinned = false,
  });
  final String id;
  final String title;
  final String? conversationId;
  final String? workspace;
  final bool pinned;

  factory ConversationSummary.fromJson(Map<String, dynamic> json) =>
      ConversationSummary(
        id: '${json['_id']}',
        title: ('${json['prompt'] ?? ''}').trim().isEmpty
            ? '新会话'
            : '${json['prompt']}',
        conversationId: json['aionConversationId']?.toString(),
        workspace: json['workspace']?.toString(),
        pinned: json['isPinned'] == true,
      );
}

class ChatAttachment {
  const ChatAttachment({
    required this.name,
    this.id,
    this.url,
    this.previewUrl,
    this.type = '',
    this.status = 'ready',
  });
  final String? id;
  final String name;
  final String? url;
  final String? previewUrl;
  final String type;
  final String status;

  factory ChatAttachment.fromJson(Map<String, dynamic> json) => ChatAttachment(
    id: json['id']?.toString(),
    name: '${json['filename'] ?? json['name'] ?? '文件'}',
    url: json['downloadUrl']?.toString() ?? json['url']?.toString(),
    previewUrl: json['previewUrl']?.toString(),
    type: '${json['fileType'] ?? json['previewType'] ?? ''}',
    status: '${json['status'] ?? 'ready'}',
  );
}

class MessageBlock {
  MessageBlock({
    required this.type,
    required this.id,
    this.content = '',
    this.title = '',
    this.done = false,
    this.level = 'info',
    this.durationMs = 0,
    List<Map<String, dynamic>>? entries,
  }) : entries = entries ?? [];

  final String type;
  final String id;
  String content;
  String title;
  bool done;
  String level;
  int durationMs;
  final List<Map<String, dynamic>> entries;

  factory MessageBlock.fromJson(Map<String, dynamic> json) => MessageBlock(
    type: '${json['type'] ?? 'text'}',
    id: '${json['id'] ?? '${json['type']}:${json.hashCode}'}',
    content: '${json['content'] ?? json['description'] ?? ''}',
    title: '${json['title'] ?? json['subject'] ?? ''}',
    done: json['done'] == true,
    level: '${json['level'] ?? json['status'] ?? 'info'}',
    durationMs:
        int.tryParse('${json['duration'] ?? json['duration_ms'] ?? 0}') ?? 0,
    entries: (json['entries'] as List? ?? const [])
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(),
  );
}

class ChatMessage {
  ChatMessage({
    required this.role,
    this.text = '',
    this.loading = false,
    this.error = false,
    this.createdAt,
    List<MessageBlock>? blocks,
    List<ChatAttachment>? attachments,
  }) : blocks = blocks ?? [],
       attachments = attachments ?? [];
  final String role;
  String text;
  bool loading;
  bool error;
  final String? createdAt;
  final List<MessageBlock> blocks;
  final List<ChatAttachment> attachments;

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final blocks = (json['blocks'] as List? ?? const []).whereType<Map>().map(
      (e) => Map<String, dynamic>.from(e),
    );
    return ChatMessage(
      role: json['role'] == 'ai' ? 'assistant' : '${json['role']}',
      text: '${json['content'] ?? ''}',
      loading: json['loading'] == true,
      error: json['error'] == true,
      createdAt: json['createdAt']?.toString(),
      blocks: blocks.map(MessageBlock.fromJson).toList(),
      attachments: (json['artifacts'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => ChatAttachment.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}
