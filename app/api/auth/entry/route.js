import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request) {
  const user = await getCurrentUser();
  const destination = user ? '/dashboard' : '/register?next=/dashboard';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const origin = host ? `${protocol}://${host}` : new URL(request.url).origin;
  return NextResponse.redirect(new URL(destination, origin));
}
