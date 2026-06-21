/*
  Warnings:

  - You are about to drop the `Attendee` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Attendee";

-- CreateTable
CREATE TABLE "table_memberName" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "job" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "code" TEXT,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "table_memberName_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "table_memberName_code_key" ON "table_memberName"("code");

-- CreateIndex
CREATE INDEX "table_memberName_fullName_idx" ON "table_memberName"("fullName");
