import { cookies } from 'next/headers';
import { prisma } from './prisma';

export async function getCurrentUser() {
  const userId = cookies().get('uid')?.value;
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: Number(userId) }, include: { restaurant: true } });
}
