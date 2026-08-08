import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const archivePath = process.env.VERCEL ? "/tmp/leads.local.json" : "crm/leads.local.json";

function createLeadId() {
  return `LUMI-${Date.now().toString(36).toUpperCase()}`;
}

async function readArchive() {
  try {
    const raw = await readFile(archivePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeArchive(leads) {
  await mkdir(dirname(archivePath), { recursive: true });
  await writeFile(archivePath, `${JSON.stringify(leads, null, 2)}\n`, "utf8");
}

export async function archiveLead(lead, saveResult) {
  const leads = await readArchive();
  const leadId = lead.id || createLeadId();
  const archivedLead = {
    id: leadId,
    ...lead,
    status: lead.status || "new",
    crm: saveResult?.type || "pending",
    crmFallback: Boolean(saveResult?.fallback),
    updatedAt: new Date().toISOString(),
  };

  leads.unshift(archivedLead);
  try {
    await writeArchive(leads.slice(0, 200));
  } catch (error) {
    console.error(`Lead archive write failed: ${error.message}`);
  }
  lead.id = leadId;
  return archivedLead;
}

export async function listLeads({ status, limit = 5 } = {}) {
  const leads = await readArchive();
  const filtered = status ? leads.filter((lead) => lead.status === status) : leads;
  return filtered.slice(0, limit);
}

export async function updateLeadStatus(leadId, status) {
  const leads = await readArchive();
  const lead = leads.find((item) => item.id === leadId);

  if (!lead) {
    return null;
  }

  lead.status = status;
  lead.updatedAt = new Date().toISOString();
  await writeArchive(leads);
  return lead;
}

export async function getLeadStats() {
  const leads = await readArchive();
  return {
    total: leads.length,
    new: leads.filter((lead) => lead.status === "new").length,
    confirmed: leads.filter((lead) => lead.status === "confirmed").length,
    done: leads.filter((lead) => lead.status === "done").length,
    cancelled: leads.filter((lead) => lead.status === "cancelled").length,
  };
}
