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

// Configures a number the account already owns, instead of buying a new one.
// Useful for testing on a Twilio trial account, since trials can't purchase
// additional numbers but CAN reconfigure a number they already have.
export async function useExistingNumber(phoneNumber) {
  const webhookBase = process.env.PUBLIC_BASE_URL;
  if (!webhookBase) {
    throw new Error("PUBLIC_BASE_URL is not set — this number needs a public URL to receive texts");
  }

  const matches = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
  if (!matches.length) {
    throw new Error(`No number matching ${phoneNumber} was found on this Twilio account.`);
  }

  const updated = await client.incomingPhoneNumbers(matches[0].sid).update({
    smsUrl: `${webhookBase}/webhook/whatsapp`,
    smsMethod: "POST",
  });

  return updated.phoneNumber;
}
