import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma=new PrismaClient();
const rests=['Южно-Сахалинск','Сочи','Авиапарк','Ростов'];
async function main(){for(const name of rests){await prisma.restaurant.upsert({where:{name},update:{},create:{name,city:name}});}const all=await prisma.restaurant.findMany();for(const r of all){for(let i=1;i<=10;i++){const cost=100+i*10;const sale=cost*2.2;await prisma.menuItem.upsert({where:{restaurantId_name:{restaurantId:r.id,name:`Блюдо ${i}`}},update:{},create:{restaurantId:r.id,name:`Блюдо ${i}`,category:i%2?'Горячее':'Закуски',costPrice:cost,salePrice:sale,markupRub:sale-cost,markupPercent:((sale-cost)/cost)*100,foodCostPercent:(cost/sale)*100,startDate:new Date()}});}}
const adminPass=await bcrypt.hash('admin123',10);await prisma.user.upsert({where:{username:'admin'},update:{},create:{username:'admin',passwordHash:adminPass,role:'admin'}});
}
main().finally(()=>prisma.$disconnect());
