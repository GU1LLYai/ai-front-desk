import { getAvailableSlots, bookSlot } from "./calendar.js";

const TOOLS = [
  {
    name: "check_availability",
    description: "Get open appointment slots on the business's real calendar for the next week.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "book_appointment",
    description: "Book an appointment directly onto the business's real calendar.",
    input_schema: {
      type: "object",
      properties: {
        start: { type: "string", description: "ISO 8601 start time, must match an open slot" },
        end: { type: "string", description: "ISO 8601 end time, must match an open slot" },
        customer_name: { type: "string" },
        reason: { type: "string" },
      },
      required: ["start", "end", "customer_name"],
    },
  },
];

// Runs one customer message through Claude, executing calendar tools as needed,
// and returns the final text reply to send back over WhatsApp/SMS.
export async function runAgent({ client, customerPhone, message }) {
  const system = buildSystemPrompt(client);
  let convo = [{ role: "user", content: message }];

  for (let round = 0; round < 5; round++) {
    const data = await callClaude(system, convo);
    const toolUses = data.content.filter((b) => b.type === "tool_use");

    if (toolUses.length === 0) {
      return data.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
    }

    convo.push({ role: "assistant", content: data.content });

    const toolResults = [];
    for (const tu of toolUses) {
      const result = await executeTool(tu.name, tu.input, client, customerPhone);
      toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) });
    }
    convo.push({ role: "user", content: toolResults });
  }

  return "Sorry, I'm having trouble with that right now — mind trying again in a moment?";
}

async function executeTool(name, input, client, customerPhone) {
  if (name === "check_availability") {
    const slots = await getAvailableSlots(client);
    return { available_slots: slots.slice(0, 10) };
  }
  if (name === "book_appointment") {
    const event = await bookSlot(client, {
      start: input.start,
      end: input.end,
      summary: `${input.customer_name} (booked via WhatsApp)`,
      description: `Booked by ${customerPhone}. Reason: ${input.reason || "n/a"}`,
    });
    return { success: true, eventId: event.id };
  }
  return { error: "Unknown tool" };
}

function buildSystemPrompt(client) {
  return `You are the AI front-desk employee for ${client.businessName}.

Business hours: ${client.hoursText}
Services & prices: ${client.servicesText}
FAQs: ${client.faqText || "none provided"}

Answer customer questions using only the information above. If you don't know
something, say so honestly rather than guessing. If the customer wants to
book, call check_availability first, confirm a specific time and their name
with them, then call book_appointment. Keep replies short — this is a text
message conversation, not an email.`;
}

async function callClaude(system, messages) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system,
      messages,
      tools: TOOLS,
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}
