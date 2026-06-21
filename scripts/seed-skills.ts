import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const images = Array.from({ length: 27 }, (_, i) => `/image/cellImage_531978770_${i}.jpg`);
  for (const imagePath of images) {
    await prisma.skill.upsert({
      where: { id: images.indexOf(imagePath) + 1 },
      update: { imagePath },
      create: { imagePath },
    });
    console.log(`✓ ${imagePath}`);
  }
  console.log("Done!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
