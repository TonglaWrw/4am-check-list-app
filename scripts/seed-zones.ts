import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const zones = [
  { name: "TeamA", label: "A STRATEGIC ZONE", sections: ["A1","A2","A3","A4","A5"] },
  { name: "TeamB", label: "B STRATEGIC ZONE", sections: ["B1","B2","B3","B4","B5"] },
  { name: "TeamC", label: "C STRATEGIC ZONE", sections: ["C1","C2","C3","C4","C5"] },
];

async function main() {
  for (const z of zones) {
    const zone = await prisma.zone.upsert({
      where: { name: z.name },
      update: { label: z.label },
      create: { name: z.name, label: z.label },
    });
    for (const s of z.sections) {
      const exists = await prisma.section.findFirst({ where: { name: s, zoneId: zone.id } });
      if (!exists) await prisma.section.create({ data: { name: s, zoneId: zone.id } });
    }
    console.log(`✓ ${z.name} (${z.sections.join(", ")})`);
  }
  console.log("Done!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
