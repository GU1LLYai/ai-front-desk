# Deployment guide

Everything here happens outside this codebase — accounts and dashboards.
Once done, deploying is a few clicks.

## 1. Anthropic API key (~2 min)

1. Go to console.anthropic.com and sign in (or create an account)
2. Go to **Settings → API Keys → Create Key**
3. Copy the key — you'll paste it into `ANTHROPIC_API_KEY` later

## 2. Twilio account (~10 min)

1. Sign up at twilio.com — you'll need to verify your email and phone
2. From the Twilio Console dashboard, copy your **Account SID** and
   **Auth Token** — these go into `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`
3. Add billing details (Twilio requires this before you can buy numbers or
   send messages beyond trial limits) — pay-as-you-go, no big upfront cost
4. That's it for now — the app itself buys numbers for each client via the
   API, so you don't need to manually purchase one here

If you want WhatsApp (not just SMS) eventually: in the Twilio Console, go
to **Messaging → Try it out → Send a WhatsApp message** to see the sandbox,
and **Senders → WhatsApp senders** when you're ready to register a real
number for production. This is the one part that needs a human (Meta
verification) per client — see the main README for details.

## 3. Google Cloud project (~10 min)

This lets your clients connect their Google Calendar.

1. Go to console.cloud.google.com and create a new project
2. Go to **APIs & Services → Library**, search "Google Calendar API", click
   **Enable**
3. Go to **APIs & Services → OAuth consent screen**
   - User type: External
   - Fill in app name (e.g. "AI Front Desk"), your email as support contact
   - Add scope: `https://www.googleapis.com/auth/calendar`
   - Add your own email as a test user for now (lets you test before Google
     reviews the app for public use)
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth
   client ID**
   - Application type: Web application
   - Authorized redirect URI: `https://YOUR-DEPLOYED-URL/auth/google/callback`
     (you'll get the real URL in step 4 below — come back and add it once
     you have it)
5. Copy the **Client ID** and **Client Secret** into `GOOGLE_CLIENT_ID` /
   `GOOGLE_CLIENT_SECRET`

Note: while your app is in "Testing" mode, only test users you add can
connect their calendar. Submitting for Google's verification (needed to let
any business connect) is a longer process — fine to defer until you have
real clients ready to sign up.

## 4. Deploy the server

Any Node host works; **Render** is a solid default — connect a repo, click
deploy, done. One caveat: Render's free tier spins down after 15 minutes of
inactivity and takes 30-60 seconds to wake up, which is too slow for a
Twilio webhook (Twilio gives up after ~15 seconds). Use Render's paid
**Starter** tier (~$7/month) so the server stays warm, or an equivalent
always-on tier on Railway/Fly.io.

Steps:

1. Push this project to a GitHub repo
2. On Render: **New → Web Service**, connect the repo
   - Build command: `npm install`
   - Start command: `npm start`
   - Choose the Starter plan (not Free) so webhooks don't time out
3. Add all the environment variables from `.env.example` in Render's
   **Environment** tab, using the real values from steps 1-3 above
4. Set `PUBLIC_BASE_URL` to the URL Render gives you, e.g.
   `https://ai-front-desk.onrender.com`
5. Deploy
6. Go back to Google Cloud (step 3.4) and add
   `https://ai-front-desk.onrender.com/auth/google/callback` as the
   authorized redirect URI

## 5. Test it

1. Visit `https://YOUR-URL/onboard` and fill in a test business
2. Sign in with your own Google account to connect a calendar
3. Text the number shown on the confirmation page from your phone
4. You should get a reply within a few seconds, and a booking request
   should create a real event on the calendar you connected

## Troubleshooting

- **No reply to texts**: check Render's logs for errors; confirm
  `PUBLIC_BASE_URL` matches your actual deployed URL exactly (no trailing
  slash)
- **Google sign-in fails**: the redirect URI in Google Cloud must match
  `GOOGLE_REDIRECT_URI` in your env vars exactly, including https:// and no
  trailing slash
- **"No available numbers found"**: try a different `countryCode` or leave
  area code blank
