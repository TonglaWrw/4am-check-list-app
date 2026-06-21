import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const zones = await prisma.zone.findMany();
  for (const zone of zones) {
    for (const name of ['สำรอง', 'ลา']) {
      const exists = await prisma.section.findFirst({ where: { name, zoneId: zone.id } });
      if (!exists) {
        await prisma.section.create({ data: { name, zoneId: zone.id } });
        console.log(`✓ ${zone.name} → ${name}`);
      } else {
        console.log(`- ${zone.name} → ${name} (มีอยู่แล้ว)`);
      }
    }
  }
  console.log("Done!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
