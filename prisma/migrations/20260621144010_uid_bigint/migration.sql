/*
  Warnings:

  - The primary key for the `tableMemberName` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `uid` on the `tableMemberName` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "tableMemberName" DROP CONSTRAINT "tableMemberName_pkey",
DROP COLUMN "uid",
ADD COLUMN     "uid" BIGINT NOT NULL,
ADD CONSTRAINT "tableMemberName_pkey" PRIMARY KEY ("uid");
