import { prisma } from '@/lib/prisma';

export default async function Page() {
  const items = await prisma.menuItem.findMany({ where: { isActive: true }, include: { restaurant: true }, orderBy: { foodCostPercent: 'desc' } });
  const planned = await prisma.menuPriceChange.findMany({ where: { status: 'planned' }, include: { menuItem: true, restaurant: true }, orderBy: { plannedDate: 'asc' }, take: 10 });
  const avgFood = items.reduce((a,b)=>a+b.foodCostPercent,0)/(items.length||1);
  const avgMarkup = items.reduce((a,b)=>a+b.markupPercent,0)/(items.length||1);
  return <div>
    <h1>Дашборд</h1>
    <div className="card">Блюд в продаже: {items.length} | Средний food cost: {avgFood.toFixed(2)}% | Средняя наценка: {avgMarkup.toFixed(2)}%</div>
    <div className="card"><h3>Худший food cost</h3>{items.slice(0,5).map(i=><div key={i.id}>{i.restaurant.name} — {i.name}: {i.foodCostPercent.toFixed(1)}%</div>)}</div>
    <div className="card"><h3>Планируемые изменения</h3>{planned.map(p=><div key={p.id}>{p.restaurant.name} / {p.menuItem.name} → {p.newSalePrice} ₽ ({p.plannedDate?.toISOString().slice(0,10)})</div>)}</div>
  </div>;
}
