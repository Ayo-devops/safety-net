import { createHash, createHmac } from 'node:crypto';
export const config = { path: '/api/verify-certificate' };
const json = (status, body, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra }
});
export function createHandler(env = process.env, fetcher = fetch) {
  return async (request, context = {}) => {
    if (request.method !== 'POST') return json(405, { status: 'unavailable' }, { Allow: 'POST' });
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return json(403, { status: 'unavailable' });
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json(415, { status: 'unavailable' });
    if (env.CERTIFICATE_VERIFICATION_ENABLED !== 'true') return json(503, { status: 'unavailable' });
    const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: key, CERTIFICATE_RATE_LIMIT_SECRET: salt } = env;
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url || '') || !key?.startsWith('sb_secret_') || !salt || salt.length < 32 || !context.ip) {
      return json(503, { status: 'unavailable' });
    }
    try {
      // Bound the streamed request, even if Content-Length is missing or false.
      let bytes = 0;
      const chunks = [];
      for await (const chunk of request.body || []) {
        bytes += chunk.byteLength;
        if (bytes > 1024) return json(413, { status: 'unavailable' });
        chunks.push(Buffer.from(chunk));
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return json(400, { status: 'invalid' }); }
      if (typeof body?.code !== 'string' || !/^[A-Za-z0-9_-]{24,128}$/.test(body.code)) return json(400, { status: 'invalid' });
      const upstream = await fetcher(`${url}/rest/v1/rpc/verify_safetynet_certificate`, {
        method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_token_hash: createHash('sha256').update(body.code).digest('hex'),
          p_client_hash: createHmac('sha256', salt).update(context.ip).digest('hex')
        }), signal: AbortSignal.timeout(7000)
      });
      if (!upstream.ok) throw new Error('Lookup unavailable');
      const data = await upstream.json();
      if (data.status === 'rate_limited') return json(429, { status: 'rate_limited' }, { 'Retry-After': '60' });
      if (['not_found', 'revoked'].includes(data.status)) return json(200, { status: data.status });
      if (data.status !== 'valid') throw new Error('Invalid status');
      const certificate = {};
      for (const field of ['number', 'name', 'course', 'date']) {
        if (typeof data.certificate?.[field] !== 'string' || !data.certificate[field].trim()) throw new Error('Invalid record');
        certificate[field] = data.certificate[field];
      }
      return json(200, { status: 'valid', certificate });
    } catch {
      // Never log tokens, IPs, credentials, upstream error bodies or records.
      return json(503, { status: 'unavailable' });
    }
  };
}
export default createHandler();
