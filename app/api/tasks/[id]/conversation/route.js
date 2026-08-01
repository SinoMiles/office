import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import Task from '@/models/Task';
import { getAioncoreBaseUrl } from '@/lib/aioncore/config';
import { mapMessagesToUi, normalizeHistoryMessages, sliceHistoryThroughPrompts } from '@/lib/aioncore/chat-reducer';
import { reconcileTaskArtifacts } from '@/lib/workspace/artifact-reconcile';
import { aioncoreHeaders } from '@/lib/aioncore/bridge-auth';

const AIONCORE_URL = getAioncoreBaseUrl();

async function loadAionHistory(conversationId, prompts, userId) {
  if (!conversationId) return [];
  const pages = [];
  let before = '';
  for (let pageNumber = 0; pageNumber < 20; pageNumber += 1) {
    const query = new URLSearchParams({ limit: '200', content_mode: 'full' });
    if (before) query.set('before', before);
    const response = await fetch(`${AIONCORE_URL}/api/conversations/${encodeURIComponent(conversationId)}/messages?${query}`, {
      headers: aioncoreHeaders(userId),
    });
    if (!response.ok) throw new Error(`AionCore history request failed (${response.status})`);
    const payload = await response.json();
    const page = payload.data || payload;
    const items = Array.isArray(page.items) ? page.items : [];
    pages.unshift(items);
    if (!page.has_more_before || !page.oldest_cursor || items.length === 0) break;
    before = page.oldest_cursor;
  }
  const normalized = normalizeHistoryMessages(pages.flat());
  return mapMessagesToUi(sliceHistoryThroughPrompts(normalized, prompts), { isProcessing: false });
}

export async function GET(_request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectToDatabase();
  const { id } = await params;
  const selected = await Task.findOne({ _id: id, userId: user._id }).lean();
  if (!selected) return NextResponse.json({ error: 'Task not found or permission denied' }, { status: 404 });

  // A sidebar item represents the whole conversation. A refresh can restore
  // either its root task or a later child task, so following only parentTaskId
  // loses every descendant after the selected row. The Core conversation ID is
  // the canonical thread boundary and is always scoped by the authenticated
  // website user here.
  let turns = selected.aionConversationId
    ? await Task.find({ userId: user._id, aionConversationId: selected.aionConversationId })
        .sort({ createdAt: 1 })
        .limit(200)
        .lean()
    : [selected];
  if (!turns.length) turns = [selected];
  // Recover files created without a realtime Office watcher event. This is
  // idempotent and also repairs tasks generated before reconciliation existed.
  for (let index = 0; index < turns.length; index += 1) {
    if (!turns[index].workspace) continue;
    try {
      const task = await Task.findOne({ _id: turns[index]._id, userId: user._id });
      if (!task) continue;
      const previousCount = task.artifacts?.length || 0;
      await reconcileTaskArtifacts(task);
      if ((task.artifacts?.length || 0) !== previousCount) await task.save();
      turns[index] = task.toObject();
    } catch (error) {
      console.warn('[OfficeWeb:Artifacts] workspace reconciliation failed:', error.message);
    }
  }
  let messages = [];
  try {
    messages = await loadAionHistory(turns[turns.length - 1].aionConversationId, turns.map((turn) => turn.prompt), String(user._id));
  } catch (error) {
    console.warn('[OfficeWeb:History] AionCore history unavailable:', error.message);
  }
  return NextResponse.json({ success: true, tasks: turns, messages });
}
