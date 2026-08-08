import { createSign } from "node:crypto";
import { optionalEnv } from "./env.js";
import { formatDate, formatDateTime, formatLeadRow, leadHeaders } from "./leadFormat.js";

const spreadsheetId = optionalEnv("GOOGLE_SHEETS_SPREADSHEET_ID");
const sheetName = optionalEnv("GOOGLE_SHEETS_SHEET_NAME") || "Leads";
const clientEmail = optionalEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const privateKey = optionalEnv("GOOGLE_PRIVATE_KEY").replaceAll("\\n", "\n");
let sheetPrepared = false;

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function canUseSheets() {
  return Boolean(spreadsheetId && sheetName && clientEmail && privateKey);
}

function sheetRange(columns) {
  const safeSheetName = sheetName.replaceAll("'", "''");
  return `'${safeSheetName}'!${columns}`;
}

async function googleRequest(accessToken, url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        ...options.headers,
      },
    });
  } catch (error) {
    throw new Error(`Google request network error: ${error.message}`);
  }

  const result = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(result));
  }

  return result;
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    }),
  );

  const unsignedJwt = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer
    .sign(privateKey, "base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

  let tokenResponse;
  try {
    tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${unsignedJwt}.${signature}`,
      }),
    });
  } catch (error) {
    throw new Error(`Google token network error: ${error.message}`);
  }

  const token = await tokenResponse.json();
  if (!tokenResponse.ok) {
    throw new Error(`Google token request failed: ${JSON.stringify(token)}`);
  }

  return token.access_token;
}

async function getSheetId(accessToken) {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}` +
    "?fields=sheets.properties(sheetId,title)";
  const result = await googleRequest(accessToken, url);
  const sheet = result.sheets?.find((item) => item.properties?.title === sheetName);

  if (!sheet) {
    throw new Error(`Sheet tab "${sheetName}" was not found in spreadsheet.`);
  }

  return sheet.properties.sheetId;
}

async function updateHeaderRow(accessToken) {
  const headerRange = encodeURIComponent(sheetRange("A1:K1"));
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${headerRange}` +
    "?valueInputOption=RAW";

  await googleRequest(accessToken, url, {
    method: "PUT",
    body: JSON.stringify({ values: [leadHeaders] }),
  });
}

async function normalizeExistingRows(accessToken) {
  const dataRange = encodeURIComponent(sheetRange("A2:K"));
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${dataRange}`;
  const result = await googleRequest(accessToken, getUrl);
  const rows = result.values || [];

  if (!rows.length) {
    return;
  }

  let changed = false;
  const normalizedRows = rows.map((row) => {
    const nextRow = [...row];

    if (typeof nextRow[0] === "string" && nextRow[0].includes("T")) {
      nextRow[0] = formatDateTime(nextRow[0]);
      changed = true;
    }

    if (typeof nextRow[6] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(nextRow[6])) {
      nextRow[6] = formatDate(nextRow[6]);
      changed = true;
    }

    return nextRow;
  });

  if (!changed) {
    return;
  }

  const updateUrl =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${dataRange}` +
    "?valueInputOption=RAW";

  await googleRequest(accessToken, updateUrl, {
    method: "PUT",
    body: JSON.stringify({ values: normalizedRows }),
  });
}

async function formatSheet(accessToken, sheetId) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;

  await googleRequest(accessToken, url, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
            fields: "gridProperties.frozenRowCount",
          },
        },
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: leadHeaders.length,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: {
                  red: 0.36,
                  green: 0.14,
                  blue: 0.24,
                },
                horizontalAlignment: "CENTER",
                textFormat: {
                  bold: true,
                  foregroundColor: {
                    red: 1,
                    green: 0.98,
                    blue: 0.95,
                  },
                },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
          },
        },
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId,
              dimension: "COLUMNS",
              startIndex: 0,
              endIndex: leadHeaders.length,
            },
          },
        },
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: leadHeaders.length,
            },
            cell: {
              userEnteredFormat: {
                verticalAlignment: "MIDDLE",
                wrapStrategy: "WRAP",
                textFormat: {
                  fontSize: 10,
                },
              },
            },
            fields: "userEnteredFormat(verticalAlignment,wrapStrategy,textFormat.fontSize)",
          },
        },
        {
          updateDimensionProperties: {
            range: {
              sheetId,
              dimension: "COLUMNS",
              startIndex: 0,
              endIndex: 1,
            },
            properties: {
              pixelSize: 140,
            },
            fields: "pixelSize",
          },
        },
        {
          updateDimensionProperties: {
            range: {
              sheetId,
              dimension: "COLUMNS",
              startIndex: 1,
              endIndex: 4,
            },
            properties: {
              pixelSize: 150,
            },
            fields: "pixelSize",
          },
        },
        {
          updateDimensionProperties: {
            range: {
              sheetId,
              dimension: "COLUMNS",
              startIndex: 6,
              endIndex: 8,
            },
            properties: {
              pixelSize: 120,
            },
            fields: "pixelSize",
          },
        },
      ],
    }),
  });
}

async function prepareSheet(accessToken) {
  if (sheetPrepared) {
    return;
  }

  const sheetId = await getSheetId(accessToken);
  await updateHeaderRow(accessToken);
  await normalizeExistingRows(accessToken);
  await formatSheet(accessToken, sheetId);
  sheetPrepared = true;
}

export async function prepareGoogleSheet() {
  if (!canUseSheets()) {
    return null;
  }

  const accessToken = await getAccessToken();
  const sheetId = await getSheetId(accessToken);
  await updateHeaderRow(accessToken);
  await normalizeExistingRows(accessToken);
  await formatSheet(accessToken, sheetId);
  return { type: "google_sheets", sheetName };
}

export async function appendLeadToGoogleSheets(lead) {
  if (!canUseSheets()) {
    return null;
  }

  const accessToken = await getAccessToken();
  try {
    await prepareSheet(accessToken);
  } catch (error) {
    console.error(`Google Sheets prepare failed, appending lead anyway: ${error.message}`);
  }

  const range = encodeURIComponent(sheetRange("A:K"));
  const values = [formatLeadRow(lead)];

  let response;
  try {
    response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=RAW`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ values }),
      },
    );
  } catch (error) {
    throw new Error(`Google Sheets append network error: ${error.message}`);
  }

  const result = await response.json();
  if (!response.ok) {
    throw new Error(`Google Sheets append failed: ${JSON.stringify(result)}`);
  }

  return { type: "google_sheets", updatedRange: result.updates?.updatedRange };
}
