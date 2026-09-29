# Connect the certificate register

Applied and deployed on 29 September 2026. The production endpoint connected successfully and passed valid, revoked, unknown, invalid-input, unavailable and rate-limit checks. The fictional test record was removed afterward. No known real certificate has been inserted.

Project supplied by the user: `ylqpkxszoclefiuqygbm`. Dashboard: https://supabase.com/dashboard/project/ylqpkxszoclefiuqygbm . Standard API URL derived from that reference: https://ylqpkxszoclefiuqygbm.supabase.co . Access and live configuration have not been verified.

## 1. Create the tables and restricted lookup

In the new Supabase project's SQL Editor, open a new query, paste the entire contents of `supabase/certificate-schema.sql`, and run it once. It creates a private schema, certificates table, request-limit table and server-only lookup function. It inserts no records. If objects already exist, stop and inspect the conflict; do not drop existing tables to rerun it.

The private schema must not be added to Supabase's exposed API schemas. There are no anonymous or authenticated-user read policies. Only the server's secret key can call the public lookup function. Project administrators can access the records through the dashboard/SQL Editor; this is not yet a staff portal.

## 2. Set Netlify environment variables

In the Safetynet site's Netlify environment-variable settings, add these values directly, not in Git or chat. Scope secrets to Functions where supported, and Production rather than untrusted branch previews.

- `SUPABASE_URL`: project's HTTPS URL, with no trailing slash.
- `SUPABASE_SECRET_KEY`: a server secret API key beginning `sb_secret_`, from the Supabase project's API Keys settings. Not the publishable/anon key or database password. This implementation deliberately expects the new secret key format.
- `CERTIFICATE_RATE_LIMIT_SECRET`: a separately generated random secret of at least 32 characters. A password manager can generate this. It hashes client IPs before they reach the database; raw IPs are not stored by our code.
- `CERTIFICATE_VERIFICATION_ENABLED`: keep `false` until configuration is ready for a controlled test; `true` enables the backend. With false/missing values it returns unavailable.

Netlify's proposed build command is `node scripts/build.mjs`, publish directory `dist`, functions directory `netlify/functions`. The included netlify.toml sets these. The build copies only website HTML and allowed assets; SQL, documentation and local test scripts are excluded. Do not upload the repository root as the public output.

## 3. Validate before public launch

Local checks: `node --test scripts/test-verification.mjs` and `node scripts/build.mjs`.

Still required on the actual project: verify SQL migration success; anonymous/publishable and signed-in browser roles cannot call the lookup RPC or read private tables; server key can call RPC; draft/unknown/valid/revoked outcomes; 31st same-client attempt within a minute returns rate-limited; upstream outage returns unavailable. The counter is atomic across function instances. It is a per-client limit, not complete distributed denial-of-service protection. Limits can affect people sharing an IP.

Counters older than a day are removed on subsequent lookups; there is no scheduled cleanup, so idle data may remain longer until the next lookup. Provider network logs are governed separately by Netlify/Supabase. Do not promise no technical logging.

Use a clearly fictional test record and mark it as such. Run `node scripts/generate-certificate-code.mjs` locally to generate a random code, SHA-256 hash and QR destination. Store only the hash in the certificate row; keep the code/URL securely outside Git for issuance. Add approved details with explicit `status = valid` only for controlled testing/approved issuance. Draft is the default. Never use the pictured sample as an issued record.

Scan the actual generated QR and compare the registered details. The old generator's number-only query links need updating to the new `verify.html#code=...` format. Do not print final certificates before this works.

The preview notice was removed after live testing. The page remains outside public navigation while certificate issuing procedures and the first approved real records are prepared.

## Reference documentation

- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/database/secure-data
- https://docs.netlify.com/build/functions/get-started/
- https://docs.netlify.com/build/functions/api/
