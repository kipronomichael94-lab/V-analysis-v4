# V Analysis V4 — Pesapal payment setup

This repository includes a Pesapal API 3.0 server integration scaffold. Payment activation is **not live** until the merchant credentials, Supabase database, public HTTPS deployment, and Pesapal IPN registration are configured and tested.

## Included endpoints
- POST /api/pesapal/order — authenticated user creates a hosted Pesapal checkout.
- GET/POST /api/pesapal/ipn — Pesapal server notification; verifies status directly with Pesapal before activating a subscription.
- GET /api/pesapal/status?reference=... — authenticated customer status check.
- Supabase SQL schema in supabase/schema.sql — payment records and 3-day trial creation.

## Required setup
1. Create a Supabase project. Run supabase/schema.sql in its SQL Editor.
2. Deploy this repository to Vercel with the repository root as the project root.
3. Add these Vercel environment variables (never commit actual values):
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - PESAPAL_CONSUMER_KEY
   - PESAPAL_CONSUMER_SECRET
   - PESAPAL_ENV=sandbox initially; use live only after approval/testing
   - SUBSCRIPTION_AMOUNT=150
   - SUBSCRIPTION_CURRENCY=USD (confirm desired billing currency before launch)
   - PESAPAL_CALLBACK_URL=https://YOUR-DOMAIN/ (replace with your deployed domain)
   - PESAPAL_IPN_ID= (fill after registering the IPN URL)
4. Register https://YOUR-DOMAIN/api/pesapal/ipn as an IPN URL using Pesapal API 3.0, then set the returned GUID as PESAPAL_IPN_ID.
5. Configure Supabase Auth redirect URLs for your deployed domain.
6. Add the Supabase Auth sign-up/sign-in UI to the app and call the order endpoint with the user's access token. Do not expose the service-role key or Pesapal secret in browser code.
7. Test sandbox end-to-end, including pending, failed, cancelled, duplicate IPN, and successful payment. Only then switch PESAPAL_ENV to live.

## Important implementation notes
- Pesapal's hosted checkout displays the payment methods enabled for your merchant account. M-Pesa and card availability must be confirmed in the Pesapal merchant dashboard/account.
- The API currently creates a one-month access period after a confirmed completed payment. It does not create a recurring card mandate or automatically debit the customer next month. A customer must renew unless a separately approved recurring billing method is configured.
- The 3-day trial record is created at account registration. The application must check subscription status server-side before granting premium features.
- Confirm the final billing currency with the owner. USD 150 is the default here; a KES price requires an agreed fixed amount or a documented exchange-rate policy.
- Do not collect or store card numbers, PINs, passwords, or M-Pesa PINs in this application.

## Official Pesapal API 3.0 references
- Authentication: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/authentication
- Register IPN: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/registeripnurl
- Submit order: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/submitorderrequest
- Transaction status: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/gettransactionstatus
