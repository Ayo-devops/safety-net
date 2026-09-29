# Certificate verification — stage one

Status: local prototype plus prepared production backend. Supabase project creation is reported complete; the SQL setup has not been applied and the endpoint has not been deployed. No real certificate records. No certificate JSON register is published. The supplied certificate and JSON screenshot are samples, not issued records. See `docs/supabase-setup.md` for the current setup steps; the checklist below describes launch requirements, not a claim that the prepared code is live.

Run `node scripts/preview-verification.mjs` from the repository and open http://127.0.0.1:8001/verify.html. The server binds only to loopback and serves an explicit list of public file types.

Local fictional test codes:
- Valid: `demo_valid_0123456789abcdef0123456789`
- Revoked: `demo_revoked_0123456789abcdef01234567`
- Unknown: any other well-formed code (24–128 letters, digits, underscores or hyphens).

Local QR-link example: `http://127.0.0.1:8001/verify.html#code=demo_valid_0123456789abcdef0123456789`.
The fragment is removed from the visible URL on load and submitted in a POST body. The page uses no-referrer. This reduces accidental URL disclosure; it does not make the link private to its original recipient.

## Production API contract (not implemented yet)

POST `/api/verify-certificate`, JSON body containing `code`.
Return HTTP 200 JSON with status `valid`, `revoked`, or `not_found`.
Only valid results include `certificate`: string fields `number`, `name`, `course`, `date`. Include only fields approved for public verification. Missing/unknown status must never imply validity. Non-success HTTP status or malformed responses display unavailable, not not-found. The local server adds `demo: true` to every result.

## Remaining work before launch

- Create an organisation-owned private database and configure server-only credentials. Never store real records or credentials in the public repository.
- Add a production server function with exact token lookup and an explicit response field allowlist. Deny public database reads/listing.
- Generate cryptographically random verification tokens (at least 128 bits), store token hashes, enforce uniqueness and explicit status, and give the issuing workflow the QR link. Never use the demo codes for issued certificates.
- Add persistent abuse/rate limiting; redact tokens and personal data from logs; configure no-store responses and body limits.
- Confirm public fields, recipient notice, access roles, record maintenance, revocation and retention with the founder.
- Test real backend access boundaries, throttling, invalid/missing records, failures and QR scans before enabling live verification.
- Remove the prototype notice only after the live system is verified. No staff admin panel has been built yet.
- Use `verify.html#code=TOKEN` for new QR codes. Older `?cert=NUMBER` links cannot securely identify records and show instructions instead. The sample certificate is not a compatibility commitment.

Do not deploy the preview server as an API. Its fixtures are fictional and have no persistence or production security controls. Stage one introduces no hosting configuration changes and is not linked from public navigation.
