import pg from "pg";

const { Pool } = pg;

// Render's managed Postgres needs SSL, but with a self-signed-style cert
// chain that Node doesn't trust by default — this is the standard setting
// for connecting to it.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let tableReady = null;

// Creates the clients table on first use. Safe to call repeatedly.
function ensureTable() {
  if (!tableReady) {
    tableReady = pool.query(
      "CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, business_name TEXT NOT NULL, twilio_number TEXT NOT NULL, calendar_id TEXT NOT NULL, hours_text TEXT, services_text TEXT, faq_text TEXT, business_hours JSONB, google_tokens JSONB)"
    );
  }
  return tableReady;
}


// Converts a database row back into the same shape the rest of the app
// already expects (camelCase, matching the old JSON-file client objects).
function rowToClient(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    businessName: row.business_name,
    twilioNumber: row.twilio_number,
    calendarId: row.calendar_id,
    hoursText: row.hours_text,
    servicesText: row.services_text,
    faqText: row.faq_text,
    businessHours: row.business_hours,
    googleTokens: row.google_tokens,
  };
}

// Look up which business owns the Twilio number a customer just texted
export async function getClientByPhone(twilioNumber) {
  await ensureTable();
  const { rows } = await pool.query("SELECT * FROM clients WHERE twilio_number = $1", [twilioNumber]);
  return rowToClient(rows[0]);
}

export async function getClientById(id) {
  await ensureTable();
  const { rows } = await pool.query("SELECT * FROM clients WHERE id = $1", [id]);
  return rowToClient(rows[0]);
}

// Called after a business owner connects their Google Calendar via OAuth
export async function saveClientTokens(clientId, tokens) {
  await ensureTable();
  await pool.query("UPDATE clients SET google_tokens = $1 WHERE id = $2", [JSON.stringify(tokens), clientId]);
}

export async function saveClient(client) {
  await ensureTable();
  await pool.query(
    "INSERT INTO clients (id, business_name, twilio_number, calendar_id, hours_text, services_text, faq_text, business_hours, google_tokens) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET business_name = EXCLUDED.business_name, twilio_number = EXCLUDED.twilio_number, calendar_id = EXCLUDED.calendar_id, hours_text = EXCLUDED.hours_text, services_text = EXCLUDED.services_text, faq_text = EXCLUDED.faq_text, business_hours = EXCLUDED.business_hours, google_tokens = EXCLUDED.google_tokens",
    [
      client.id,
      client.businessName,
      client.twilioNumber,
      client.calendarId,
      client.hoursText,
      client.servicesText,
      client.faqText,
      JSON.stringify(client.businessHours || []),
      client.googleTokens ? JSON.stringify(client.googleTokens) : null,
    ]
  );
}
