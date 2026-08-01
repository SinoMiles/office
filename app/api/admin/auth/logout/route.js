import { NextResponse } from 'next/server';

export async function POST(request) {
  const response = NextResponse.redirect(new URL('/admin/login', request.url), 303);
  response.cookies.set({ name: 'admin_token', value: '', path: '/', maxAge: 0 });
  return response;
}
