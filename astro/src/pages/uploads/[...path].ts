// Proxies Strapi media so images are served from the site's own domain.
import type { APIRoute } from 'astro';
import { proxyUpload } from '../../lib/strapi';

const FORWARDED_REQUEST_HEADERS = ['if-none-match', 'if-modified-since'];
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'content-length', 'etag', 'last-modified'];

export const GET: APIRoute = async ({ params, request }) => {
  const path = params.path ?? '';
  // Only plain file names: prevents escaping the uploads folder on the Strapi server
  if (!/^[\w\-.]+(\/[\w\-.]+)*$/.test(path) || path.includes('..')) {
    return new Response(null, { status: 404 });
  }

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const upstream = await proxyUpload(path, headers);
    if (!upstream.ok && upstream.status !== 304) return new Response(null, { status: upstream.status });

    const responseHeaders = new Headers({ 'cache-control': 'public, max-age=31536000, immutable' });
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return new Response(null, { status: 502 });
  }
};
