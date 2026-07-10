import path from 'node:path';
import fs from 'node:fs/promises';
import { NextResponse } from 'next/server';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import * as xlsx from 'xlsx';
import { connectToDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { runOfficeAgent } from '@/lib/ai/deepseek-agent';
import SystemSetting from '@/models/SystemSetting';
import BillingRecord from '@/models/BillingRecord';
import Task from '@/models/Task';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_CONTEXT_CHARS = 80_000;
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

function encodeResult(text, metadata) {
  return `${text}\n\n[METADATA]${JSON.stringify(metadata)}`;
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

    task = await Task.create({
      userId: user._id,
      parentTaskId: parentTask?._id,
      prompt,
      status: 'processing',
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

    const result = await runOfficeAgent({
      apiKey,
      baseUrl: llm.baseUrl || process.env.DEEPSEEK_BASE_URL,
      model: llm.model || process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
      prompt,
      documentContext,
      taskDir,
    });

    const rate = Number(billing.inputTokenRate || 0.002);
    const cost = Math.max(0, (result.totalTokens / 1000) * rate);
    const updatedUser = await user.constructor.findOneAndUpdate(
      { _id: user._id, balance: { $gte: cost } },
      { $inc: { balance: -cost } },
      { new: true },
    );
    if (!updatedUser) throw new Error('余额不足，无法结算本次任务');

    await Promise.all([
      BillingRecord.create({
        userId: user._id,
        type: 'consume',
        amount: cost,
        description: `AI Office 任务，消耗 ${result.totalTokens} Tokens`,
      }),
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
        },
      ),
    ]);

    const artifact = result.artifact
      ? {
          filename: result.artifact.filename,
          previewUrl: `/api/tasks/${task._id}/preview`,
          downloadUrl: `/api/tasks/${task._id}/download`,
        }
      : null;

    return new Response(encodeResult(result.text, {
      taskId: task._id,
      balance: updatedUser.balance,
      cost,
      artifact,
    }), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
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

