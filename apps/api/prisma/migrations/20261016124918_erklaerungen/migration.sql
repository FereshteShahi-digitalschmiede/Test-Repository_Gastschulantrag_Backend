-- AlterTable
ALTER TABLE "Stelle" ADD COLUMN     "akteurFunktion" TEXT,
ADD COLUMN     "akteurName" TEXT,
ADD COLUMN     "angaben" JSONB,
ADD COLUMN     "ebene" INTEGER,
ADD COLUMN     "empfehlung" JSONB,
ADD COLUMN     "signatur" "Signatur";
