import { proxy } from '../../../proxy/[[...path]]/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function attachmentProxy(request, { params }) {
  const { id, index, path = [] } = await params;
  return proxy(request, {
    params: Promise.resolve({ id, path: [`attachment-${index}`, ...path] }),
  });
}

export const GET = attachmentProxy;
export const HEAD = attachmentProxy;
