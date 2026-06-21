/*
  Warnings:

  - The primary key for the `tableMemberName` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "tableMemberName" DROP CONSTRAINT "tableMemberName_pkey",
ALTER COLUMN "uid" SET DATA TYPE TEXT,
ADD CONSTRAINT "tableMemberName_pkey" PRIMARY KEY ("uid");
