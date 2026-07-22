import { google } from "googleapis";

function getAuthedClient(client) {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2.setCredentials(client.googleTokens);
  return oauth2;
}

// Returns open hour-long slots in the next 7 weekdays, within the client's
// business hours, skipping anything already on their real calendar.
export async function getAvailableSlots(client) {
  const auth = getAuthedClient(client);
  const calendar = google.calendar({ version: "v3", auth });

  const now = new Date();
  const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: now.toISOString(),
      timeMax: weekOut.toISOString(),
      items: [{ id: client.calendarId }],
    },
  });

  const busy = data.calendars[client.calendarId].busy;
  const slots = [];
  const cursor = new Date(now);
  cursor.setDate(cursor.getDate() + 1);
  cursor.setHours(0, 0, 0, 0);

  for (let d = 0; d < 7; d++) {
    const day = new Date(cursor);
    day.setDate(cursor.getDate() + d);
    if (day.getDay() === 0 || day.getDay() === 6) continue; // skip weekends

    for (const hour of client.businessHours || [9, 10, 11, 13, 14, 15, 16]) {
      const start = new Date(day);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);

      const overlaps = busy.some((b) => start < new Date(b.end) && end > new Date(b.start));
      if (!overlaps && start > now) {
        slots.push({ start: start.toISOString(), end: end.toISOString() });
      }
    }
  }
  return slots;
}

// Writes the appointment straight onto the business owner's real calendar
export async function bookSlot(client, { start, end, summary, description }) {
  const auth = getAuthedClient(client);
  const calendar = google.calendar({ version: "v3", auth });

  const event = await calendar.events.insert({
    calendarId: client.calendarId,
    requestBody: {
      summary,
      description,
      start: { dateTime: start },
      end: { dateTime: end },
    },
  });

  return event.data;
}
