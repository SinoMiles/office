import path from 'node:path';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { connectToDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import SystemSetting from '@/models/SystemSetting';
import Task from '@/models/Task';
import { getAioncoreBaseUrl } from '@/lib/aioncore/config';
import { chatError, chatLog } from '@/lib/aioncore/logger';
import { buildConversationExtra } from '@/lib/aioncore/request-policy';
import { buildAioncoreMessagePayload } from '@/lib/aioncore/message-payload';
import { publicErrorMessage } from '@/lib/aioncore/public-error';
import { releaseTaskReservation, reserveTaskCredits } from '@/lib/billing/service';
import { convertLegacyXls, isLegacyXls } from '@/lib/office/legacy-xls';
import { stageUploadedFile } from '@/lib/workspace/input-files';
import { aioncoreHeaders } from '@/lib/aioncore/bridge-auth';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_FILES = 10;
const MAX_TOTAL_UPLOAD_BYTES = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.xlsx', '.xls', '.csv', '.pptx', '.png', '.jpg', '.jpeg', '.webp']);
const AIONCORE_URL = getAioncoreBaseUrl();

export async function POST(request) {
  let task;
  let billingUserId;
  const requestId = crypto.randomUUID().slice(0, 8);
  const startedAt = Date.now();
  let currentStage = 'authenticate';
  const logStage = (stage, details) => {
    currentStage = stage;
    chatLog('generation', `${requestId} ${stage} +${Date.now() - startedAt}ms`, details);
  };
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    // 未绑定手机号一律不放行。前端靠 code 分辨这一种失败并弹出绑定弹窗，
    // 而不是把它当成普通的报错提示。
    if (!user.phoneVerifiedAt) {
      return NextResponse.json({ error: '请先绑定手机号后再发起任务', code: 'PHONE_REQUIRED' }, { status: 403 });
    }
    if (user.balance <= 0) return NextResponse.json({ error: '余额不足，请联系管理员充值' }, { status: 403 });

    await connectToDatabase();
    logStage('database.connected');
    const formData = await request.formData();
    const prompt = String(formData.get('prompt') || '').trim();
    const productLocale = request.headers.get('accept-language')?.split(',')[0]?.trim() || 'zh-CN';
    const parentTaskId = String(formData.get('taskId') || '').trim();
    const files = formData.getAll('files').filter((item) => item && typeof item.arrayBuffer === 'function');
    const legacyFile = formData.get('file');
    if (!files.length && legacyFile && typeof legacyFile.arrayBuffer === 'function') files.push(legacyFile);
    if (!prompt) return NextResponse.json({ error: '请输入处理需求' }, { status: 400 });
    if (files.length > MAX_UPLOAD_FILES) return NextResponse.json({ error: `每次最多上传 ${MAX_UPLOAD_FILES} 个文件` }, { status: 400 });
    if (files.reduce((total, item) => total + Number(item.size || 0), 0) > MAX_TOTAL_UPLOAD_BYTES) return NextResponse.json({ error: '文件总大小不能超过 100MB' }, { status: 400 });
    logStage(`request.parsed files=${files.length} continuation=${Boolean(parentTaskId)}`);
    const parentTask = parentTaskId
      ? await Task.findOne({ _id: parentTaskId, userId: user._id })
      : null;
    if (parentTaskId && !parentTask) {
      return NextResponse.json({ error: '历史任务不存在或无权访问' }, { status: 404 });
    }

    const settings = await SystemSetting.find({ key: { $in: ['llm', 'billing'] } }).lean();
    logStage('settings.loaded');
    const billing = settings.find((item) => item.key === 'billing')?.value || {};
    billingUserId = user._id;
    const coreUserId = String(user._id);
    const coreHeaders = (initial = {}) => aioncoreHeaders(coreUserId, initial);
    const llm = settings.find((item) => item.key === 'llm')?.value || {};
    const configuredModel = llm.model || process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
    // The model provider is a platform-level secret owned by Core's system
    // account. Conversations remain user-scoped, while the runtime resolves
    // this shared provider internally without exposing its credential.
    const aionModelPayload = {
      provider_id: 'deepseek',
      model: configuredModel,
      use_model: configuredModel,
    };

    // Create a unique aionConversationId for the whole task chain, or inherit
    let aionConversationId = parentTask?.aionConversationId;
    if (!aionConversationId) {
      const payload = { type: 'aionrs', extra: buildConversationExtra({ product_locale: productLocale }) };
      if (aionModelPayload) {
        payload.model = aionModelPayload;
      }
      
      const convRes = await fetch(`${AIONCORE_URL}/api/conversations`, {
        method: 'POST',
        headers: coreHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      if (!convRes.ok) throw new Error('创建 OfficeGPT 会话失败');
      const convJson = await convRes.json();
      aionConversationId = convJson.data?.id || crypto.randomUUID();
      logStage('conversation.created', { conversation_id: aionConversationId });
    } else {
      // Existing task chains may predate the OfficeWeb response policy. Keep
      // the instruction in conversation context instead of polluting user text.
      const policyRes = await fetch(`${AIONCORE_URL}/api/conversations/${aionConversationId}`, {
        method: 'PATCH',
        headers: coreHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ extra: buildConversationExtra({ product_locale: productLocale }), merge_extra: true }),
        signal: AbortSignal.timeout(10000),
      });
      logStage(`conversation.policy status=${policyRes.status}`, { conversation_id: aionConversationId });
    }

    const runtimeRes = await fetch(`${AIONCORE_URL}/api/conversations/${aionConversationId}`, {
      headers: coreHeaders(), signal: AbortSignal.timeout(10000),
    });
    if (runtimeRes.ok) {
      const runtimePayload = await runtimeRes.json();
      if (runtimePayload.data?.runtime?.can_send_message === false) {
        const conflict = new Error('上一条指令仍在处理中，请等待完成后再发送');
        conflict.status = 409;
        throw conflict;
      }
    }
    logStage(`conversation.runtime status=${runtimeRes.status}`, { conversation_id: aionConversationId });

    task = await Task.create({
      userId: user._id,
      parentTaskId: parentTask?._id,
      prompt,
      aionConversationId,
      status: 'processing',
      runtime: { state: 'running', updatedAt: new Date() },
    });
    logStage(`task.created id=${task._id}`, { conversation_id: aionConversationId });

    const reservedBilling = await reserveTaskCredits({
      taskId: task._id,
      userId: user._id,
      model: aionModelPayload?.model || configuredModel,
      membershipLevel: user.membershipLevel,
      billingSettings: billing,
    });
    logStage('billing.reserved', { conversation_id: aionConversationId });

    // Resolve and persist the canonical conversation workspace before handling
    // attachments. AionCore's upload endpoint returns a temporary intake path;
    // document work and preview discovery must both use the workspace copy.
    let aionWorkspace = '';
    try {
      const conversationRes = await fetch(`${AIONCORE_URL}/api/conversations/${aionConversationId}`, {
        headers: coreHeaders(), signal: AbortSignal.timeout(5000),
      });
      if (conversationRes.ok) {
        const conversationPayload = await conversationRes.json();
        aionWorkspace = conversationPayload.data?.extra?.workspace || conversationPayload.data?.workspace || '';
      }
      if (!aionWorkspace) throw new Error('OfficeGPT 会话工作区尚未准备完成');
      task.workspace = aionWorkspace;
      await task.save();
      void fetch(`${AIONCORE_URL}/api/fs/office-watch/start`, {
        method: 'POST',
        headers: coreHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ workspace: aionWorkspace }),
        signal: AbortSignal.timeout(5000),
      }).then((watchRes) => {
        chatLog('preview', `workspace watcher start response ${watchRes.status}`, { conversation_id: aionConversationId });
      }).catch((error) => {
        chatError('preview', 'workspace watcher did not start in time', error);
      });
    } catch (error) {
      chatError('preview', 'failed to prepare workspace', error);
      throw new Error('OfficeGPT 暂时无法准备文件工作区，请稍后重试');
    }
    logStage('workspace.ready available=true', { conversation_id: aionConversationId });

    let filename = parentTask?.filename || '';
    const uploadedAttachments = [];
    const messageAttachments = [];
    for (const file of files) {
      if (file.size > MAX_UPLOAD_BYTES) throw new Error(`文件 ${file.name} 不能超过 25MB`);
      const originalSafeFilename = path.basename(file.name).replace(/[^\p{L}\p{N}._-]+/gu, '_');
      const extension = path.extname(originalSafeFilename).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error(`不支持文件格式：${file.name}`);
      let safeFilename = originalSafeFilename;
      let uploadFile = file;
      let uploadSize = file.size;
      let uploadMimeType = file.type;
      if (isLegacyXls(originalSafeFilename)) {
        const converted = convertLegacyXls(Buffer.from(await file.arrayBuffer()), originalSafeFilename);
        if (converted.buffer.length > MAX_UPLOAD_BYTES) throw new Error(`文件 ${file.name} 转换后不能超过 25MB`);
        safeFilename = converted.filename;
        uploadFile = new Blob([converted.buffer], { type: converted.mimeType });
        uploadSize = converted.buffer.length;
        uploadMimeType = converted.mimeType;
        chatLog('attachments', `converted legacy workbook ${originalSafeFilename} -> ${safeFilename}`, { conversation_id: aionConversationId, sheets: converted.sheetCount });
      }
      const uploadData = new FormData();
      uploadData.append('file', uploadFile, safeFilename);
      uploadData.append('file_name', safeFilename);
      uploadData.append('conversation_id', aionConversationId);
      const aioncoreRes = await fetch(`${AIONCORE_URL}/api/fs/upload`, {
        method: 'POST',
        headers: coreHeaders(),
        body: uploadData,
        signal: AbortSignal.timeout(60000),
      });
      if (!aioncoreRes.ok) throw new Error(`上传附件失败：${file.name}`);
      const resJson = await aioncoreRes.json();
      const staged = await stageUploadedFile({
        sourcePath: resJson.data,
        workspace: aionWorkspace,
        taskId: task._id,
        filename: safeFilename,
      });
      uploadedAttachments.push({
        filename: safeFilename,
        filePath: staged.filePath,
        size: uploadSize,
        mimeType: uploadMimeType,
        uploadedMtimeMs: staged.uploadedMtimeMs,
      });
      messageAttachments.push({
        filename: safeFilename,
        uploadPath: resJson.data,
      });
    }
    if (uploadedAttachments.length) {
      filename = uploadedAttachments[0].filename;
      await Task.updateOne(
        { _id: task._id },
        { $set: { filename, originalFile: uploadedAttachments[0].filePath, attachments: uploadedAttachments } }
      );
    }
    logStage(`attachments.ready count=${uploadedAttachments.length}`, { conversation_id: aionConversationId });

    // Tell AionCore to start generating
    const aiRes = await fetch(`${AIONCORE_URL}/api/conversations/${aionConversationId}/messages`, {
      method: 'POST',
      headers: coreHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(buildAioncoreMessagePayload({
        content: prompt,
        attachments: messageAttachments,
      })),
      signal: AbortSignal.timeout(20000),
    });
    logStage(`message.response status=${aiRes.status}`, { conversation_id: aionConversationId });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('[AionCore] Reject message:', errText);
      if (aiRes.status === 409) {
        const conflict = new Error('上一条指令仍在处理中，请等待完成后再发送');
        conflict.status = 409;
        throw conflict;
      }
      throw new Error('OfficeGPT 暂时无法启动生成，请稍后重试');
    }

    logStage('request.completed', { conversation_id: aionConversationId });
    return NextResponse.json({
      success: true,
      taskId: String(task._id),
      aionConversationId,
      aionWorkspace,
      reservedCredits: reservedBilling.reservationCredits,
    });

  } catch (error) {
    chatError('generation', `${requestId} failed at ${currentStage} +${Date.now() - startedAt}ms`, error);
    const userMessage = publicErrorMessage(error);
    if (task?._id && billingUserId) {
      await releaseTaskReservation({ taskId: task._id, userId: billingUserId, reason: '任务启动失败，退回预授权额度' }).catch((releaseError) => {
        chatError('billing', 'failed to release reservation after startup error', releaseError);
      });
      await Task.updateOne({ _id: task._id }, { $set: { status: 'failed', 'runtime.state': 'failed', errorMessage: userMessage } }).catch(() => undefined);
    }
    return NextResponse.json({ error: userMessage }, { status: error.status || 500 });
  }
}
