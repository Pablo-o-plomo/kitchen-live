import './globals.css';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const restaurants = await prisma.restaurant.findMany({ where: { isActive: true } });
  return <html><body><div className="layout"><aside className="sidebar"><h3>Menu Control</h3><p><Link href="/">Дашборд</Link></p><p><Link href="/analytics">Аналитика</Link></p><p><Link href="/changes">Изменения</Link></p><p><Link href="/uploads/menu">Импорт меню</Link></p><p><Link href="/uploads/sales">Импорт продаж</Link></p><p><Link href="/planning">Планирование</Link></p><hr/>{restaurants.map(r=><p key={r.id}><Link href={`/restaurants/${r.id}`}>{r.name}</Link></p>)}</aside><main className="content">{children}</main></div></body></html>;
}
