import { prisma } from '@/lib/prisma';

export default async function RestaurantPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  const items = await prisma.menuItem.findMany({ where: { restaurantId: id }, orderBy: { category: 'asc' } });
  return <div><h1>{restaurant?.name}</h1><table><thead><tr><th>Категория</th><th>Блюдо</th><th>Себестоимость</th><th>Цена</th><th>Наценка ₽</th><th>Наценка %</th><th>Food cost</th><th>Статус</th></tr></thead><tbody>
    {items.map(i=><tr key={i.id}><td>{i.category}</td><td>{i.name}</td><td>{i.costPrice}</td><td>{i.salePrice}</td><td>{i.markupRub.toFixed(2)}</td><td>{i.markupPercent.toFixed(2)}%</td><td>{i.foodCostPercent.toFixed(2)}%</td><td>{i.isActive?'в продаже':'снято'}</td></tr>)}
  </tbody></table></div>;
}
