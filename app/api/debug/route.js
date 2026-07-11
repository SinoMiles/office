import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const data = await request.json();
    console.log('\n\n=== [DEBUG] WS PAYLOAD ===\n', JSON.stringify(data, null, 2), '\n=========================\n\n');
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message });
  }
}
