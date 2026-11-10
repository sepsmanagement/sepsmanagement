# Set up SEPS staff login and receiving

The scanner code is prepared for project `lchywfpncbeqruaunvht`.
The public URL and publishable key are in `scanner/config.js`. No service key belongs in GitHub or browser files.

## 1. Create the database and access rules

Open this project in Supabase → SQL Editor → New query.
Paste all of `migrations/202611090001_scanner.sql` and click **Run** once.
It creates staff, container sessions, shipments, and permanent scan events, enables row-level security, and installs the server functions that validate each write.

No cargo records are public. Active staff can review shared receiving records. Only administrators can change staff roles or disable access. Staff may correct their own receipts; administrators may correct any receipt. The last administrator cannot be removed accidentally.

## 2. Configure invitation-only email login

In Authentication → Sign In / Providers (or Settings):

- Enable the Email provider.
- Turn off **Allow new users to sign up** / **Enable sign-ups**.
- Keep email confirmation enabled.
- Use a minimum password length of 12 characters.

Uninvited accounts have no database membership even if sign-ups are accidentally re-enabled.

In Authentication → URL Configuration, add these exact redirect URLs:

- `https://sepsmanagement.com/scanner/auth.html`
- `https://www.sepsmanagement.com/scanner/auth.html` if staff can access the www domain
- `https://seps-scanner-review.glossyhatch.chatgpt.site/scanner/auth.html` for private owner testing

For the first test, set Site URL to:
`https://seps-scanner-review.glossyhatch.chatgpt.site/scanner/auth.html`

After launch, set Site URL to:
`https://sepsmanagement.com/scanner/auth.html`

Do not send production invitations until their redirect page is deployed. Invitation links are single-use; request another invite or password reset if one expires or an email scanner consumes it.

### Invitation email delivery

Before inviting staff outside the Supabase project team, configure a mail provider under Authentication → Email / SMTP Settings. Supabase's built-in mail service is limited to test delivery and authorized recipients; it is not a general staff mail service. Enter the provider's SMTP host, port, sender address (for example a verified SEPS sender), username and password directly in Supabase. Verify the sender/domain with the provider. Do not commit SMTP credentials or paste them into chat. Send a test invitation and password reset before rollout.

## 3. Deploy the staff invitation service

From this checkout, after authenticating the Supabase CLI:

```sh
supabase link --project-ref lchywfpncbeqruaunvht
supabase functions deploy invite-staff --no-verify-jwt
```

Alternatively create the **invite-staff** Edge Function in the Supabase dashboard using `functions/invite-staff/index.ts` and disable its legacy gateway JWT verification. The handler independently validates the caller with Supabase Auth and requires an active administrator membership.

For private testing, add these Edge Function secrets/settings:

```text
SCANNER_SITE_URL=https://seps-scanner-review.glossyhatch.chatgpt.site
SCANNER_ALLOWED_ORIGINS=https://sepsmanagement.com,https://www.sepsmanagement.com
```

For production, change them to:

```text
SCANNER_SITE_URL=https://sepsmanagement.com
SCANNER_ALLOWED_ORIGINS=https://www.sepsmanagement.com
```

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions automatically. Leave them server-side. No service key needs to be shared in chat.

The service fixes the invitation redirect URL and always creates ordinary staff. An invited user can be promoted later by an administrator.

## 4. Create Ryan's administrator account

1. In Supabase → Authentication → Users, choose **Invite user**.
2. Invite **ryan@sepsmanagement.com**. The Site URL above determines the invitation landing page.
3. In SQL Editor, run `bootstrap-admin.sql`. It promotes only that exact invited email.
4. Open the invitation email and set a password of at least 12 characters.
5. Sign in to the scanner. The **Staff access** tab should appear.

If this email already exists as a self-registered account, do not delete it blindly. The bootstrap script intentionally requires an invited user. Confirm the account in Supabase before granting membership with a deliberate owner SQL change.

## 5. Test before merging the website change

The private owner preview is:
`https://seps-scanner-review.glossyhatch.chatgpt.site/scanner/`
It has a separate ChatGPT access gate; production staff will not need ChatGPT accounts.

- Test invited login, wrong passwords, sign-out, and password reset.
- Import TE1804. Review all records and select a container. The original PDF remains on the device; reviewed shipment records are stored in Supabase.
- Receive a piece, reload, and confirm that the count remains saved.
- Open another device with the same account and verify shared data.
- Correct a receipt and check that both original and correction appear in history.
- Select an earlier date to print the net received counts as of that local date.
- Download and print a PDF with every B/L for the selected container session.
- Invite a known test colleague from Staff access. Test the invitation email and password flow after the colleague has access to the test host, or on production during a controlled rollout.
- Disable the test staff account. Its database requests must be denied; the UI clears on the next refresh or within 30 seconds. Previously downloaded reports cannot be recalled.

The current code records scans by shipment number (or the stored barcode, initially the shipment number). Confirm the decoded value from the actual Bluetooth scanner before cargo operations. Unknown barcodes and over-scans never increment counts.

The scanner requires a network connection. Failed writes are never treated as confirmed receipts. Do not scan again after an ambiguous network failure until Refresh records has confirmed the shared totals.

## 6. Launch

After the Supabase setup and account tests pass:

1. Merge the website pull request. GitHub Pages will serve `/scanner/` and `/scanner/auth.html`.
2. Change the Site URL and Edge Function `SCANNER_SITE_URL` to production as above.
3. The public website footer's **Staff portal** link opens the protected scanner.
4. Ryan opens **Staff access**, enters a staff member's work email, and presses **Send invitation**. Use **Disable** to revoke access or **Make admin** to assign another administrator.

## Validation already performed

Run locally with Node 24:

```sh
npm ci --ignore-scripts
npm run check
npm test
```

Tests execute the migration in PostgreSQL via PGlite and cover denied anonymous/uninvited/disabled access, server counters, idempotent requests, immutable audit events, correction permissions, administrator role checks, last-admin protection, invitation-service authorization, and password-link handling.

Full email delivery, actual Supabase configuration, live cross-device use, and visual browser QA require the connected project and an invited account. They are not claimed complete by unit tests.
