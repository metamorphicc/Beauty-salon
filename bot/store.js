import { mkdir, appendFile, access } from "node:fs/promises";
import { dirname } from "node:path";
import { formatLeadRow, leadHeaders } from "./leadFormat.js";

const csvPath = process.env.VERCEL ? "/tmp/leads.local.csv" : "crm/leads.local.csv";
const header = leadHeaders.join(",");

function escapeCsv(value) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

async function ensureCsv() {
  await mkdir(dirname(csvPath), { recursive: true });
  try {
    await access(csvPath);
  } catch {
    await appendFile(csvPath, `${header}\n`, "utf8");
  }
}

export async function appendLeadToCsv(lead) {
  await ensureCsv();
  const row = formatLeadRow(lead).map(escapeCsv).join(",");

  await appendFile(csvPath, `${row}\n`, "utf8");
  return { type: "csv", path: csvPath };
}
