import { optionalEnv } from "./env.js";

export async function sendLeadToN8n(lead) {
  const webhookUrl = optionalEnv("N8N_BOOKING_WEBHOOK_URL");
  if (!webhookUrl) {
    return null;
  }

  const headers = {
    "content-type": "application/json",
  };

  const secret = optionalEnv("N8N_WEBHOOK_SECRET");
  if (secret) {
    headers["x-lumi-webhook-secret"] = secret;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...lead,
      source: lead.source || "landing_form",
      pipeline: "n8n",
    }),
  });

  const responseText = await response.text();
  let body = {};
  try {
    body = responseText ? JSON.parse(responseText) : {};
  } catch {
    body = { raw: responseText };
  }

  if (response.status === 409 || body.duplicate) {
    return {
      type: "n8n",
      duplicate: true,
      leadId: body.leadId || lead.id || "",
      webhook: true,
      response: body,
    };
  }

  if (!response.ok || body.ok === false) {
    throw new Error(`n8n webhook failed: ${response.status} ${responseText}`);
  }

  return {
    type: "n8n",
    leadId: body.leadId || lead.id || "",
    webhook: true,
    response: body,
  };
}
