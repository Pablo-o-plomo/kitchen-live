import * as XLSX from 'xlsx';

const SUPPORTED_XLSX = ['.xlsx', '.xls'];

export function assertXlsxFile(file: File) {
  const lower = file.name.toLowerCase();
  const isSupported = SUPPORTED_XLSX.some((ext) => lower.endsWith(ext));
  if (!isSupported) {
    throw new Error('Поддерживаются только файлы Excel: .xlsx или .xls');
  }
}

export async function parseUpload(file: File) {
  assertXlsxFile(file);
  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];
}
