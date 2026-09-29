export const config = { path: '/api/certificate-admin' };

const ADMIN_EMAIL = 'morohunrantioluwatosin@gmail.com';
const ADMIN_PAGE = 'https://safetyneto.netlify.app/certificate-admin.html';
const json = (status, body, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extra
  }
});

async function readJson(request) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of request.body || []) {
    bytes += chunk.byteLength;
    if (bytes > 32768) throw Object.assign(new Error('too_large'), { status: 413 });
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('invalid_json'), { status: 400 }); }
}

const clean = value => typeof value === 'string' ? value.trim() : '';
const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export function createHandler(env = process.env, fetcher = fetch) {
  return async request => {
    if (request.method !== 'POST') return json(405, { status: 'error', message: 'Method not allowed.' }, { Allow: 'POST' });
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return json(403, { status: 'error', message: 'Request rejected.' });
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json(415, { status: 'error', message: 'JSON required.' });

    const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } = env;
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url || '') || !key?.startsWith('sb_secret_')) {
      console.warn('certificate_admin_config: INVALID');
      return json(503, { status: 'error', message: 'Certificate administration is not configured.' });
    }

    let body;
    try { body = await readJson(request); }
    catch (error) { return json(error.status || 400, { status: 'error', message: 'Invalid request.' }); }
    const action = clean(body?.action);

    try {
      if (action === 'request-login') {
        // Always return the same message so this endpoint does not disclose account state.
        if (clean(body.email).toLowerCase() === ADMIN_EMAIL) {
          const upstream = await fetcher(`${url}/auth/v1/otp?redirect_to=${encodeURIComponent(ADMIN_PAGE)}`, {
            method: 'POST',
            headers: { apikey: key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: ADMIN_EMAIL, create_user: true }),
            signal: AbortSignal.timeout(10000)
          });
          if (!upstream.ok && upstream.status !== 429) console.warn('certificate_admin_login: UPSTREAM_REJECTED');
        }
        return json(200, { status: 'sent', message: 'If this email is authorized, a sign-in link has been sent.' });
      }

      if (action === 'refresh-session') {
        const refreshToken = clean(body.refresh_token);
        if (!/^[A-Za-z0-9._~-]{20,2048}$/.test(refreshToken)) return json(401, { status: 'unauthorized' });
        const upstream = await fetcher(`${url}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: { apikey: key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
          signal: AbortSignal.timeout(10000)
        });
        if (!upstream.ok) return json(401, { status: 'unauthorized' });
        const session = await upstream.json();
        return json(200, {
          status: 'authenticated',
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in
        });
      }

      const authorization = request.headers.get('authorization') || '';
      const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      if (!accessToken || accessToken.length > 4096) return json(401, { status: 'unauthorized' });
      const userResponse = await fetcher(`${url}/auth/v1/user`, {
        headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10000)
      });
      if (!userResponse.ok) return json(401, { status: 'unauthorized' });
      const user = await userResponse.json();
      if (clean(user.email).toLowerCase() !== ADMIN_EMAIL || !user.email_confirmed_at) return json(403, { status: 'forbidden' });

      if (action === 'list') {
        const upstream = await fetcher(`${url}/rest/v1/rpc/admin_list_safetynet_certificates`, {
          method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000)
        });
        if (!upstream.ok) throw new Error('Database unavailable');
        return json(200, { status: 'ok', certificates: await upstream.json() });
      }

      if (action === 'create') {
        const number = clean(body.number).toUpperCase();
        const name = clean(body.name);
        const course = clean(body.course);
        const completionDate = clean(body.completion_date);
        const tokenHash = clean(body.token_hash).toLowerCase();
        if (!body.approved || !/^SN-\d{4}-\d{6}$/.test(number) || !name || name.length > 200 || !course || course.length > 200 || !validDate(completionDate) || !/^[a-f0-9]{64}$/.test(tokenHash)) {
          return json(400, { status: 'error', message: 'Check the certificate details and approval.' });
        }
        const upstream = await fetcher(`${url}/rest/v1/rpc/admin_create_safetynet_certificate`, {
          method: 'POST',
          headers: { apikey: key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_number: number, p_name: name, p_course: course, p_completion_date: completionDate, p_token_hash: tokenHash }),
          signal: AbortSignal.timeout(10000)
        });
        if (!upstream.ok) throw new Error('Database unavailable');
        const result = await upstream.json();
        if (result?.status === 'duplicate') return json(409, { status: 'duplicate', message: 'That certificate number is already registered.' });
        if (result?.status !== 'created') throw new Error('Unexpected database response');
        return json(201, { status: 'created', certificate: { number, name, course, date: completionDate } });
      }

      if (action === 'revoke') {
        const number = clean(body.number).toUpperCase();
        if (!/^SN-\d{4}-\d{6}$/.test(number) || body.confirm !== true) return json(400, { status: 'error', message: 'Invalid revocation request.' });
        const upstream = await fetcher(`${url}/rest/v1/rpc/admin_revoke_safetynet_certificate`, {
          method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_number: number }), signal: AbortSignal.timeout(10000)
        });
        if (!upstream.ok) throw new Error('Database unavailable');
        const result = await upstream.json();
        if (result?.status === 'not_found') return json(404, { status: 'not_found' });
        if (result?.status !== 'revoked') throw new Error('Unexpected database response');
        return json(200, { status: 'revoked', number });
      }

      return json(400, { status: 'error', message: 'Unknown action.' });
    } catch {
      return json(503, { status: 'error', message: 'The certificate service is temporarily unavailable.' });
    }
  };
}

export default createHandler();
