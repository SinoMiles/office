import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import User from '@/models/User';
import { connectToDatabase } from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET;
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured');
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: SESSION_MAX_AGE_SECONDS });
}

export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export function signAdminToken(payload) {
  return jwt.sign({ ...payload, sessionType: 'admin' }, JWT_SECRET, { expiresIn: ADMIN_SESSION_MAX_AGE_SECONDS });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  if (!token) return null;
  
  const decoded = verifyToken(token);
  if (!decoded) return null;

  await connectToDatabase();
  const user = await User.findById(decoded.id).select('-password');
  if (!user || Number(decoded.version || 0) !== Number(user.tokenVersion || 0)) return null;
  return user;
}

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;
  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded || decoded.sessionType !== 'admin') return null;

  await connectToDatabase();
  const user = await User.findById(decoded.id).select('-password');
  if (!user || user.role !== 'admin' || Number(decoded.version || 0) !== Number(user.tokenVersion || 0)) return null;
  return user;
}
