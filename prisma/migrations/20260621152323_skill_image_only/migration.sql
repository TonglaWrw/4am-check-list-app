/*
  Warnings:

  - You are about to drop the column `category` on the `tableSkill` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `tableSkill` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "tableSkill" DROP COLUMN "category",
DROP COLUMN "name";
