import { NextResponse } from 'next/server';
import { parseUpload } from '@/lib/parse';
import { mapMenuImportRow } from '@/lib/import-mapping';

export async function POST(req: Request) {
  const fd = await req.formData();
  const file = fd.get('file') as File;
  const restaurantId = Number(fd.get('restaurantId'));
  try {
    const rows = await parseUpload(file);
    const mappedRows = rows.map(mapMenuImportRow);
    const invalidRows = mappedRows.filter((r) => !r.name || r.salePrice <= 0).length;
    return NextResponse.json({ restaurantId, fileName: file.name, rows: mappedRows, invalidRows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ошибка чтения файла" }, { status: 400 });
  }
}
