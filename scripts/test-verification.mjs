import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createHandler } from '../netlify/functions/verify-certificate.mjs';
const env = { CERTIFICATE_VERIFICATION_ENABLED: 'true', SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fixture', CERTIFICATE_RATE_LIMIT_SECRET: 'x'.repeat(32) };
const code = 'fictional_0123456789abcdef0123456789';
const request = (body = { code }, method = 'POST', headers = {}) => new Request('https://example.com/api/verify-certificate', { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
test('only hashes reach the database; only approved fields reach the browser', async () => {
  const handler = createHandler(env, async (url, options) => {
    const data = JSON.parse(options.body);
    assert.equal(data.p_token_hash, createHash('sha256').update(code).digest('hex'));
    assert.match(data.p_client_hash, /^[a-f0-9]{64}$/);
    assert(!options.body.includes('192.0.2.1'));
    return Response.json({ status: 'valid', certificate: { number: 'TEST', name: 'Fictional', course: 'Test', date: '2026-09-29', private_notes: 'must not escape' } });
  });
  const response = await handler(request(), { ip: '192.0.2.1' });
  assert.equal(response.status, 200);
  const text = await response.text();
  assert(!text.includes('private_notes'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('disabled/missing configuration fails closed without querying', async () => {
  for (const config of [{}, { ...env, CERTIFICATE_VERIFICATION_ENABLED: 'false' }, { ...env, SUPABASE_SECRET_KEY: 'public-key' }]) {
    const handler = createHandler(config, () => { throw new Error('Unexpected call'); });
    assert.equal((await handler(request(), { ip: '192.0.2.1' })).status, 503);
  }
});
test('rejects invalid input, oversized bodies, foreign origin and wrong method', async () => {
  const handler = createHandler(env, () => { assert.fail('Database should not be called'); });
  for (const [req, status] of [[request({ code: '123' }),400], [request({code:'x'.repeat(2000)}),413], [request({},'GET'),405], [request({code},'POST',{origin:'https://other.example'}),403]]) {
    assert.equal((await handler(req, { ip: '192.0.2.1' })).status, status);
  }
});
test('rate limit, missing, revoked and invalid upstream states remain distinct', async () => {
  for (const [data, status] of [[{status:'rate_limited'},429], [{status:'not_found'},200], [{status:'revoked',certificate:{name:'private'}},200], [{certificate:{}},503], [{status:'valid',certificate:{}},503]]) {
    const response = await createHandler(env, async()=>Response.json(data))(request(), {ip:'192.0.2.1'});
    assert.equal(response.status,status);
    assert(!(await response.text()).includes('private'));
  }
  assert.equal((await createHandler(env,async()=>{throw new Error('secret upstream error');})(request(),{ip:'192.0.2.1'})).status,503);
});
