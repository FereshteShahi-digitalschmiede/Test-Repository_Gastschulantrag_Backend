-- CreateEnum
CREATE TYPE "VorgangStatus" AS ENUM ('in_pruefung', 'bescheid_bereit', 'abgeschlossen');

-- CreateEnum
CREATE TYPE "LaufwegModus" AS ENUM ('gestuft', 'sequenziell');

-- CreateEnum
CREATE TYPE "StellenRolle" AS ENUM ('sprengelschule', 'gastschule', 'traeger_sprengelschule', 'traeger_gastschule', 'regierung');

-- CreateEnum
CREATE TYPE "StellenStatus" AS ENUM ('wartet', 'offen', 'zugestimmt', 'abgelehnt', 'bedingt', 'entfaellt');

-- CreateEnum
CREATE TYPE "Signatur" AS ENUM ('qualifiziert', 'fortgeschritten', 'einfach', 'system');

-- CreateTable
CREATE TABLE "Vorgang" (
    "id" TEXT NOT NULL,
    "nummer" SERIAL NOT NULL,
    "aktenzeichen" TEXT,
    "status" "VorgangStatus" NOT NULL DEFAULT 'in_pruefung',
    "eingegangenAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schuljahr" TEXT NOT NULL,
    "sprengelschuleNr" TEXT NOT NULL,
    "gastschuleNr" TEXT NOT NULL,
    "schuelerName" TEXT NOT NULL,
    "ausbildungsberuf" TEXT,
    "laufwegModus" "LaufwegModus" NOT NULL DEFAULT 'gestuft',
    "antrag" JSONB NOT NULL,
    "fahrzeit" JSONB,

    CONSTRAINT "Vorgang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stelle" (
    "id" TEXT NOT NULL,
    "vorgangId" TEXT NOT NULL,
    "rolle" "StellenRolle" NOT NULL,
    "organisation" TEXT NOT NULL,
    "stufe" INTEGER NOT NULL,
    "status" "StellenStatus" NOT NULL,
    "frist" DATE,
    "begruendung" TEXT,
    "abgegebenAm" TIMESTAMP(3),

    CONSTRAINT "Stelle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dokument" (
    "id" TEXT NOT NULL,
    "vorgangId" TEXT NOT NULL,
    "dateiname" TEXT NOT NULL,
    "groesseBytes" INTEGER NOT NULL,
    "besondereKategorie" BOOLEAN NOT NULL DEFAULT false,
    "automatischErstellt" BOOLEAN NOT NULL DEFAULT false,
    "speicherSchluessel" TEXT,
    "hochgeladenAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dokument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Protokolleintrag" (
    "id" TEXT NOT NULL,
    "vorgangId" TEXT NOT NULL,
    "zeitpunkt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ereignis" TEXT NOT NULL,
    "organisation" TEXT,
    "akteur" TEXT NOT NULL,
    "rolle" TEXT NOT NULL,
    "ebene" INTEGER NOT NULL,
    "signatur" "Signatur" NOT NULL,

    CONSTRAINT "Protokolleintrag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vorgang_nummer_key" ON "Vorgang"("nummer");

-- CreateIndex
CREATE UNIQUE INDEX "Vorgang_aktenzeichen_key" ON "Vorgang"("aktenzeichen");

-- CreateIndex
CREATE INDEX "Vorgang_sprengelschuleNr_idx" ON "Vorgang"("sprengelschuleNr");

-- CreateIndex
CREATE INDEX "Vorgang_gastschuleNr_idx" ON "Vorgang"("gastschuleNr");

-- CreateIndex
CREATE UNIQUE INDEX "Stelle_vorgangId_rolle_key" ON "Stelle"("vorgangId", "rolle");

-- CreateIndex
CREATE INDEX "Protokolleintrag_vorgangId_zeitpunkt_idx" ON "Protokolleintrag"("vorgangId", "zeitpunkt");

-- AddForeignKey
ALTER TABLE "Stelle" ADD CONSTRAINT "Stelle_vorgangId_fkey" FOREIGN KEY ("vorgangId") REFERENCES "Vorgang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dokument" ADD CONSTRAINT "Dokument_vorgangId_fkey" FOREIGN KEY ("vorgangId") REFERENCES "Vorgang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protokolleintrag" ADD CONSTRAINT "Protokolleintrag_vorgangId_fkey" FOREIGN KEY ("vorgangId") REFERENCES "Vorgang"("id") ON DELETE CASCADE ON UPDATE CASCADE;
