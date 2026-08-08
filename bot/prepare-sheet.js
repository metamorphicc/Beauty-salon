import "dotenv/config";
import { prepareGoogleSheet } from "./googleSheets.js";

const result = await prepareGoogleSheet();

if (!result) {
  console.log("Google Sheets is not configured. Nothing to prepare.");
} else {
  console.log(`Prepared Google Sheet tab: ${result.sheetName}`);
}
