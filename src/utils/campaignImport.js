import { normalizePhoneToE164 } from '@/services/campaigns';

const HEADER_ALIASES = {
  name: ['nome', 'name', 'cliente', 'contato'],
  phone: ['telefone', 'phone', 'celular', 'whatsapp', 'numero', 'número'],
  company: ['empresa', 'company', 'organizacao', 'organização'],
  email: ['email', 'e-mail'],
  city: ['cidade', 'city'],
  notes: ['observacao', 'observação', 'obs', 'nota', 'notes'],
  tag: ['tag', 'tags', 'etiqueta'],
  origin: ['origem', 'source', 'fonte'],
  opt_in: ['opt_in', 'optin', 'autorizado', 'consentimento', 'permitido'],
  last_interaction_at: ['ultima_interacao', 'última_interação', 'last_interaction', 'ultima interação']
};

const normalizeHeader = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const parseBoolean = (value) => {
  const normalized = normalizeHeader(value);
  if (['true', 'sim', 'yes', 'y', '1', 'ok', 'autorizado'].includes(normalized)) return true;
  if (['false', 'nao', 'não', 'no', 'n', '0'].includes(normalized)) return false;
  return false;
};

const splitCsvLine = (line, delimiter) => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

const detectDelimiter = (line) => {
  const commaCount = (line.match(/,/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
};

const rowsFromCsv = async (file) => {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader);

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line, delimiter);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] || '';
      return row;
    }, {});
  });
};

const rowsFromXlsx = async (file) => {
  const ExcelJSModule = await import('exceljs/dist/exceljs.min.js');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers = [];
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = normalizeHeader(cell.value);
  });

  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const item = {};
    headers.forEach((header, colNumber) => {
      if (!header) return;
      const value = row.getCell(colNumber).value;
      item[header] = typeof value === 'object' && value?.text
        ? value.text
        : value?.result ?? value ?? '';
    });

    if (Object.values(item).some((value) => String(value || '').trim())) {
      rows.push(item);
    }
  });

  return rows;
};

const pick = (row, field) => {
  const aliases = HEADER_ALIASES[field] || [field];
  const normalizedAliases = aliases.map(normalizeHeader);
  const key = normalizedAliases.find((alias) => row[alias] !== undefined);
  return key ? row[key] : '';
};

export const normalizeCampaignRow = (row, index) => {
  const importedPhone = String(pick(row, 'phone') || '').trim();
  const normalizedPhone = normalizePhoneToE164(importedPhone);
  const name = String(pick(row, 'name') || '').trim();
  const errors = [];

  if (!name) errors.push('missing_name');
  if (!normalizedPhone) errors.push('invalid_phone');

  return {
    row_number: index + 1,
    imported_name: name,
    imported_phone: importedPhone,
    normalized_phone: normalizedPhone,
    company_name: String(pick(row, 'company') || '').trim(),
    email: String(pick(row, 'email') || '').trim(),
    city: String(pick(row, 'city') || '').trim(),
    notes: String(pick(row, 'notes') || '').trim(),
    tag: String(pick(row, 'tag') || '').trim(),
    origin: String(pick(row, 'origin') || 'planilha').trim(),
    opt_in: parseBoolean(pick(row, 'opt_in')),
    last_interaction_at: String(pick(row, 'last_interaction_at') || '').trim() || null,
    source: 'excel',
    is_valid: errors.length === 0,
    validation_errors: errors,
    block_reason: errors[0] || null
  };
};

export const buildImportPreview = (rows) => {
  const seenPhones = new Set();

  const normalizedRows = rows.map((row, index) => normalizeCampaignRow(row, index));
  const processedRows = normalizedRows.map((row) => {
    const isDuplicate = Boolean(row.normalized_phone && seenPhones.has(row.normalized_phone));
    if (row.normalized_phone) seenPhones.add(row.normalized_phone);

    const validationErrors = [...row.validation_errors];
    if (isDuplicate) validationErrors.push('duplicate_phone');

    return {
      ...row,
      is_duplicate: isDuplicate,
      is_valid: row.is_valid && !isDuplicate,
      validation_errors: validationErrors,
      block_reason: validationErrors[0] || null
    };
  });

  return {
    rows: processedRows,
    validRows: processedRows.filter((row) => row.is_valid),
    invalidRows: processedRows.filter((row) => !row.is_valid),
    duplicateRows: processedRows.filter((row) => row.is_duplicate),
    totalRows: processedRows.length
  };
};

export async function parseCampaignFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  let rows = [];

  if (extension === 'csv') {
    rows = await rowsFromCsv(file);
  } else if (['xlsx', 'xls'].includes(extension)) {
    rows = await rowsFromXlsx(file);
  } else {
    throw new Error('Formato nao suportado. Envie um arquivo CSV ou XLSX.');
  }

  return buildImportPreview(rows);
}
