import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../netlify/functions/certificate-admin.mjs';

const env = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fixture' };
const request = (body, token = '') => new Request('https://example.com/api/certificate-admin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body)
});
const confirmedUser = { email: 'morohunrantioluwatosin@gmail.com', email_confirmed_at: '2026-09-29T00:00:00Z' };

test('login sends a link only for the authorized email and returns a generic response', async () => {
  const calls = [];
  const handler = createHandler(env, async (url, options) => {
    calls.push({ url, options });
    return Response.json({});
  });
  const accepted = await handler(request({ action: 'request-login', email: 'morohunrantioluwatosin@gmail.com' }));
  assert.equal(accepted.status, 200);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/auth\/v1\/otp\?/);
  assert(!calls[0].url.includes('morohunrantioluwatosin'));
  const rejected = await handler(request({ action: 'request-login', email: 'someone@example.com' }));
  assert.equal(rejected.status, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(await accepted.json(), await rejected.json());
});

test('private actions require the confirmed authorized Supabase user', async () => {
  const unauthenticated = await createHandler(env, () => { throw new Error('Unexpected call'); })(request({ action: 'list' }));
  assert.equal(unauthenticated.status, 401);
  const wrongUser = createHandler(env, async () => Response.json({ email: 'someone@example.com', email_confirmed_at: '2026-09-29T00:00:00Z' }));
  assert.equal((await wrongUser(request({ action: 'list' }, 'user-token'))).status, 403);
});

test('create validates input then registers through the server-only RPC', async () => {
  let rpcBody;
  const handler = createHandler(env, async (url, options = {}) => {
    if (url.endsWith('/auth/v1/user')) return Response.json(confirmedUser);
    if (url.endsWith('/rest/v1/rpc/admin_create_safetynet_certificate')) {
      rpcBody = JSON.parse(options.body);
      return Response.json({ status: 'created' });
    }
    throw new Error(`Unexpected URL ${url}`);
  });
  const body = {
    action: 'create', approved: true, number: 'sn-2026-000002', name: 'Test Person', course: 'Web Development',
    completion_date: '2026-09-29', token_hash: 'a'.repeat(64), verification_code: 'must_not_reach_database'
  };
  const response = await handler(request(body, 'user-token'));
  assert.equal(response.status, 201);
  assert.equal(rpcBody.p_number, 'SN-2026-000002');
  assert.equal(rpcBody.p_token_hash, 'a'.repeat(64));
  assert(!JSON.stringify(rpcBody).includes('must_not_reach_database'));

  const invalid = await handler(request({ ...body, completion_date: '2026-02-31' }, 'user-token'));
  assert.equal(invalid.status, 400);
});

test('list and revoke return bounded public fields without token hashes', async () => {
  const fixture = [{ number: 'SN-2026-000001', name: 'Test', course: 'Course', date: '2026-09-29', status: 'valid', created_at: '2026-09-29T00:00:00Z' }];
  const handler = createHandler(env, async url => {
    if (url.endsWith('/auth/v1/user')) return Response.json(confirmedUser);
    if (url.endsWith('/rest/v1/rpc/admin_list_safetynet_certificates')) return Response.json(fixture);
    if (url.endsWith('/rest/v1/rpc/admin_revoke_safetynet_certificate')) return Response.json({ status: 'revoked' });
    throw new Error(`Unexpected URL ${url}`);
  });
  const list = await handler(request({ action: 'list' }, 'user-token'));
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).certificates, fixture);
  const revoke = await handler(request({ action: 'revoke', number: 'SN-2026-000001', confirm: true }, 'user-token'));
  assert.equal(revoke.status, 200);
});
