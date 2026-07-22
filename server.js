import express from "express";
import dotenv from "dotenv";
import path from "path";
import twilio from "twilio";
import { google } from "googleapis";
import { getClientByPhone, getClientById, saveClient, saveClientTokens } from "./lib/clients.js";
import { runAgent } from "./lib/claude.js";
import { provisionNumber } from "./lib/provision.js";

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: false })); // Twilio webhooks + the onboarding form both post form-encoded data
app.use(express.json());
app.use(express.static("public"));

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// --- Business owner fills in their own info, no code editing required ---
app.get("/onboard", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "onboard.html"));
});

app.post("/onboard", async (req, res) => {
  const { businessName, countryCode, areaCode, openTime, closeTime, daysOpen, servicesText, faqText } = req.body;

  let phoneNumber;
  try {
    phoneNumber = await provisionNumber({ countryCode: countryCode || "GB", areaCode: areaCode || undefined });
  } catch (err) {
    console.error("Number provisioning failed:", err);
    res.status(500).send(
      `<body style="font-family:sans-serif;padding:60px 20px;max-width:480px;margin:auto;">` +
        `<h2>Couldn't set up a phone number automatically</h2>` +
        `<p>${err.message}</p>` +
        `<p><a href="/onboard">Go back and try again</a></p></body>`
    );
    return;
  }

  const id = slugify(businessName) + "-" + Date.now().toString(36);

  const client = {
    id,
    businessName,
    twilioNumber: phoneNumber, // ready for SMS immediately — see README re: WhatsApp
    calendarId: "primary",
    hoursText: `${daysOpen}, ${openTime}-${closeTime}`,
    servicesText,
    faqText: faqText || "",
    businessHours: hoursArray(openTime, closeTime),
    googleTokens: null,
  };

  saveClient(client);

  // Send them straight into connecting their calendar — the last step to go live
  res.redirect(`/auth/google?clientId=${id}`);
});

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Turns "09:00" / "17:00" into hourly slot starting hours, e.g. [9,10,11,12,13,14,15,16]
function hoursArray(openTime, closeTime) {
  const startH = parseInt(openTime.split(":")[0], 10);
  const endH = parseInt(closeTime.split(":")[0], 10);
  const hours = [];
  for (let h = startH; h < endH; h++) hours.push(h);
  return hours;
}

// --- Customer sends a WhatsApp/SMS message to a client's business number ---
app.post("/webhook/whatsapp", async (req, res) => {
  const from = req.body.From; // customer's number, e.g. "whatsapp:+447700900000"
  const to = req.body.To; // the business's number the customer texted
  const body = req.body.Body;

  res.status(200).send(); // acknowledge Twilio immediately, reply is sent separately below

  const client = getClientByPhone(to);
  if (!client) {
    console.error(`No client configured for number ${to}`);
    return;
  }

  try {
    const reply = await runAgent({ client, customerPhone: from, message: body });
    await twilioClient.messages.create({ from: to, to: from, body: reply });
  } catch (err) {
    console.error("Agent error:", err);
    await twilioClient.messages.create({
      from: to,
      to: from,
      body: "Sorry, something went wrong on our end — please try again shortly.",
    });
  }
});

// --- One-time setup: business owner connects their Google Calendar ---
// Send each new client to: /auth/google?clientId=their-client-id
app.get("/auth/google", (req, res) => {
  const { clientId } = req.query;
  const oauth2 = getOAuthClient();
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar"],
    state: clientId, // carries your internal client id through the OAuth round trip
  });
  res.redirect(url);
});

app.get("/auth/google/callback", async (req, res) => {
  const { code, state } = req.query;
  const oauth2 = getOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  saveClientTokens(state, tokens);

  const client = getClientById(state);
  const name = client ? client.businessName : "Your business";
  const number = client ? client.twilioNumber : "";
  res.send(
    `<body style="font-family:sans-serif;text-align:center;padding:60px 20px;">` +
      `<h2>You're all set, ${name}.</h2>` +
      `<p>Your number is <strong>${number}</strong> — customers can text it now to ask questions or book appointments.</p>` +
      `<p style="color:#666;font-size:14px;">Want customers to reach you on WhatsApp instead of plain SMS? That needs a one-time verification with Meta — see the README.</p>` +
      `</body>`
  );
});

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`AI front desk backend listening on port ${port}`));
