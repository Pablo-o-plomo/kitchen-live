import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const data = await req.json();
  let imported = 0;
  let skipped = 0;

  for (const r of data.rows as Array<Record<string, unknown>>) {
    const name = String(r.name ?? '').trim();
    if (!name) {
      skipped++;
      continue;
    }

    const item = await prisma.menuItem.findUnique({
      where: { restaurantId_name: { restaurantId: data.restaurantId, name } },
    });
    if (!item) {
      skipped++;
      continue;
    }

    const qty = Number(r.quantitySold ?? 0);
    if (qty <= 0) {
      skipped++;
      continue;
    }

    const revenue = Number(r.revenue ?? item.salePrice * qty);
    const totalCost = item.costPrice * qty;

    await prisma.salesData.create({
      data: {
        restaurantId: data.restaurantId,
        menuItemId: item.id,
        periodStart: r.periodStart ? new Date(String(r.periodStart)) : new Date(),
        periodEnd: r.periodEnd ? new Date(String(r.periodEnd)) : new Date(),
        quantitySold: qty,
        revenue,
        totalCost,
        totalMarkup: revenue - totalCost,
      },
    });
    imported++;
  }

  return NextResponse.json({ ok: true, imported, skipped });
}
