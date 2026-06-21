-- CreateTable
CREATE TABLE "tableSkill" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "category" TEXT,

    CONSTRAINT "tableSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tableAttendeeSkill" (
    "attendeeUid" TEXT NOT NULL,
    "skillId" INTEGER NOT NULL,

    CONSTRAINT "tableAttendeeSkill_pkey" PRIMARY KEY ("attendeeUid","skillId")
);

-- AddForeignKey
ALTER TABLE "tableAttendeeSkill" ADD CONSTRAINT "tableAttendeeSkill_attendeeUid_fkey" FOREIGN KEY ("attendeeUid") REFERENCES "tableMemberName"("uid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tableAttendeeSkill" ADD CONSTRAINT "tableAttendeeSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "tableSkill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
