import { redirect } from 'next/navigation';

export default async function RegisterRedirect({ searchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (typeof params?.invite === 'string') query.set('invite', params.invite);
  if (typeof params?.next === 'string') query.set('next', params.next);
  redirect(`/login${query.size ? `?${query.toString()}` : ''}`);
}
