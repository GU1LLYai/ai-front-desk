# AI Front Desk — WhatsApp/SMS backend

Receives customer texts on a business's number, answers using that business's
own info, and books real appointments straight onto their Google Calendar.

## How it fits together

```
Customer texts business number
        │
        ▼
   Twilio webhook  →  server.js  →  lib/claude.js (asks Claude, using
        │                            that client's info as context)
        │                                  │
        │                                  ▼
        │                          lib/calendar.js (checks/writes
        │                           the business's real calendar)
        ▼
   Reply texted back to customer
```

## 1. Install

```
npm install
cp .env.example .env
```

Fill in `.env`:
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` — from your Twilio console
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from a Google Cloud project
  with the Calendar API enabled (APIs & Services → Credentials → OAuth
  client ID → "Web application")
- `GOOGLE_REDIRECT_URI` — must exactly match a redirect URI you added to
  that OAuth client, e.g. `https://yourdomain.com/auth/google/callback`

## 2. Run it

```
npm start
```

This needs to be reachable over HTTPS for Twilio and Google to call it —
use a host like Render, Railway, or Fly.io, or `ngrok http 3000` while
testing locally.

## 3. Connect Twilio

- Get a WhatsApp-enabled Twilio number (or use their sandbox number while
  testing)
- In the Twilio console, set the WhatsApp webhook for incoming messages to:
  `https://yourdomain.com/webhook/whatsapp`

## 4. Onboard a new client (business)

This is now fully self-serve — no editing JSON, no Twilio console work per client:

1. Send the business owner to `https://yourdomain.com/onboard`.
2. They fill in their business name, hours, prices, and FAQs, and submit.
3. The server automatically searches for and buys a phone number on their
   behalf (see `lib/provision.js`), and points its SMS webhook straight at
   this app — no manual Twilio setup needed for that number.
4. They're redirected straight into Google's sign-in to connect their own
   calendar — once approved, they land on a confirmation page showing
   their new number.
5. Done — texts to that number now get answered with their info, and
   bookings land on their real calendar.

`clients/example-client.json` is left in place as a reference for the
shape of a client file, in case you want to seed one manually for testing.

### A note on SMS vs WhatsApp

Number purchase and SMS are fully automated — a client can text that number
and get a reply within seconds of submitting the form.

WhatsApp is a bit different: Meta requires a one-time business verification
before a number can send/receive WhatsApp messages, and that step has to
happen through Twilio's console (or Meta Business Manager) — it can't be
done by API call alone. Once a client completes that (a few minutes of
form-filling on their end, sometimes a short review wait from Meta), the
same number and the same webhook keep working, just over WhatsApp instead
of SMS. If WhatsApp specifically matters to your customers from day one,
budget for that manual step per client; otherwise SMS works immediately
with zero manual work on your side.

## Notes on going from here to production

- **Storage**: client info currently lives in flat JSON files
  (`lib/clients.js`) — fine for a handful of clients, but swap for a real
  database once you have more, since concurrent writes to JSON files
  aren't safe.
- **Security**: Google tokens are currently stored in plain JSON on disk —
  encrypt these at rest before handling real client data.
- **Multiple businesses, one Twilio number**: right now each client gets
  their own dedicated number via auto-provisioning, which feels like "their
  own employee" but means an ongoing per-number cost (roughly a few dollars
  a month per number, on top of usage) that's worth factoring into your
  pricing.
