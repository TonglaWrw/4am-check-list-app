import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: npx tsx scripts/import-csv.ts <path-to-csv>");
  process.exit(1);
}

const lines = fs
  .readFileSync(path.resolve(csvPath), "utf-8")
  .split("\n")
  .slice(1);

let currentJob = "";
const rows: { uid: string; job: string; memberName: string }[] = [];

for (const line of lines) {
  const [job, member, uid] = line.split(",").map((s) => s.trim());
  if (!member || !uid) continue;
  if (job) currentJob = job;
  rows.push({ uid, job: currentJob, memberName: member });
}

async function main() {
  console.log("Clearing existing data...");
  await prisma.attendee.deleteMany();

  console.log(`Found ${rows.length} attendees, importing...`);
  for (const row of rows) {
    await prisma.attendee.create({
      data: { uid: row.uid, memberName: row.memberName, job: row.job },
    });
    console.log(`✓ ${row.job} - ${row.memberName} (${row.uid})`);
  }
  console.log("Done!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
