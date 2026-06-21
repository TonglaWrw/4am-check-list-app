import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const name of ['ลา', 'สำรอง']) {
    const all = await prisma.section.findMany({ where: { name }, orderBy: { id: 'asc' } });
    if (all.length <= 1) { console.log(`${name}: มีอยู่แล้วแค่อันเดียว`); continue; }

    const [keep, ...rest] = all;
    console.log(`${name}: เก็บ id=${keep.id}, ลบ ${rest.map(s => s.id).join(',')}`);

    for (const s of rest) {
      await prisma.attendee.updateMany({ where: { sectionId: s.id }, data: { sectionId: keep.id } });
      await prisma.section.delete({ where: { id: s.id } });
    }
  }
  console.log("Done!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
