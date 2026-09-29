import { randomBytes, createHash } from 'node:crypto';
const code = randomBytes(32).toString('base64url');
console.log(JSON.stringify({
  verification_code: code,
  token_hash: createHash('sha256').update(code).digest('hex'),
  verification_url: `https://safetyneto.netlify.app/verify.html#code=${code}`
}, null, 2));
// Run locally for each issued certificate. Keep output outside Git.
