# Certificate administration setup

The private admin page is `https://safetyneto.netlify.app/certificate-admin.html`. It is absent from public navigation and search indexing. The only authorized email is `morohunrantioluwatosin@gmail.com`.

## One-time Supabase setup

1. In Supabase SQL Editor, run the complete contents of `supabase/certificate-admin.sql` once. It adds three service-role-only functions for creating, listing and revoking certificate records. It does not expose the private table to browsers and does not change existing records.
2. In Authentication → URL Configuration, set the Site URL to `https://safetyneto.netlify.app` and add `https://safetyneto.netlify.app/certificate-admin.html` to Redirect URLs.
3. Ensure the Email provider is enabled in Authentication → Sign In / Providers. Magic links are enabled by default on hosted Supabase projects.

The existing Netlify `SUPABASE_URL` and `SUPABASE_SECRET_KEY` variables are reused. The secret key never reaches the browser. Do not add a Supabase key to the HTML or JavaScript.

## Routine workflow

1. Open the admin page and request a sign-in link.
2. Open the one-time link received at the authorized email address. The browser stores the session and refreshes it without another dashboard login.
3. Enter the approved certificate details and tick the approval checkbox.
4. Select **Register and Generate Certificate**. The page creates a random 256-bit verification code, stores only its SHA-256 hash, registers the record as valid, and renders the QR certificate.
5. Download the private backup JSON. Keep it outside Git and public file storage.
6. Scan the QR and compare the live verification details before printing.

Revocation is available from the recent-records table. Revocation preserves the record while causing verification to report it as revoked.
