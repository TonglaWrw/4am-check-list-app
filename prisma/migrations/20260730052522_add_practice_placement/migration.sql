-- AlterTable
ALTER TABLE "tableZone" ADD COLUMN "isPractice" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tableMemberName" ADD COLUMN "practiceSectionId" INTEGER,
ADD COLUMN "practicePosition" INTEGER;

-- AddForeignKey
ALTER TABLE "tableMemberName" ADD CONSTRAINT "tableMemberName_practiceSectionId_fkey" FOREIGN KEY ("practiceSectionId") REFERENCES "tableSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
