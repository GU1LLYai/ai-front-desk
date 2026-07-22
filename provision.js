import twilio from "twilio";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Searches for an available local number and buys it, wiring its SMS webhook
// straight to this app so it can receive customer texts immediately —
// no manual Twilio console work per client.
export async function provisionNumber({ countryCode = "GB", areaCode } = {}) {
  const searchParams = areaCode ? { areaCode } : {};
  const available = await client
    .availablePhoneNumbers(countryCode)
    .local.list({ smsEnabled: true, limit: 5, ...searchParams });

  if (!available.length) {
    throw new Error(
      `No available numbers found for ${countryCode}${areaCode ? `, area code ${areaCode}` : ""}. Try a different area code.`
    );
  }

  const chosen = available[0];
  const webhookBase = process.env.PUBLIC_BASE_URL;
  if (!webhookBase) {
    throw new Error("PUBLIC_BASE_URL is not set — the purchased number needs a public URL to receive texts");
  }

  const purchased = await client.incomingPhoneNumbers.create({
    phoneNumber: chosen.phoneNumber,
    smsUrl: `${webhookBase}/webhook/whatsapp`,
    smsMethod: "POST",
  });

  return purchased.phoneNumber; // e.g. "+14155551234" — works for SMS right away
}
