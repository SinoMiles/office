import path from 'node:path';
import fs from 'node:fs/promises';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { connectToDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import SystemSetting from '@/models/SystemSetting';
import BillingRecord from '@/models/BillingRecord';
import Task from '@/models/Task';
import { getAioncoreBaseUrl } from '@/lib/aioncore/config';
import { chatError, chatLog } from '@/lib/aioncore/logger';
import { buildConversationExtra } from '@/lib/aioncore/request-policy';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.xlsx', '.xls', '.csv', '.pptx', '.png', '.jpg', '.jpeg', '.webp']);
const AIONCORE_URL = getAioncoreBaseUrl();

function storageRoot() {
  return path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'));
}

export async function POST(request) {
  let task;
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    if (user.balance <= 0) return NextResponse.json({ error: '余额不足，请联系管理员充值' }, { status: 403 });

    await connectToDatabase();
    const formData = await request.formData();
    const prompt = String(formData.get('prompt') || '').trim();
    const productLocale = request.headers.get('accept-language')?.split(',')[0]?.trim() || 'zh-CN';
    const parentTaskId = String(formData.get('taskId') || '').trim();
    const file = formData.get('file');
    if (!prompt) return NextResponse.json({ error: '请输入处理需求' }, { status: 400 });
    chatLog('process', 'request accepted', { parentTaskId: parentTaskId || undefined, hasFile: Boolean(file) });
    const parentTask = parentTaskId
      ? await Task.findOne({ _id: parentTaskId, userId: user._id })
      : null;
    if (parentTaskId && !parentTask) {
      return NextResponse.json({ error: '历史任务不存在或无权访问' }, { status: 404 });
    }

    const settings = await SystemSetting.find({ key: { $in: ['llm', 'billing'] } }).lean();
    const billing = settings.find((item) => item.key === 'billing')?.value || {};
    
    // For local AionCore inference, we could bypass billing, but we follow SaaS rules
    const rate = Number(billing.inputTokenRate || 0.002);
    // Rough estimate just for reservation
    const estimatedInputTokens = prompt.length + 4_000;
    const reservedCost = ((estimatedInputTokens + 8192) / 1000) * rate;
    const reservedUser = await user.constructor.findOneAndUpdate(
      { _id: user._id, balance: { $gte: reservedCost } },
      { $inc: { balance: -reservedCost } },
      { new: true },
    );
    if (!reservedUser) throw new Error('余额不足，无法为本次任务预留额度');

    // Fetch AionCore providers to find the matching provider ID
    let aionModelPayload = null;
    try {
      const providersRes = await fetch(`${AIONCORE_URL}/api/providers`);
      chatLog('process', `providers response ${providersRes.status}`);
      if (providersRes.ok) {
        const providersJson = await providersRes.json();
        if (providersJson.success && Array.isArray(providersJson.data)) {
          // Find deepseek provider from AionCore
          const deepseekProvider = providersJson.data.find(p => p.platform === 'deepseek' && p.models?.includes('deepseek-v4-flash'));
          if (deepseekProvider) {
            aionModelPayload = {
              provider_id: deepseekProvider.id,
              model: 'deepseek-v4-flash',
              use_model: 'deepseek-v4-flash'
            };
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch AionCore providers:', err);
    }

    // Create a unique aionConversationId for the whole task chain, or inherit
    let aionConversationId = parentTask?.aionConversationId;
    if (!aionConversationId) {
      const payload = { type: 'aionrs', extra: buildConversationExtra({ product_locale: productLocale }) };
      if (aionModelPayload) {
        payload.model = aionModelPayload;
      }
      
      const convRes = await fetch(`${AIONCORE_URL}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!convRes.ok) throw new Error('创建 AionCore 会话失败');
      const convJson = await convRes.json();
      aionConversationId = convJson.data?.id || crypto.randomUUID();
      chatLog('process', `conversation created ${aionConversationId}`, { conversation_id: aionConversationId });
    } else {
      // Existing task chains may predate the OfficeWeb response policy. Keep
      // the instruction in conversation context instead of polluting user text.
      const policyRes = await fetch(`${AIONCORE_URL}/api/conversations/${aionConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extra: buildConversationExtra({ product_locale: productLocale }), merge_extra: true }),
      });
      chatLog('process', `conversation policy response ${policyRes.status}`, { conversation_id: aionConversationId });
    }

    task = await Task.create({
      userId: user._id,
      parentTaskId: parentTask?._id,
      prompt,
      aionConversationId,
      status: 'processing',
      runtime: { state: 'running', updatedAt: new Date() },
    });
    chatLog('process', `task created ${task._id}`, { conversation_id: aionConversationId });

    let filename = parentTask?.filename || '';
    let aionFilePath = '';

    if (file && typeof file.arrayBuffer === 'function') {
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error('文件不能超过 25MB');
      }
      filename = path.basename(file.name).replace(/[^\p{L}\p{N}._-]+/gu, '_');
      const extension = path.extname(filename).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error('不支持该文件格式');

      // Upload file directly to AionCore's file system so it can process it
      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('file_name', filename);
      uploadData.append('conversation_id', aionConversationId);

      const aioncoreRes = await fetch(`${AIONCORE_URL}/api/fs/upload`, {
        method: 'POST',
        body: uploadData,
      });

      if (!aioncoreRes.ok) {
        throw new Error('上传附件至处理引擎失败');
      }
      
      const resJson = await aioncoreRes.json();
      aionFilePath = resJson.data; // Absolute path on disk returned by AionCore
      
      // Update Task with file references
      await Task.updateOne(
        { _id: task._id },
        { $set: { filename, originalFile: aionFilePath } }
      );
    }

    // Return successfully so frontend can spawn WebSocket connection
    // Mirror AionUi WebUI: start the workspace Office watcher before generation
    // so newly created pptx/docx/xlsx files cannot race ahead of fileAdded.
    let aionWorkspace = '';
    try {
      const conversationRes = await fetch(`${AIONCORE_URL}/api/conversations/${aionConversationId}`);
      if (conversationRes.ok) {
        const conversationPayload = await conversationRes.json();
        aionWorkspace = conversationPayload.data?.extra?.workspace || conversationPayload.data?.workspace || '';
      }
      if (aionWorkspace) {
        const watchRes = await fetch(`${AIONCORE_URL}/api/fs/office-watch/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace: aionWorkspace }),
        });
        chatLog('preview', `workspace watcher start response ${watchRes.status}`, { conversation_id: aionConversationId });
      }
    } catch (error) {
      chatError('preview', 'failed to start workspace Office watcher', error);
    }

    // Tell AionCore to start generating
    const aiRes = await fetch(`${AIONCORE_URL}/api/conversations/${aionConversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: prompt,
        files: filename ? [filename] : [],
      })
    });
    chatLog('process', `message start response ${aiRes.status}`, { conversation_id: aionConversationId });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('[AionCore] Reject message:', errText);
      throw new Error('启动 AionCore 推理失败');
    }

    return NextResponse.json({
      success: true,
      taskId: String(task._id),
      aionConversationId,
      aionWorkspace,
      reservedCost,
    });

  } catch (error) {
    chatError('process', 'task initiation failed', error);
    return NextResponse.json({ error: error.message || '内部处理错误' }, { status: 500 });
  }
}
