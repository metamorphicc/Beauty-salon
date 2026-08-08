import { appendLeadToGoogleSheets } from "./googleSheets.js";
import { appendLeadToCsv } from "./store.js";
import { archiveLead } from "./leadArchive.js";

export async function saveLead(lead) {
  let saveResult;

  try {
    const sheetResult = await appendLeadToGoogleSheets(lead);
    if (sheetResult) {
      saveResult = sheetResult;
    }
  } catch (error) {
    console.error(`Google Sheets failed, falling back to CSV: ${error.message}`);
  }

  if (!saveResult) {
    const csvResult = await appendLeadToCsv(lead);
    saveResult = { ...csvResult, fallback: true };
  }

  const archivedLead = await archiveLead(lead, saveResult);
  return { ...saveResult, leadId: archivedLead.id };
}
