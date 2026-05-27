import { NextResponse } from 'next/server';
import { parseUpload } from '@/lib/parse';
import { mapSalesImportRow } from '@/lib/import-mapping';

export async function POST(req: Request) {
  const fd = await req.formData();
  const file = fd.get('file') as File;
  const restaurantId = Number(fd.get('restaurantId'));
  try {
    const rows = await parseUpload(file);
    const mappedRows = rows.map(mapSalesImportRow);
    const invalidRows = mappedRows.filter((r) => !r.name || r.quantitySold <= 0).length;
    return NextResponse.json({ restaurantId, rows: mappedRows, invalidRows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ошибка чтения файла" }, { status: 400 });
  }
}
