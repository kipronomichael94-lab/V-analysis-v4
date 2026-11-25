# V Analysis V4 — Pesapal payments and subscription setup

## What is in this repository

- Supabase email/password sign-up and sign-in UI in `index.html`.
- Three-day trial record created automatically when a Supabase Auth user is created.
- Hosted Pesapal API 3.0 checkout through `POST /api/pesapal/order`.
- Server-side Pesapal IPN verification through `GET/POST /api/pesapal/ipn`.
- Authenticated payment status lookup through `GET /api/pesapal/status`.
- Public-only Supabase browser configuration through `GET /api/config`.
- Atomic, idempotent subscription activation SQL function. Duplicate IPNs do not grant extra months.

**This is an integration scaffold, not a live payment service yet.** No merchant credentials, Supabase project, deployed domain, or Pesapal account has been connected or tested from this repository.

## Required setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run the complete `supabase/schema.sql` file.
3. In Supabase Authentication settings, configure the site URL and allowed redirect URL to your final HTTPS website domain. Configure email confirmation as desired.
4. Import this GitHub repository into Vercel and deploy it. The repository root is the project root.
5. Add these Vercel environment variables in Project Settings → Environment Variables:

   - `SUPABASE_URL` — Supabase project URL
   - `SUPABASE_ANON_KEY` — Supabase publishable/anon key
   - `SUPABASE_SERVICE_ROLE_KEY` — server-only service role key
   - `PESAPAL_CONSUMER_KEY` — Pesapal API key
   - `PESAPAL_CONSUMER_SECRET` — Pesapal API secret
   - `PESAPAL_ENV=sandbox` — keep sandbox until all tests pass
   - `SUBSCRIPTION_AMOUNT=150`
   - `SUBSCRIPTION_CURRENCY=USD` — current default; confirm whether to bill USD 150 or a KES amount before launch
   - `PESAPAL_CALLBACK_URL=https://YOUR-DOMAIN/` — replace with your deployed HTTPS domain
   - `PESAPAL_IPN_ID` — set after registering the IPN below

6. Deploy again after adding the environment variables.
7. Register the public IPN endpoint `https://YOUR-DOMAIN/api/pesapal/ipn` with Pesapal API 3.0 using notification type `GET`. Save the returned `ipn_id` as `PESAPAL_IPN_ID` in Vercel, then redeploy.
8. In the Pesapal merchant dashboard/account, confirm that M-Pesa and Visa/Mastercard are enabled for your account and selected currency.
9. Test the full flow using sandbox credentials and sandbox payment methods: account registration, trial creation, checkout redirect, pending payment, successful payment, failed/cancelled payment, duplicate IPN, amount/currency mismatch, and expired access.
10. Only after successful end-to-end testing and Pesapal merchant approval, change `PESAPAL_ENV=live`, enter live credentials, and redeploy.

## Pricing and renewal behavior

The configured price is USD 150 per month. Do not advertise KES pricing until the business owner chooses a KES amount or a documented conversion policy. M-Pesa availability and currency support depend on the merchant's Pesapal configuration.

A confirmed completed payment grants one month of access. This code does **not** automatically charge the customer each month. Customers must return and pay again unless a separate recurring-payment agreement and integration are configured and approved with Pesapal.

## Security and launch limitations

- Never commit Pesapal credentials, Supabase service-role keys, or other secrets to GitHub or browser JavaScript.
- Do not ask customers for their M-Pesa PIN, card number, or card security code on this website. Pesapal hosts the payment page.
- The payment IPN checks transaction status directly with Pesapal and activates access using an atomic database function.
- The analyser dashboard is currently client-side. A real paid product must also enforce entitlements on any premium server-side data/API endpoints; hiding a browser interface alone is not strong access control.
- Live payments have not been run or verified. Do not take customer money until sandbox and live merchant checks are complete.

## Official Pesapal API 3.0 references

- [Authentication](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/authentication)
- [Register IPN URL](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/registeripnurl)
- [Submit order request](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/submitorderrequest)
- [Get transaction status](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/gettransactionstatus)
