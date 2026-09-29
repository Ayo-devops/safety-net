import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/prepare-certificate.mjs private-certificates/new-certificate.json');
  process.exit(1);
}

const input = JSON.parse(await readFile(inputPath, 'utf8'));
const required = ['number', 'name', 'course', 'completion_date'];
for (const field of required) {
  if (typeof input[field] !== 'string' || !input[field].trim()) throw new Error(`Missing ${field}`);
  input[field] = input[field].trim();
}
if (!/^SN-\d{4}-\d{6}$/.test(input.number)) throw new Error('number must match SN-YYYY-000001');
if (input.name.length > 200 || input.course.length > 200) throw new Error('name and course must be 200 characters or fewer');
if (!/^\d{4}-\d{2}-\d{2}$/.test(input.completion_date) || Number.isNaN(Date.parse(`${input.completion_date}T00:00:00Z`))) {
  throw new Error('completion_date must be a real date in YYYY-MM-DD format');
}

const outputDir = path.join('private-certificates', input.number);
await mkdir(outputDir, { recursive: false });
const code = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(code).digest('hex');
const verificationUrl = `https://safetyneto.netlify.app/verify.html#code=${code}`;
const sql = value => `'${String(value).replaceAll("'", "''")}'`;
const where = `where number = ${sql(input.number)};\n`;

await Promise.all([
  writeFile(path.join(outputDir, '01-insert-draft.sql'), `-- Private draft: not returned by public verification.\ninsert into safetynet_private.certificates\n(number, name, course, completion_date, status, token_hash)\nvalues (${sql(input.number)}, ${sql(input.name)}, ${sql(input.course)}, ${sql(input.completion_date)}, 'draft', ${sql(tokenHash)});\n`),
  writeFile(path.join(outputDir, '02-activate.sql'), `-- Run only after the certificate and QR details have been checked.\nupdate safetynet_private.certificates set status = 'valid'\n${where}`),
  writeFile(path.join(outputDir, '03-revoke.sql'), `-- Keeps the record but makes verification report revoked.\nupdate safetynet_private.certificates set status = 'revoked'\n${where}`),
  writeFile(path.join(outputDir, '04-remove.sql'), `-- Use only for a duplicate/test record or an approved erasure. Revocation is preferred for issued certificates.\ndelete from safetynet_private.certificates\n${where}`),
  writeFile(path.join(outputDir, 'verification-url.txt'), `${verificationUrl}\n`),
  writeFile(path.join(outputDir, 'private-record.json'), JSON.stringify({ ...input, verification_code: code, token_hash: tokenHash, verification_url: verificationUrl }, null, 2) + '\n')
]);

console.log(`Prepared private certificate files in ${outputDir}`);
console.log('Nothing was added to Supabase and no certificate was activated.');
