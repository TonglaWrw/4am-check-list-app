/*
  Warnings:

  - You are about to drop the `table_memberName` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "table_memberName";

-- CreateTable
CREATE TABLE "tableMemberName" (
    "uid" TEXT NOT NULL,
    "memberName" TEXT NOT NULL,
    "job" TEXT,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tableMemberName_pkey" PRIMARY KEY ("uid")
);

-- CreateIndex
CREATE INDEX "tableMemberName_memberName_idx" ON "tableMemberName"("memberName");
