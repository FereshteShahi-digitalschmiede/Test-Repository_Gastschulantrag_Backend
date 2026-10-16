# Gastschulantrag – Backend

Backend für das MVP des digitalen Gastschulantrags (Berufsschulen Bayern, Art. 43 BayEUG).
Es bedient beide Frontends:

- Antragstellerseite: https://github.com/FereshteShahi-digitalschmiede/Test-Repository_Gastschulantrag_Antragstellerseite
- Bearbeitungsseite: https://github.com/FereshteShahi-digitalschmiede/Test-Repository_Gastschulantrag_Bearbeitungsseit

Architektur und Etappen: [docs/architektur.md](docs/architektur.md)

> **Nur Testdaten.** Bis zur Etappe „Vorbereitung echter Daten" keine echten personenbezogenen Daten verarbeiten.

## Aufbau

```
apps/api/          REST-API (NestJS, TypeScript)
packages/shared/   Gemeinsames Fachmodell (Typen + Validierung), auch für die Frontends
docker-compose.yml Lokale Infrastruktur: PostgreSQL, S3 (SeaweedFS), Keycloak, Mailpit
docs/              Architektur und Entscheidungen
```

## Schnellstart

Voraussetzungen: Node.js 22, pnpm 10, Docker.

```bash
cp .env.example .env
pnpm install
pnpm infra:up      # Datenbank, S3, Keycloak, Mailpit starten
pnpm --filter @gastschulantrag/api db:deploy   # Datenbankschema anlegen
pnpm build && pnpm --filter @gastschulantrag/api db:seed   # Testvorgänge anlegen
pnpm dev           # API mit Neustart bei Änderungen
```

| Dienst | Adresse |
|---|---|
| API | http://localhost:3100 |
| API-Dokumentation (OpenAPI) | http://localhost:3100/docs |
| PostgreSQL | localhost:54320 (Benutzer/Passwort/DB: `gastschule`) |
| S3 (SeaweedFS) | http://localhost:8333 |
| Keycloak | http://localhost:8080 (Verwaltung: admin / admin) |
| Mailpit (Test-Postfach) | http://localhost:8025 |

## Befehle

| Befehl | Zweck |
|---|---|
| `pnpm build` | alle Pakete bauen |
| `pnpm typecheck` | Typprüfung |
| `pnpm test` | Tests |
| `pnpm infra:down` | lokale Infrastruktur stoppen |
| `pnpm --filter @gastschulantrag/api db:migrate` | nach Änderung an `prisma/schema.prisma`: Migration erzeugen |
| `pnpm --filter @gastschulantrag/api db:reset` | Datenbank leeren und Testvorgänge neu anlegen |

Tests laufen gegen eine eigene Datenbank `gastschule_test` (wird automatisch angelegt), die Entwicklungsdaten bleiben unberührt.

## Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/health` | Erreichbarkeit von API und Datenbank |
| GET | `/konfiguration` | Anmeldedaten (Keycloak-Adresse, Client) für die Bearbeitungsseite |
| GET | `/schulen`, `/schulen/{nr}` | Schuldaten: Adresse, frühester Unterrichtsbeginn, spätestes Ende, Träger, Regierung |
| POST | `/fahrzeit/vergleich` | Schnellste ÖPNV-Verbindung zu Sprengel- und Gastschule, Bewertung gegen 2 Std. je Weg |
| POST | `/antraege` | Antrag einreichen → Vorgang mit Laufweg und Revisionsprotokoll; Antwort enthält einmalig den Zugangsschlüssel |
| GET | `/antraege/{Aktenzeichen}` | Stand des eigenen Antrags (Header `X-Zugangsschluessel`) |
| POST | `/antraege/{Aktenzeichen}/dokumente` | Nachweis hochladen: PDF/PNG/JPG bis 10 MB, Feld `datei` (Header `X-Zugangsschluessel`) |
| GET | `/vorgaenge?schule={nr}&organisation={name}` | Antragsübersicht mit Stand je Stelle, optional gefiltert nach Schule oder beteiligter Organisation |
| GET | `/vorgaenge/{id oder Aktenzeichen}` | Vorgang mit Laufweg, Fahrzeitenprüfung, Dokumenten, Protokoll |
| POST | `/vorgaenge/{id}/stellen/sprengelschule/empfehlung` | Empfehlung der Sachbearbeitung an die Schulleitung |
| POST | `/vorgaenge/{id}/stellen/{rolle}/erklaerung` | Erklärung einer Stelle; der Laufweg schaltet automatisch weiter (Logik: `apps/api/src/vorgaenge/laufweg.ts`) |

Details und Beispiel-Schemas: http://localhost:3100/docs

**Simuliert** (austauschbare Adapter): Schuldaten (`apps/api/src/schulen/schuldaten.ts`) und ÖPNV-Auskunft (`apps/api/src/fahrzeit/simulierte-oepnv-auskunft.ts`).
## Anmeldung und Rechte

**Bearbeitungsseite:** `/vorgaenge` nur mit Login über Keycloak (Realm `gastschule`, Client `bearbeitung`, Authorization Code + PKCE). Das Backend prüft das Token (Signatur über JWKS, Aussteller, Ablauf, Client) und leitet daraus ab, wer handelt:

| Testkonto (Passwort `test`) | Organisation | Funktion |
|---|---|---|
| `t.schneider` | Städt. BS I Augsburg | Sachbearbeitung – gibt die Empfehlung ab |
| `c.hofmann` | Städt. BS I Augsburg | Schulleitung – entscheidet für die Sprengelschule |
| `a.huber` | Städt. BS Fachinformatik München | Sachbearbeitung |
| `m.weber` | Stadt Augsburg | Sachbearbeitung |
| `p.lindner` | Landeshauptstadt München | Sachbearbeitung |
| `n.krueger` | Regierung von Schwaben | Sachbearbeitung |

Regeln (`apps/api/src/auth/zugriff.ts`):
- Sichtbar sind nur Vorgänge, an denen die eigene Organisation beteiligt ist; die Regierung erst bei Dissens. Fremde Vorgänge: 404.
- Erklären darf nur die eigene Stelle; die Entscheidung der Sprengelschule nur die Schulleitung (403).
- Sachaufwandsträger erhalten **pseudonymisierte** Daten (kein Klarname, Geburtsdatum, Kontakt, keine Straße).
- **Gesundheitsnachweise** (Art. 9 DSGVO) nur für Sprengelschule und Regierung – auch im Revisionsprotokoll.

Testkonten und Zuordnung stehen in `keycloak/realm-gastschule.json` (wird beim ersten Start importiert; nach Änderungen: `docker compose down keycloak && docker compose up -d keycloak`).

**Antragstellende** weisen sich bis zur BayernID-Anbindung mit dem Zugangsschlüssel aus, den sie beim Einreichen erhalten; gespeichert wird nur dessen Hash.

## Arbeitsweise

Für jede Aufgabe ein Issue, ein Branch `feature/<issue-nr>-<kurzname>` und ein Pull Request mit `Closes #<nr>`. Die CI prüft Build, Typen und Tests.

Abhängigkeiten werden mit festen Versionen eingetragen; pnpm installiert nur Versionen, die mindestens 14 Tage veröffentlicht sind (`minimumReleaseAge`).
