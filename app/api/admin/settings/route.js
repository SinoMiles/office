import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import SystemSetting from '@/models/SystemSetting';

export async function GET() {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectToDatabase();
    const settings = await SystemSetting.find();
    
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updates = await req.json(); // array of { key, value }
    await connectToDatabase();
    
    for (const update of updates) {
      await SystemSetting.findOneAndUpdate(
        { key: update.key },
        { value: update.value },
        { upsert: true }
      );

      // Sync LLM config to AionCore providers
      if (update.key === 'llm') {
        try {
          const llmValue = update.value || {};
          const apiKey = llmValue.apiKey || '';
          const baseUrl = llmValue.baseUrl || 'https://api.deepseek.com';

          // First, fetch existing deepseek provider to get its ID, or create new if missing
          let providerId = 'deepseek';
          let method = 'POST';
          let endpoint = 'http://127.0.0.1:9123/api/providers';
          
          const providersRes = await fetch('http://127.0.0.1:9123/api/providers');
          if (providersRes.ok) {
            const providersJson = await providersRes.json();
            if (providersJson.success && Array.isArray(providersJson.data)) {
              const existing = providersJson.data.find(p => p.platform === 'deepseek');
              if (existing) {
                providerId = existing.id;
                method = 'PUT';
                endpoint = `http://127.0.0.1:9123/api/providers/${providerId}`;
              }
            }
          }

          // Create or update provider in AionCore
          const syncRes = await fetch(endpoint, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: providerId,
              platform: 'deepseek',
              name: 'DeepSeek',
              base_url: baseUrl,
              api_key: apiKey,
              models: ['deepseek-v4-flash'],
              enabled: true,
              capabilities: [{ type: 'text' }, { type: 'function_calling' }, { type: 'vision' }]
            })
          });
          
          if (!syncRes.ok) {
            const errorText = await syncRes.text();
            console.error(`Failed to sync LLM provider to AionCore (${method} ${endpoint}):`, errorText);
          }
        } catch (err) {
          console.error('Failed to sync LLM provider to AionCore:', err);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
