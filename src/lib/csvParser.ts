export interface CsvParseOptions {
  delimiter?: ',' | ';' | 'auto';
  maxRows?: number;
  columnMap?: Record<string, string>;
}

export interface CsvEmailRecipientRow {
  rowNumber: number;
  email: string;
  fullName: string;
  jabatan: string;
  provinsi: string;
  kabupaten: string;
  angkatan: string;
  nomorAnggota: string;
  raw: Record<string, string>;
}

export interface CsvRowError {
  rowNumber: number;
  rawLine: string;
  emailInput: string;
  reason: string;
}

export interface CsvEmailParseResult {
  delimiter: ',' | ';';
  headers: string[];
  detectedEmailColumn: string | null;
  totalDataRows: number;
  validRecipients: CsvEmailRecipientRow[];
  duplicateEmails: string[];
  invalidRows: CsvRowError[];
  truncated: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function detectCsvDelimiter(sampleText: string): ',' | ';' {
  const firstLine = (sampleText.replace(/^\uFEFF/, '').split(/\r?\n/)[0] || '').trim();
  let commas = 0;
  let semis = 0;
  let inQuotes = false;
  for (let i = 0; i < firstLine.length; i += 1) {
    const ch = firstLine[i];
    if (ch === '"') {
      if (inQuotes && firstLine[i + 1] === '"') {
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes) {
      if (ch === ',') commas += 1;
      if (ch === ';') semis += 1;
    }
  }
  return semis > commas ? ';' : ',';
}

export function parseRfc4180Csv(
  rawText: string,
  options?: { delimiter?: ',' | ';' | 'auto'; maxRows?: number }
): { delimiter: ',' | ';'; rows: string[][] } {
  const cleaned = rawText.replace(/^\uFEFF/, '');
  if (!cleaned.trim()) {
    return { delimiter: ',', rows: [] };
  }

  const delimiter: ',' | ';' =
    options?.delimiter === ',' || options?.delimiter === ';'
      ? options.delimiter
      : detectCsvDelimiter(cleaned);

  const maxRows = Math.max(1, options?.maxRows ?? 5000);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          currentField += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (ch === '\r' && next === '\n') {
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      i += 1;
      if (rows.length >= maxRows + 1) break;
    } else if (ch === '\n' || ch === '\r') {
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      if (rows.length >= maxRows + 1) break;
    } else {
      currentField += ch;
    }
  }

  if (rows.length < maxRows + 1 && (currentField.length > 0 || currentRow.length > 0)) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return { delimiter, rows };
}

function normalizeHeaderKey(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const EMAIL_ALIASES = ['email', 'e_mail', 'alamat_email', 'surel', 'mail'];
const NAME_ALIASES = ['nama', 'full_name', 'fullname', 'nama_lengkap', 'name'];
const ROLE_ALIASES = ['jabatan', 'role', 'peran', 'posisi', 'position_title'];
const PROV_ALIASES = ['provinsi', 'province', 'province_name', 'province_code', 'wilayah'];
const KAB_ALIASES = ['kabupaten', 'kota', 'kabupaten_kota', 'regency'];
const BATCH_ALIASES = ['angkatan', 'batch', 'batch_id', 'batch_name'];
const MEMBER_ALIASES = ['nomor_anggota', 'member_number', 'no_anggota'];

function pickColumn(
  headersNorm: string[],
  headersOrig: string[],
  mappedName: string | undefined,
  aliases: string[]
): number {
  if (mappedName) {
    const idxExact = headersOrig.findIndex((h) => h === mappedName);
    if (idxExact >= 0) return idxExact;
    const normTarget = normalizeHeaderKey(mappedName);
    const idxNorm = headersNorm.findIndex((h) => h === normTarget);
    if (idxNorm >= 0) return idxNorm;
  }
  for (const alias of aliases) {
    const idx = headersNorm.findIndex((h) => h === alias || h.includes(alias));
    if (idx >= 0) return idx;
  }
  return -1;
}

export function parseCsvObjects(
  rawText: string,
  options?: { delimiter?: ',' | ';' | 'auto'; maxRows?: number }
): { delimiter: ',' | ';'; headers: string[]; records: { rowNumber: number; data: Record<string, string> }[]; truncated: boolean } {
  const maxRows = options?.maxRows ?? 2000;
  const { delimiter, rows } = parseRfc4180Csv(rawText, { delimiter: options?.delimiter, maxRows });
  if (rows.length === 0) {
    return { delimiter, headers: [], records: [], truncated: false };
  }
  const headers = rows[0].map((h, idx) => h.trim() || `kolom_${idx + 1}`);
  const dataRows = rows.slice(1);
  const truncated = dataRows.length > maxRows;
  const records = dataRows.slice(0, maxRows).map((cells, idx) => {
    const data: Record<string, string> = {};
    headers.forEach((h, cIdx) => {
      data[h] = (cells[cIdx] ?? '').trim();
    });
    return { rowNumber: idx + 2, data };
  });
  return { delimiter, headers, records, truncated };
}

export function parseEmailRecipientsCsv(
  rawText: string,
  options?: CsvParseOptions
): CsvEmailParseResult {
  const maxRows = options?.maxRows ?? 500;
  const { delimiter, rows } = parseRfc4180Csv(rawText, { delimiter: options?.delimiter, maxRows });
  if (rows.length === 0) {
    return {
      delimiter: ',',
      headers: [],
      detectedEmailColumn: null,
      totalDataRows: 0,
      validRecipients: [],
      duplicateEmails: [],
      invalidRows: [],
      truncated: false,
    };
  }

  const firstRow = rows[0];
  const firstRowLooksHeaderless =
    firstRow.length === 1 && EMAIL_RE.test(firstRow[0].trim())
    || (firstRow.some((c) => EMAIL_RE.test(c.trim())) && !firstRow.some((c) => EMAIL_ALIASES.includes(normalizeHeaderKey(c))));

  const headers = firstRowLooksHeaderless
    ? firstRow.map((_, idx) => (idx === 0 ? 'email' : `kolom_${idx + 1}`))
    : firstRow.map((h, idx) => h.trim() || `kolom_${idx + 1}`);
  const dataRows = firstRowLooksHeaderless ? rows : rows.slice(1);
  const headersNorm = headers.map(normalizeHeaderKey);
  const map = options?.columnMap || {};

  let emailIdx = pickColumn(headersNorm, headers, map.email, EMAIL_ALIASES);
  if (emailIdx < 0) {
    // Fallback: locate column containing email-shaped strings in first 5 rows
    for (let col = 0; col < headers.length; col += 1) {
      if (dataRows.slice(0, 5).some((r) => EMAIL_RE.test((r[col] || '').trim()))) {
        emailIdx = col;
        break;
      }
    }
  }

  const nameIdx = pickColumn(headersNorm, headers, map.fullName || map.nama, NAME_ALIASES);
  const roleIdx = pickColumn(headersNorm, headers, map.jabatan, ROLE_ALIASES);
  const provIdx = pickColumn(headersNorm, headers, map.provinsi, PROV_ALIASES);
  const kabIdx = pickColumn(headersNorm, headers, map.kabupaten, KAB_ALIASES);
  const batchIdx = pickColumn(headersNorm, headers, map.angkatan, BATCH_ALIASES);
  const memberIdx = pickColumn(headersNorm, headers, map.nomorAnggota, MEMBER_ALIASES);

  const seenEmails = new Set<string>();
  const duplicateEmails = new Set<string>();
  const validRecipients: CsvEmailRecipientRow[] = [];
  const invalidRows: CsvRowError[] = [];
  const truncated = dataRows.length > maxRows;

  for (let i = 0; i < Math.min(dataRows.length, maxRows); i += 1) {
    const cells = dataRows[i];
    const rowNumber = firstRowLooksHeaderless ? i + 1 : i + 2;
    const rawObj: Record<string, string> = {};
    headers.forEach((h, cIdx) => {
      rawObj[h] = (cells[cIdx] ?? '').trim();
    });

    const emailCandidate = (emailIdx >= 0 ? cells[emailIdx] || '' : cells[0] || '').trim().toLowerCase();
    if (!emailCandidate) {
      invalidRows.push({
        rowNumber,
        rawLine: cells.join(delimiter),
        emailInput: '',
        reason: 'Alamat email kosong',
      });
      continue;
    }
    if (!EMAIL_RE.test(emailCandidate)) {
      invalidRows.push({
        rowNumber,
        rawLine: cells.join(delimiter),
        emailInput: emailCandidate,
        reason: 'Format email tidak valid',
      });
      continue;
    }
    if (seenEmails.has(emailCandidate)) {
      duplicateEmails.add(emailCandidate);
      invalidRows.push({
        rowNumber,
        rawLine: cells.join(delimiter),
        emailInput: emailCandidate,
        reason: 'Email duplikat di dalam berkas CSV',
      });
      continue;
    }

    seenEmails.add(emailCandidate);
    const fullName = (nameIdx >= 0 ? cells[nameIdx] : '') || emailCandidate.split('@')[0];
    validRecipients.push({
      rowNumber,
      email: emailCandidate,
      fullName: fullName.trim(),
      jabatan: (roleIdx >= 0 ? cells[roleIdx] : '') || '',
      provinsi: (provIdx >= 0 ? cells[provIdx] : '') || '',
      kabupaten: (kabIdx >= 0 ? cells[kabIdx] : '') || '',
      angkatan: (batchIdx >= 0 ? cells[batchIdx] : '') || '',
      nomorAnggota: (memberIdx >= 0 ? cells[memberIdx] : '') || '',
      raw: rawObj,
    });
  }

  return {
    delimiter,
    headers,
    detectedEmailColumn: emailIdx >= 0 ? headers[emailIdx] : null,
    totalDataRows: dataRows.length,
    validRecipients,
    duplicateEmails: [...duplicateEmails],
    invalidRows,
    truncated,
  };
}

export function buildCsvErrorReport(errors: CsvRowError[]): string {
  const safe = (val: string) => {
    let s = val || '';
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = ['Baris', 'Email Input', 'Alasan Gagal', 'Data Baris'].map(safe).join(',');
  const lines = errors.map((e) =>
    [String(e.rowNumber), e.emailInput || '(kosong)', e.reason, e.rawLine].map(safe).join(',')
  );
  return `\uFEFF${[header, ...lines].join('\n')}`;
}
