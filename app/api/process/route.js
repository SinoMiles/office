import path from 'node:path';
import fs from 'node:fs/promises';
import { NextResponse } from 'next/server';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import * as xlsx from 'xlsx';
import { connectToDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { runOfficeAgent } from '@/lib/ai/deepseek-agent';
import { extractOfficeText } from '@/lib/office/executor';
import SystemSetting from '@/models/SystemSetting';
import BillingRecord from '@/models/BillingRecord';
import Task from '@/models/Task';
import { finishTaskRuntime, startTaskRuntime } from '@/lib/task-runtime';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_CONTEXT_CHARS = 80_000;
const MAX_HISTORY_TURNS = 8;
const MAX_TURN_CONTEXT_CHARS = 16_000;
const MAX_HISTORY_CHARS = 48_000;
const MAX_MODEL_OUTPUT_TOKENS = 8_192;
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.xlsx', '.xls', '.csv', '.pptx']);

function storageRoot() {
  return path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'));
}

async function extractDocumentText(buffer, extension) {
  if (extension === '.pdf') return (await pdfParse(buffer)).text;
  if (extension === '.docx') return (await mammoth.extractRawText({ buffer })).value;
  if (['.xlsx', '.xls', '.csv'].includes(extension)) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    return workbook.SheetNames.map((name) => {
      const csv = xlsx.utils.sheet_to_csv(workbook.Sheets[name]);
      return `## Sheet: ${name}\n${csv}`;
    }).join('\n\n');
  }
  return '';
}

async function loadConversationHistory(parentTask, userId) {
  const history = [];
  let current = parentTask?.toObject?.() || parentTask;

  while (current && history.length < MAX_HISTORY_TURNS) {
    let documentText = '';
    const sourceFile = current.outputFile || current.processedFile;
    const extension = path.extname(sourceFile || '').toLowerCase();
    if (sourceFile && ['.docx', '.xlsx', '.xls', '.csv'].includes(extension)) {
      try {
        const buffer = await fs.readFile(sourceFile);
        documentText = (await extractDocumentText(buffer, extension)).slice(0, MAX_TURN_CONTEXT_CHARS);
      } catch {
        // The textual reply is still useful when a previous artifact expired.
      }
    }
    if (sourceFile && extension === '.pptx') {
      try {
        documentText = (await extractOfficeText(sourceFile)).slice(0, MAX_TURN_CONTEXT_CHARS);
      } catch {
        // The existing artifact remains editable even if text extraction is unavailable.
      }
    }

    const responseParts = [
      current.aiTextResponse?.trim(),
      documentText ? `上一轮生成文件的可读内容：\n${documentText}` : '',
      current.outputFilename ? `上一轮已生成可编辑文件：${current.outputFilename}` : '',
    ].filter(Boolean);
    history.unshift({
      prompt: String(current.prompt || '').slice(0, MAX_TURN_CONTEXT_CHARS),
      response: responseParts.join('\n\n').slice(0, MAX_TURN_CONTEXT_CHARS),
    });

    if (!current.parentTaskId) break;
    current = await Task.findOne({ _id: current.parentTaskId, userId })
      .select('parentTaskId prompt aiTextResponse outputFilename outputFile processedFile')
      .lean();
  }
  let remaining = MAX_HISTORY_CHARS;
  const boundedHistory = [];
  for (const turn of history.reverse()) {
    if (remaining <= 0) break;
    const prompt = turn.prompt.slice(0, Math.min(4_000, remaining));
    remaining -= prompt.length;
    const response = turn.response.slice(0, Math.min(8_000, remaining));
    remaining -= response.length;
    if (prompt) boundedHistory.unshift({ prompt, response });
  }
  return boundedHistory;
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
    const parentTaskId = String(formData.get('taskId') || '').trim();
    const file = formData.get('file');
    if (!prompt) return NextResponse.json({ error: '请输入处理需求' }, { status: 400 });

    const parentTask = parentTaskId
      ? await Task.findOne({ _id: parentTaskId, userId: user._id })
      : null;
    if (parentTaskId && !parentTask) {
      return NextResponse.json({ error: '历史任务不存在或无权访问' }, { status: 404 });
    }
    const conversationHistory = await loadConversationHistory(parentTask, user._id);

    task = await Task.create({
      userId: user._id,
      parentTaskId: parentTask?._id,
      prompt,
      status: 'processing',
      runtime: { state: 'running', updatedAt: new Date() },
    });
    const taskDir = path.join(storageRoot(), String(user._id), String(task._id));
    await fs.mkdir(taskDir, { recursive: true });

    let filename = parentTask?.filename || '';
    let originalFile = parentTask?.originalFile || '';
    let documentContext = '';

    if (file && typeof file.arrayBuffer === 'function') {
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error('文件不能超过 25MB');
      }
      filename = path.basename(file.name).replace(/[^\p{L}\p{N}._-]+/gu, '_');
      const extension = path.extname(filename).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error('不支持该文件格式');
      const buffer = Buffer.from(await file.arrayBuffer());
      originalFile = path.join(taskDir, `input${extension}`);
      await fs.writeFile(originalFile, buffer);
      documentContext = (await extractDocumentText(buffer, extension)).slice(0, MAX_CONTEXT_CHARS);
    }

    const settings = await SystemSetting.find({ key: { $in: ['llm', 'billing'] } }).lean();
    const llm = settings.find((item) => item.key === 'llm')?.value || {};
    const billing = settings.find((item) => item.key === 'billing')?.value || {};
    const apiKey = llm.apiKey || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('系统尚未配置 DeepSeek API Key');

    const rate = Number(billing.inputTokenRate || 0.002);
    const estimatedInputTokens = prompt.length + documentContext.length + conversationHistory.reduce((sum, turn) => sum + turn.prompt.length + turn.response.length, 0) + 4_000;
    const reservedCost = ((estimatedInputTokens + MAX_MODEL_OUTPUT_TOKENS) / 1000) * rate;
    const reservedUser = await user.constructor.findOneAndUpdate(
      { _id: user._id, balance: { $gte: reservedCost } },
      { $inc: { balance: -reservedCost } },
      { new: true },
    );
    if (!reservedUser) throw new Error('余额不足，无法为本次任务预留额度');

    const encoder = new TextEncoder();
    return new Response(new ReadableStream({
      start(controller) {
        void (async () => {
        const runtimeController = startTaskRuntime(task._id);
        let partialText = '';
        let lastRuntimeWrite = 0;
        const persistRuntime = (patch, force = false) => {
          const now = Date.now();
          if (!force && now - lastRuntimeWrite < 500) return;
          lastRuntimeWrite = now;
          Task.updateOne({ _id: task._id }, { $set: { ...patch, 'runtime.updatedAt': new Date() } }).catch(() => undefined);
        };
        const send = (event, data) => {
          try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { /* browser may have refreshed; the durable task continues */ }
        };
        try {
          send('task', { taskId: String(task._id) });
          const previewUrl = `/api/tasks/${task._id}/preview`;
          const result = await runOfficeAgent({
            apiKey,
            baseUrl: llm.baseUrl || process.env.DEEPSEEK_BASE_URL,
            model: llm.model || process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
            prompt,
            documentContext,
            conversationHistory,
            taskDir,
            sourceArtifact: parentTask?.outputFile ? { filePath: parentTask.outputFile, filename: parentTask.outputFilename || path.basename(parentTask.outputFile) } : null,
            signal: runtimeController.signal,
            onEvent(event) {
              if (event.type === 'content') partialText += event.content || '';
              const runtimePatch = { 'runtime.streamedText': partialText };
              if (event.type === 'thought') {
                runtimePatch['runtime.thought'] = { subject: event.subject, description: event.description, done: Boolean(event.done) };
              }
              if (['tool', 'progress', 'preview'].includes(event.type)) {
                runtimePatch['runtime.progress'] = event;
              }
              persistRuntime(runtimePatch);
              if (event.type === 'preview') {
                Task.updateOne(
                  { _id: task._id },
                  { $set: { previewFile: path.join(taskDir, 'preview.html'), 'runtime.updatedAt': new Date() } },
                ).then(() => send('preview', { ...event, previewUrl, version: Date.now() })).catch(() => undefined);
              } else {
                send(event.type, event);
              }
            },
          });

          const cost = Math.max(0, (result.totalTokens / 1000) * rate);
          const refund = Math.max(0, reservedCost - cost);
          const updatedUser = refund
            ? await user.constructor.findOneAndUpdate({ _id: user._id }, { $inc: { balance: refund } }, { new: true })
            : reservedUser;

          await Promise.all([
            BillingRecord.create({ userId: user._id, type: 'consume', amount: cost, description: `AI Office 任务，消耗 ${result.totalTokens} Tokens` }),
            Task.updateOne(
              { _id: task._id, userId: user._id },
              {
                filename,
                originalFile,
                processedFile: result.artifact?.filePath || originalFile,
                outputFilename: result.artifact?.filename,
                outputFile: result.artifact?.filePath,
                previewFile: result.artifact?.previewPath,
                aiTextResponse: result.text,
                tokensUsed: result.totalTokens,
                cost,
                status: 'completed',
                runtime: { state: 'completed', progress: null, thought: null, streamedText: result.text, updatedAt: new Date() },
              },
            ),
          ]);

          if (!result.streamedText) send('content', { content: result.text });
          send('finish', {
            taskId: String(task._id),
            text: result.text,
            usage: { total_tokens: result.totalTokens },
            balance: updatedUser.balance,
            cost,
            artifact: result.artifact ? { filename: result.artifact.filename, previewUrl, downloadUrl: `/api/tasks/${task._id}/download` } : null,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const cancelled = runtimeController.signal.aborted || message.includes('任务已取消') || message.includes('aborted');
          await user.constructor.updateOne({ _id: user._id }, { $inc: { balance: reservedCost } }).catch(() => undefined);
          await Task.updateOne(
            { _id: task._id },
            { status: cancelled ? 'cancelled' : 'failed', errorMessage: cancelled ? '任务已取消' : message, runtime: { state: cancelled ? 'cancelled' : 'failed', cancelRequested: cancelled, streamedText: partialText, updatedAt: new Date() } },
          ).catch(() => undefined);
          console.error('[process]', error);
          send(cancelled ? 'cancelled' : 'error', { error: cancelled ? '任务已取消' : message });
        } finally {
          finishTaskRuntime(task._id);
          controller.close();
        }
        })();
      },
    }), {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    if (task?._id) {
      await Task.updateOne(
        { _id: task._id },
        { status: 'failed', errorMessage: error instanceof Error ? error.message : String(error) },
      ).catch(() => undefined);
    }
    console.error('[process]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务端内部错误' },
      { status: 500 },
    );
  }
}
