# Issue a Safetynet certificate

Use this workflow only after the founder approves the recipient name, course, completion date and certificate number. The verification page publishes those four fields to anyone holding the QR link. Do not put phone numbers, email addresses, helping IDs, application answers or internal notes in the register.

## Prepare the private files

Create `private-certificates/new-certificate.json` using this structure:

```json
{
  "number": "SN-2026-000001",
  "name": "RECIPIENT NAME",
  "course": "COURSE TITLE",
  "completion_date": "2026-09-29"
}
```

Run:

```text
node scripts/prepare-certificate.mjs private-certificates/new-certificate.json
```

The command validates the fields, generates a cryptographically random verification code, and creates an ignored directory under `private-certificates/SN-...`. It refuses to overwrite an existing directory. Keep this directory private and backed up securely; losing the verification URL means the printed QR cannot be reproduced from the stored hash.

## Issue and test

1. Run `01-insert-draft.sql` in the Supabase SQL Editor. Draft records intentionally return not found publicly.
2. Put the exact URL from `verification-url.txt` into the certificate generator's QR code. Do not shorten or alter it.
3. Check the certificate number, recipient spelling, course and date against `private-record.json`.
4. Run `02-activate.sql` only when the certificate is approved for issuance.
5. Open the URL and scan the actual on-screen or printed QR. Confirm the result says valid and every displayed field matches.
6. Print/send the certificate only after that check.

For an issued certificate that must no longer verify, run `03-revoke.sql`; the QR will report revoked. Prefer revocation over deletion so a previously issued certificate does not look like a never-issued random number. Use `04-remove.sql` only for an approved erasure, duplicate or test record.

Corrections to an issued certificate require coordinated changes to both the database and certificate. Never silently change the registered identity or course while an inconsistent printed copy remains in circulation. Record who approved each activation, correction or revocation outside the public website.

The helper does not generate the certificate artwork or QR image. The existing certificate generator source is still needed to automate that final step. Private output is excluded by `.gitignore` and the Netlify build allowlist.
