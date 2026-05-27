import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calcMetrics } from '@/lib/calc';

export async function POST(req: Request) {
  const data = await req.json();
  let imported = 0;
  let errors = 0;

  for (const r of data.rows as Array<Record<string, unknown>>) {
    try {
      const name = String(r.name ?? '').trim();
      const cost = Number(r.costPrice ?? 0);
      const sale = Number(r.salePrice ?? 0);
      if (!name || sale <= 0) {
        errors++;
        continue;
      }

      const category = String(r.category ?? 'Без категории').trim();
      const m = calcMetrics(cost, sale);
      const existing = await prisma.menuItem.findUnique({
        where: { restaurantId_name: { restaurantId: data.restaurantId, name } },
      });

      if (!existing) {
        await prisma.menuItem.create({
          data: {
            restaurantId: data.restaurantId,
            name,
            category,
            costPrice: cost,
            salePrice: sale,
            startDate: r.startDate ? new Date(String(r.startDate)) : new Date(),
            ...m,
          },
        });
      } else if (existing.costPrice !== cost || existing.salePrice !== sale) {
        await prisma.menuPriceChange.create({
          data: {
            menuItemId: existing.id,
            restaurantId: data.restaurantId,
            oldCostPrice: existing.costPrice,
            newCostPrice: cost,
            oldSalePrice: existing.salePrice,
            newSalePrice: sale,
            oldMarkupRub: existing.markupRub,
            newMarkupRub: m.markupRub,
            oldFoodCostPercent: existing.foodCostPercent,
            newFoodCostPercent: m.foodCostPercent,
            changeDate: new Date(),
            plannedDate: null,
            status: 'active',
            comment: r.comment ? String(r.comment) : null,
          },
        });
        await prisma.menuItem.update({
          where: { id: existing.id },
          data: { costPrice: cost, salePrice: sale, ...m },
        });
      }
      imported++;
    } catch {
      errors++;
    }
  }

  await prisma.menuUpload.create({
    data: {
      restaurantId: data.restaurantId,
      fileName: data.fileName,
      uploadDate: new Date(),
      status: errors > 0 ? 'completed_with_errors' : 'completed',
      importedRows: imported,
      errorRows: errors,
    },
  });

  return NextResponse.json({ imported, errors });
}
