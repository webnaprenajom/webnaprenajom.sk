import { readFileSync } from "node:fs";
import type { ParsedCsvRow } from "./types.js";

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Minimal RFC4180-style CSV parser (quoted fields, commas, newlines in quotes). */
export function parseCsvContent(content: string): ParsedCsvRow[] {
  const text = stripBom(content.replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
  if (!text.trim()) return [];

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      field = "";
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  row.push(field);
  if (row.some((c) => c.length > 0)) rows.push(row);

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const obj: ParsedCsvRow = {};
    headers.forEach((header, idx) => {
      obj[header] = (cells[idx] ?? "").trim();
    });
    return obj;
  });
}

export function readCsvFile(filePath: string): ParsedCsvRow[] {
  const content = readFileSync(filePath, "utf8");
  return parseCsvContent(content);
}
