import crypto from "crypto";

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "1HLeoFjS-1AsesJtd3y3hWFawmZMYQC_-V4Ixu2KD_As";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

function serviceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Google Sheets is not connected yet.");
  return JSON.parse(raw);
}

function base64url(value: string | Buffer) { return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }

async function accessToken() {
  const account = serviceAccount(); const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({ iss: account.client_email, scope: SHEETS_SCOPE, aud: account.token_uri || "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const signer = crypto.createSign("RSA-SHA256"); signer.update(`${header}.${claim}`); signer.end();
  const assertion = `${header}.${claim}.${signer.sign(account.private_key, "base64url")}`;
  const response = await fetch(account.token_uri || "https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const data: any = await response.json(); if (!response.ok) throw new Error(data.error_description || "Google authorization failed."); return data.access_token as string;
}

async function request(path: string, init: RequestInit = {}) {
  const token = await accessToken(); const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  const data: any = await response.json(); if (!response.ok) throw new Error(data?.error?.message || "Google Sheets request failed."); return data;
}

export const TRIVIA_TUESDAY_HEADERS = ["question_id","category","subcategory","difficulty","question_text","answer","answer_aliases","question_type","choice_a","choice_b","choice_c","choice_d","correct_choice","media_type","media_url","game_modes","hastings_used","norfolk_used","active","notes","round_name","board_column","board_row"];

export async function createTriviaTuesdaySheet(title: string, eventCode: string) {
  const rows: string[][] = [TRIVIA_TUESDAY_HEADERS];
  const add = (round: string, column: number, row: number, suffix: string) => rows.push([`TT-${eventCode}-${suffix}-C${String(column).padStart(2,"0")}-P${String(row).padStart(2,"0")}`,"","","","","","","typed","","","","","","none","","rickhouse","FALSE","FALSE","TRUE","",round,String(column),String(row)]);
  for (const round of [["single_cask","S1"],["double_cask","S2"]] as const) for (let column=1; column<=5; column++) for (let row=1; row<=5; row++) add(round[0],column,row,round[1]);
  rows.push([`TT-${eventCode}-FINAL`,"","","Extra Hard","","","","typed","","","","","","none","","rickhouse","FALSE","FALSE","TRUE","","cask_strength","",""]);
  const result = await request(":batchUpdate", { method:"POST", body: JSON.stringify({ requests:[{ addSheet:{ properties:{ title } } }] }) });
  await request(`/values/${encodeURIComponent(title)}!A1:W52?valueInputOption=RAW`, { method:"PUT", body: JSON.stringify({ majorDimension:"ROWS", values:rows }) });
  return result.replies[0].addSheet.properties;
}

export async function loadTriviaTuesdayRows(tabName: string) {
  const data = await request(`/values/${encodeURIComponent(tabName)}!A1:W2000`); const values: string[][] = data.values || []; const [headers,...rows] = values;
  if (!headers) throw new Error("The Trivia Tuesday sheet is empty.");
  return rows.map((row) => Object.fromEntries(headers.map((header,index)=>[header,row[index] || ""]))).filter((row:any)=>row.question_id && row.active?.toLowerCase() !== "false");
}
