/** RFC 4180 CSV: quoted fields, doubled quotes, CRLF or LF rows. Blank lines are skipped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const endRow = () => {
    row.push(field);
    field = '';
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') endRow();
    else if (char !== '\r') field += char;
  }

  if (inQuotes) throw new Error('CSV has an unclosed quote.');
  endRow();
  return rows;
}

/** One CSV field, always quoted. */
export function csvField(value: string | number | boolean): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}
