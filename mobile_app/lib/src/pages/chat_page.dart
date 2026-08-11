import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

import '../app.dart';
import '../app_state.dart';
import '../models.dart';
import '../theme.dart';
import 'preview_page.dart';

class ChatPage extends StatefulWidget {
  const ChatPage({super.key, required this.appState});
  final AppState appState;
  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  late final ChatState chat;
  final input = TextEditingController();
  final scroll = ScrollController();
  bool previewOpening = false;

  @override
  void initState() {
    super.initState();
    chat = ChatState(widget.appState.api);
    chat.addListener(_changed);
  }

  void _changed() {
    if (mounted) setState(() {});
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (scroll.hasClients && scroll.position.extentAfter < 180)
        scroll.animateTo(
          scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
        );
      final file = chat.takePendingPreview();
      if (file != null && !previewOpening && mounted) {
        previewOpening = true;
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => PreviewPage(file: file, api: widget.appState.api),
          ),
        ).whenComplete(() => previewOpening = false);
      }
    });
  }

  @override
  void dispose() {
    chat.removeListener(_changed);
    chat.dispose();
    input.dispose();
    scroll.dispose();
    super.dispose();
  }

  Future<void> send() async {
    final text = input.text;
    if (text.trim().isEmpty) return;
    input.clear();
    await chat.send(text);
  }

  void preview(ChatAttachment file) => Navigator.push(
    context,
    MaterialPageRoute(
      builder: (_) => PreviewPage(file: file, api: widget.appState.api),
    ),
  );

  @override
  Widget build(BuildContext context) => Scaffold(
    drawer: _HistoryDrawer(chat: chat, appState: widget.appState),
    appBar: AppBar(
      titleSpacing: 0,
      title: Row(
        children: [
          const BrandIcon(size: 36),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              chat.active?.title ?? 'OfficeGPT',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
      actions: [
        IconButton(
          onPressed: chat.newConversation,
          icon: const Icon(Icons.edit_square),
          tooltip: '新会话',
        ),
      ],
      bottom: const PreferredSize(
        preferredSize: Size.fromHeight(1),
        child: Divider(height: 1),
      ),
    ),
    body: Column(
      children: [
        Expanded(
          child: chat.loadingHistory
              ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
              : chat.messages.isEmpty
              ? const _EmptyChat()
              : ListView.builder(
                  controller: scroll,
                  padding: const EdgeInsets.fromLTRB(16, 22, 16, 18),
                  itemCount: chat.messages.length,
                  itemBuilder: (_, index) => _MessageCard(
                    message: chat.messages[index],
                    processing:
                        chat.processing && index == chat.messages.length - 1,
                    onPreview: preview,
                  ),
                ),
        ),
        if (chat.error != null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
            color: const Color(0xFFFEF2F2),
            child: Text(
              chat.error!,
              style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 13),
            ),
          ),
        _Composer(chat: chat, controller: input, onSend: send),
      ],
    ),
  );
}

class _EmptyChat extends StatelessWidget {
  const _EmptyChat();
  @override
  Widget build(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(32),
      child: Column(
        children: [
          const BrandIcon(size: 62),
          const SizedBox(height: 18),
          const Text(
            '有什么可以帮您？',
            style: TextStyle(fontSize: 25, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          const Text(
            '上传 Excel、Word、PPT 或 PDF，并告诉我您希望完成什么。',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF64748B), height: 1.5),
          ),
          const SizedBox(height: 28),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            alignment: WrapAlignment.center,
            children: const [
              _Hint(icon: Icons.slideshow_rounded, text: '制作演示文稿'),
              _Hint(icon: Icons.table_chart_rounded, text: '分析表格数据'),
              _Hint(icon: Icons.description_rounded, text: '总结与润色文档'),
            ],
          ),
        ],
      ),
    ),
  );
}

class _Hint extends StatelessWidget {
  const _Hint({required this.icon, required this.text});
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
    decoration: BoxDecoration(
      color: Colors.white,
      border: Border.all(color: const Color(0xFFE2E8F0)),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 17, color: officeGreen),
        const SizedBox(width: 7),
        Text(text, style: const TextStyle(fontSize: 13)),
      ],
    ),
  );
}

class _MessageCard extends StatelessWidget {
  const _MessageCard({
    required this.message,
    required this.processing,
    required this.onPreview,
  });
  final ChatMessage message;
  final bool processing;
  final ValueChanged<ChatAttachment> onPreview;
  @override
  Widget build(BuildContext context) {
    final user = message.role == 'user';
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: user
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        children: [
          if (!user) ...[const BrandIcon(size: 38), const SizedBox(width: 10)],
          Flexible(
            child: Container(
              constraints: const BoxConstraints(maxWidth: 760),
              padding: user
                  ? const EdgeInsets.symmetric(horizontal: 16, vertical: 13)
                  : EdgeInsets.zero,
              decoration: user
                  ? BoxDecoration(
                      color: const Color(0xFFEFF6F4),
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(18),
                        topRight: Radius.circular(5),
                        bottomLeft: Radius.circular(18),
                        bottomRight: Radius.circular(18),
                      ),
                    )
                  : null,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!user)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 8),
                      child: Text(
                        'OfficeGPT',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                        ),
                      ),
                    ),
                  if (user && message.attachments.isNotEmpty)
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: message.attachments
                          .map(
                            (file) => _FileChip(
                              file: file,
                              onTap: file.previewUrl != null || file.url != null
                                  ? () => onPreview(file)
                                  : null,
                            ),
                          )
                          .toList(),
                    ),
                  if (user &&
                      message.attachments.isNotEmpty &&
                      message.text.isNotEmpty)
                    const SizedBox(height: 10),
                  if (!user && message.blocks.isNotEmpty)
                    _MessageTimeline(message: message),
                  if ((user || message.blocks.isEmpty) &&
                      message.text.isNotEmpty)
                    MarkdownBody(
                      data: message.text,
                      selectable: true,
                      styleSheet: _markdownStyle(),
                    ),
                  if (!user && message.attachments.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    ...message.attachments.map(
                      (file) => Padding(
                        padding: const EdgeInsets.only(bottom: 9),
                        child: _ArtifactCard(
                          file: file,
                          onTap: () => onPreview(file),
                        ),
                      ),
                    ),
                  ],
                  if (!user &&
                      processing &&
                      message.blocks.isEmpty &&
                      message.text.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox.square(
                            dimension: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          SizedBox(width: 10),
                          Text(
                            '思考中…',
                            style: TextStyle(color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
          if (user) ...[
            const SizedBox(width: 10),
            const CircleAvatar(
              radius: 19,
              backgroundColor: ink,
              child: Icon(Icons.person_rounded, color: Colors.white, size: 20),
            ),
          ],
        ],
      ),
    );
  }
}

MarkdownStyleSheet _markdownStyle({Color color = ink, double size = 15.5}) =>
    MarkdownStyleSheet(
      p: TextStyle(fontSize: size, height: 1.65, color: color),
      h1: const TextStyle(fontSize: 23, fontWeight: FontWeight.w800),
      h2: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
      h3: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
      blockquoteDecoration: const BoxDecoration(
        border: Border(left: BorderSide(color: Color(0xFFCBD5E1), width: 3)),
      ),
      blockquotePadding: const EdgeInsets.only(left: 12),
      tableBorder: TableBorder.all(color: const Color(0xFFE2E8F0)),
      tableCellsPadding: const EdgeInsets.all(8),
      codeblockDecoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(10),
      ),
    );

class _MessageTimeline extends StatelessWidget {
  const _MessageTimeline({required this.message});
  final ChatMessage message;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      for (final block in message.blocks) ...[
        if (block.type == 'thinking') _ThinkingBlock(block: block),
        if (block.type == 'plan') _PlanBlock(block: block),
        if (block.type == 'tip' || block.type == 'status')
          _NoticeBlock(block: block),
        if (block.type == 'text' && block.content.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: MarkdownBody(
              data: block.content,
              selectable: true,
              styleSheet: _markdownStyle(),
            ),
          ),
        // 与 Web 当前行为一致：底层工具调用保留在状态机中，但不向用户暴露名称和参数。
      ],
      if (message.loading)
        const Padding(
          padding: EdgeInsets.only(top: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox.square(
                dimension: 14,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              SizedBox(width: 8),
              Text(
                '正在继续生成…',
                style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
              ),
            ],
          ),
        ),
    ],
  );
}

class _ThinkingBlock extends StatefulWidget {
  const _ThinkingBlock({required this.block});
  final MessageBlock block;
  @override
  State<_ThinkingBlock> createState() => _ThinkingBlockState();
}

class _ThinkingBlockState extends State<_ThinkingBlock> {
  late bool expanded;
  late bool wasDone;
  @override
  void initState() {
    super.initState();
    wasDone = widget.block.done;
    expanded = !widget.block.done;
  }

  @override
  void didUpdateWidget(covariant _ThinkingBlock oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!wasDone && widget.block.done) expanded = false;
    if (!widget.block.done) expanded = true;
    wasDone = widget.block.done;
  }

  @override
  Widget build(BuildContext context) {
    final block = widget.block;
    final seconds = (block.durationMs / 1000).round();
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => setState(() => expanded = !expanded),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  block.done
                      ? const Icon(
                          Icons.psychology_outlined,
                          size: 16,
                          color: Color(0xFF64748B),
                        )
                      : const SizedBox.square(
                          dimension: 15,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                  const SizedBox(width: 7),
                  Text(
                    block.done
                        ? '思考完成${seconds > 0 ? ' · $seconds 秒' : ''}'
                        : (block.title.isEmpty ? '深度思考中' : block.title),
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF64748B),
                    ),
                  ),
                  const SizedBox(width: 5),
                  AnimatedRotation(
                    turns: expanded ? .25 : 0,
                    duration: const Duration(milliseconds: 180),
                    child: const Icon(
                      Icons.chevron_right,
                      size: 16,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (expanded && block.content.isNotEmpty)
            Container(
              constraints: const BoxConstraints(maxHeight: 260),
              margin: const EdgeInsets.only(left: 21, top: 4),
              padding: const EdgeInsets.fromLTRB(11, 7, 8, 7),
              decoration: const BoxDecoration(
                border: Border(
                  left: BorderSide(color: Color(0xFFE2E8F0), width: 2),
                ),
              ),
              child: SingleChildScrollView(
                child: MarkdownBody(
                  data: block.content,
                  styleSheet: _markdownStyle(
                    color: const Color(0xFF64748B),
                    size: 13,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _PlanBlock extends StatefulWidget {
  const _PlanBlock({required this.block});
  final MessageBlock block;
  @override
  State<_PlanBlock> createState() => _PlanBlockState();
}

class _PlanBlockState extends State<_PlanBlock> {
  bool expanded = true;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: () => setState(() => expanded = !expanded),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.assignment_outlined,
                  size: 17,
                  color: Color(0xFF64748B),
                ),
                const SizedBox(width: 7),
                Text(
                  widget.block.title.isEmpty ? '任务计划' : widget.block.title,
                  style: const TextStyle(
                    fontSize: 13.5,
                    color: Color(0xFF64748B),
                  ),
                ),
                const SizedBox(width: 5),
                Icon(
                  expanded ? Icons.keyboard_arrow_down : Icons.chevron_right,
                  size: 16,
                  color: const Color(0xFF64748B),
                ),
              ],
            ),
          ),
        ),
        if (expanded)
          Padding(
            padding: const EdgeInsets.only(left: 22, top: 5),
            child: Column(
              children: widget.block.entries.map((entry) {
                final done =
                    entry['status'] == 'completed' || entry['done'] == true;
                final text =
                    '${entry['content'] ?? entry['title'] ?? entry['description'] ?? ''}';
                return Padding(
                  padding: const EdgeInsets.only(bottom: 7),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        done
                            ? Icons.check_circle_outline
                            : Icons.radio_button_unchecked,
                        size: 16,
                        color: done
                            ? const Color(0xFF16A34A)
                            : const Color(0xFF94A3B8),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          text,
                          style: TextStyle(
                            fontSize: 13,
                            color: const Color(0xFF475569),
                            decoration: done
                                ? TextDecoration.lineThrough
                                : null,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
      ],
    ),
  );
}

class _NoticeBlock extends StatelessWidget {
  const _NoticeBlock({required this.block});
  final MessageBlock block;
  @override
  Widget build(BuildContext context) {
    final bad = block.level == 'error';
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: bad ? const Color(0xFFFFF7F7) : const Color(0xFFF8FBFF),
        border: Border.all(
          color: bad ? const Color(0xFFFECACA) : const Color(0xFFDBEAFE),
        ),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            bad ? Icons.error_outline : Icons.info_outline,
            size: 17,
            color: bad ? const Color(0xFFB91C1C) : const Color(0xFF475569),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              block.content,
              style: TextStyle(
                fontSize: 13,
                height: 1.5,
                color: bad ? const Color(0xFFB91C1C) : const Color(0xFF475569),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ArtifactCard extends StatelessWidget {
  const _ArtifactCard({required this.file, required this.onTap});
  final ChatAttachment file;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final lower = file.name.toLowerCase();
    final excel =
        lower.endsWith('.xlsx') ||
        lower.endsWith('.xls') ||
        lower.endsWith('.csv');
    final ppt = lower.endsWith('.pptx');
    final color = excel
        ? const Color(0xFF16A34A)
        : ppt
        ? const Color(0xFFEA580C)
        : const Color(0xFF2563EB);
    final icon = excel
        ? Icons.table_chart_rounded
        : ppt
        ? Icons.slideshow_rounded
        : Icons.description_rounded;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: const Color(0xFFE2E8F0)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: color.withValues(alpha: .09),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(icon, size: 20, color: color),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    file.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    file.status == 'generating' ? '生成中 · 点击查看实时预览' : '点击打开预览',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),
            const Text(
              '预览',
              style: TextStyle(
                fontSize: 13,
                color: officeGreen,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FileChip extends StatelessWidget {
  const _FileChip({required this.file, this.onTap});
  final ChatAttachment file;
  final VoidCallback? onTap;
  IconData get icon {
    final n = file.name.toLowerCase();
    if (n.endsWith('.xlsx') || n.endsWith('.xls') || n.endsWith('.csv'))
      return Icons.table_chart_rounded;
    if (n.endsWith('.pptx')) return Icons.slideshow_rounded;
    if (n.endsWith('.pdf')) return Icons.picture_as_pdf_rounded;
    return Icons.description_rounded;
  }

  Color get color {
    final n = file.name.toLowerCase();
    if (n.endsWith('.xlsx') || n.endsWith('.xls') || n.endsWith('.csv'))
      return const Color(0xFF059669);
    if (n.endsWith('.pptx')) return const Color(0xFFEA580C);
    if (n.endsWith('.pdf')) return const Color(0xFFDC2626);
    return const Color(0xFF2563EB);
  }

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(12),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFE2E8F0)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 19, color: color),
          const SizedBox(width: 7),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 180),
            child: Text(
              file.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            ),
          ),
          if (onTap != null)
            const Padding(
              padding: EdgeInsets.only(left: 6),
              child: Icon(
                Icons.chevron_right,
                size: 16,
                color: Color(0xFF94A3B8),
              ),
            ),
        ],
      ),
    ),
  );
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.chat,
    required this.controller,
    required this.onSend,
  });
  final ChatState chat;
  final TextEditingController controller;
  final VoidCallback onSend;

  Future<void> _showAttachmentSources(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      useSafeArea: true,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(18, 0, 18, 22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '添加附件',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            const Text(
              '最多 10 个文件；单个不超过 25MB，合计不超过 100MB。',
              style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _SourceButton(
                    icon: Icons.folder_open_rounded,
                    label: '文件',
                    onTap: () {
                      Navigator.pop(sheetContext);
                      chat.pickFiles();
                    },
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _SourceButton(
                    icon: Icons.photo_library_outlined,
                    label: '相册',
                    onTap: () {
                      Navigator.pop(sheetContext);
                      chat.pickImages();
                    },
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _SourceButton(
                    icon: Icons.photo_camera_outlined,
                    label: '拍照',
                    onTap: () {
                      Navigator.pop(sheetContext);
                      chat.takePhoto();
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            const Row(
              children: [
                Icon(Icons.ios_share_rounded, size: 17, color: officeGreen),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '也可以在微信、邮箱、WPS 或“文件”中选择分享/打开方式 → OfficeGPT。',
                    style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    top: false,
    child: Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      decoration: const BoxDecoration(
        color: canvas,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: Column(
        children: [
          if (chat.pendingFiles.isNotEmpty)
            SizedBox(
              height: 55,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: chat.pendingFiles.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, index) {
                  final file = chat.pendingFiles[index];
                  return _PendingFile(
                    file: file,
                    onDelete: () => chat.removePending(file),
                  );
                },
              ),
            ),
          if (chat.pendingFiles.isNotEmpty) const SizedBox(height: 8),
          if (chat.uploadProgress > 0) ...[
            LinearProgressIndicator(
              value: chat.uploadProgress,
              minHeight: 3,
              borderRadius: BorderRadius.circular(3),
              backgroundColor: const Color(0xFFDDE4EC),
              color: officeGreen,
            ),
            const SizedBox(height: 8),
          ],
          if (chat.uploadFailed) ...[
            const Align(
              alignment: Alignment.centerLeft,
              child: Text(
                '附件上传失败，文件已保留；点击发送即可重试。',
                style: TextStyle(fontSize: 12, color: Color(0xFFB91C1C)),
              ),
            ),
            const SizedBox(height: 8),
          ],
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: const Color(0xFFDDE4EC)),
              borderRadius: BorderRadius.circular(22),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x100F172A),
                  blurRadius: 16,
                  offset: Offset(0, 5),
                ),
              ],
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                IconButton(
                  onPressed: chat.processing
                      ? null
                      : () => _showAttachmentSources(context),
                  icon: const Icon(Icons.attach_file_rounded),
                  color: const Color(0xFF64748B),
                  tooltip: '添加文件',
                ),
                Expanded(
                  child: TextField(
                    controller: controller,
                    minLines: 1,
                    maxLines: 6,
                    textInputAction: TextInputAction.newline,
                    decoration: const InputDecoration(
                      hintText: '描述您的需求…',
                      filled: false,
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(vertical: 15),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(6),
                  child: IconButton.filled(
                    onPressed: chat.processing ? chat.cancel : onSend,
                    icon: Icon(
                      chat.processing
                          ? Icons.stop_rounded
                          : Icons.arrow_upward_rounded,
                    ),
                    style: IconButton.styleFrom(
                      backgroundColor: officeGreen,
                      foregroundColor: Colors.white,
                    ),
                    tooltip: chat.processing ? '停止生成' : '发送',
                  ),
                ),
              ],
            ),
          ),
          const Padding(
            padding: EdgeInsets.only(top: 8),
            child: Text(
              'AI 可能会出错，重要内容请核实',
              style: TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8)),
            ),
          ),
        ],
      ),
    ),
  );
}

class _SourceButton extends StatelessWidget {
  const _SourceButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(16),
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 17),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(icon, color: officeGreen, size: 25),
          const SizedBox(height: 7),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    ),
  );
}

class _PendingFile extends StatelessWidget {
  const _PendingFile({required this.file, required this.onDelete});
  final PlatformFile file;
  final VoidCallback onDelete;

  String get _extension =>
      (file.extension ?? file.name.split('.').last).toLowerCase();
  bool get _isImage =>
      const {'png', 'jpg', 'jpeg', 'webp'}.contains(_extension);
  IconData get _icon {
    if (const {'xlsx', 'xls', 'csv'}.contains(_extension))
      return Icons.table_chart_rounded;
    if (_extension == 'pptx') return Icons.slideshow_rounded;
    if (_extension == 'pdf') return Icons.picture_as_pdf_rounded;
    if (_isImage) return Icons.image_outlined;
    return Icons.description_outlined;
  }

  Color get _color {
    if (const {'xlsx', 'xls', 'csv'}.contains(_extension))
      return const Color(0xFF059669);
    if (_extension == 'pptx') return const Color(0xFFEA580C);
    if (_extension == 'pdf') return const Color(0xFFDC2626);
    if (_isImage) return const Color(0xFF7C3AED);
    return const Color(0xFF2563EB);
  }

  String get _size {
    if (file.size < 1024 * 1024) return '${(file.size / 1024).ceil()}KB';
    return '${(file.size / (1024 * 1024)).toStringAsFixed(1)}MB';
  }

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.only(left: 8, right: 3),
    decoration: BoxDecoration(
      color: Colors.white,
      border: Border.all(color: const Color(0xFFE2E8F0)),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Row(
      children: [
        Container(
          width: 30,
          height: 30,
          decoration: BoxDecoration(
            color: _color.withValues(alpha: .1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: _isImage && file.bytes != null
              ? ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.memory(file.bytes!, fit: BoxFit.cover),
                )
              : Icon(_icon, size: 17, color: _color),
        ),
        const SizedBox(width: 7),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 150),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                file.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                '${_extension.toUpperCase()} · $_size',
                style: const TextStyle(
                  fontSize: 10.5,
                  color: Color(0xFF94A3B8),
                ),
              ),
            ],
          ),
        ),
        IconButton(
          onPressed: onDelete,
          icon: const Icon(Icons.close, size: 17),
          visualDensity: VisualDensity.compact,
        ),
      ],
    ),
  );
}

class _HistoryDrawer extends StatelessWidget {
  const _HistoryDrawer({required this.chat, required this.appState});
  final ChatState chat;
  final AppState appState;
  @override
  Widget build(BuildContext context) => Drawer(
    backgroundColor: const Color(0xFFF8FAFC),
    child: SafeArea(
      child: Column(
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(18, 14, 18, 18),
            child: Row(
              children: [
                BrandIcon(size: 38),
                SizedBox(width: 10),
                Text(
                  'OfficeGPT',
                  style: TextStyle(fontSize: 21, fontWeight: FontWeight.w800),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: SizedBox(
              width: double.infinity,
              height: 48,
              child: FilledButton.icon(
                onPressed: () {
                  chat.newConversation();
                  Navigator.pop(context);
                },
                icon: const Icon(Icons.add),
                label: const Text('新建会话'),
                style: FilledButton.styleFrom(
                  alignment: Alignment.centerLeft,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ),
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(18, 24, 18, 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                '历史记录',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF64748B),
                ),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: chat.refreshConversations,
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                itemCount: chat.conversations.length,
                itemBuilder: (_, index) {
                  final item = chat.conversations[index];
                  return ListTile(
                    selected: chat.active?.id == item.id,
                    selectedTileColor: const Color(0xFFD1FAE5),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    leading: Icon(
                      item.pinned
                          ? Icons.push_pin_rounded
                          : Icons.chat_bubble_outline_rounded,
                      size: 18,
                    ),
                    title: Text(
                      item.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13.5),
                    ),
                    trailing: PopupMenuButton<String>(
                      iconSize: 18,
                      onSelected: (value) {
                        if (value == 'delete') chat.delete(item);
                      },
                      itemBuilder: (_) => const [
                        PopupMenuItem(
                          value: 'delete',
                          child: Row(
                            children: [
                              Icon(
                                Icons.delete_outline,
                                size: 18,
                                color: Colors.red,
                              ),
                              SizedBox(width: 8),
                              Text('删除'),
                            ],
                          ),
                        ),
                      ],
                    ),
                    onTap: () {
                      chat.openConversation(item);
                      Navigator.pop(context);
                    },
                  );
                },
              ),
            ),
          ),
          const Divider(height: 1),
          ListTile(
            leading: const CircleAvatar(
              backgroundColor: ink,
              child: Icon(Icons.person, color: Colors.white, size: 18),
            ),
            title: Text(
              appState.user?.phone ?? '用户',
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
              ),
            ),
            subtitle: Text(
              '${appState.user?.membership ?? 'FREE'} · ${appState.user?.balance ?? 0} Credits',
              style: const TextStyle(fontSize: 11),
            ),
            trailing: IconButton(
              onPressed: appState.logout,
              icon: const Icon(Icons.logout_rounded, size: 19),
              tooltip: '退出登录',
            ),
          ),
        ],
      ),
    ),
  );
}
