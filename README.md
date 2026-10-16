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
pnpm dev           # API mit Neustart bei Änderungen
```

| Dienst | Adresse |
|---|---|
| API | http://localhost:3100 |
| API-Dokumentation (OpenAPI) | http://localhost:3100/docs |
| PostgreSQL | localhost:54320 (Benutzer/Passwort/DB: `gastschule`) |
| S3 (SeaweedFS) | http://localhost:8333 |
| Keycloak | http://localhost:8080 (admin / admin) |
| Mailpit (Test-Postfach) | http://localhost:8025 |

## Befehle

| Befehl | Zweck |
|---|---|
| `pnpm build` | alle Pakete bauen |
| `pnpm typecheck` | Typprüfung |
| `pnpm test` | Tests |
| `pnpm infra:down` | lokale Infrastruktur stoppen |

## Arbeitsweise

Für jede Aufgabe ein Issue, ein Branch `feature/<issue-nr>-<kurzname>` und ein Pull Request mit `Closes #<nr>`. Die CI prüft Build, Typen und Tests.

Abhängigkeiten werden mit festen Versionen eingetragen; pnpm installiert nur Versionen, die mindestens 14 Tage veröffentlicht sind (`minimumReleaseAge`).
