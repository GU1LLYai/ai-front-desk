import fs from "fs";
import path from "path";

// Each client (a business using the product) is one JSON file in /clients.
// This is a prototype-friendly stand-in for a real database — swap this
// file for a proper DB (Postgres, etc.) once you have more than a
// handful of clients, since concurrent writes to JSON files aren't safe.

const CLIENTS_DIR = path.join(process.cwd(), "clients");

function loadAll() {
  const files = fs.readdirSync(CLIENTS_DIR).filter((f) => f.endsWith(".json"));
  return files.map((f) => JSON.parse(fs.readFileSync(path.join(CLIENTS_DIR, f), "utf-8")));
}

// Look up which business owns the Twilio number a customer just texted
export function getClientByPhone(twilioNumber) {
  return loadAll().find((c) => c.twilioNumber === twilioNumber);
}

export function getClientById(id) {
  return loadAll().find((c) => c.id === id);
}

// Called after a business owner connects their Google Calendar via OAuth
export function saveClientTokens(clientId, tokens) {
  const filePath = path.join(CLIENTS_DIR, `${clientId}.json`);
  const client = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  client.googleTokens = tokens;
  fs.writeFileSync(filePath, JSON.stringify(client, null, 2));
}

export function saveClient(client) {
  const filePath = path.join(CLIENTS_DIR, `${client.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(client, null, 2));
}
