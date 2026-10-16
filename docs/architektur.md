# Architektur

## Überblick

```
 Antragstellerseite (statisch)        Bearbeitungsseite (statisch)
 GitHub Pages → später eigene Domain  GitHub Pages → später eigene Domain
                \                       /
                 \   HTTPS / JSON      /
                  v                   v
            ┌──────────────────────────────┐
            │  API (NestJS, TypeScript)    │──── Keycloak (OIDC) ── später BayernID / Behörden-Login
            │  apps/api                    │──── E-Mail (SMTP)
            └──────────────┬───────────────┘──── ÖPNV-Auskunft (Adapter, aktuell simuliert)
                           │
              PostgreSQL ──┴── S3-Speicher (Nachweise)
```

Beide Frontends arbeiten am **selben Vorgang**: Die antragstellende Person reicht ihn ein, Sprengelschule, Gastschule, beide Sachaufwandsträger und ggf. die Regierung bearbeiten ihn, der Bescheid geht zurück. Deshalb gibt es **ein** Backend mit **einer** Datenbank.

## Leitentscheidungen

| Entscheidung | Begründung |
|---|---|
| TypeScript in Backend und Frontends | Eine Sprache im Team; Fachmodell (`packages/shared`) wird einmal definiert und überall genutzt |
| Eigene API statt Backend-as-a-Service | Keine Bindung an einen Anbieter; späterer Umzug in eine deutsche Cloud ist nur ein Hosting-Wechsel |
| PostgreSQL + S3-kompatibler Speicher, alles als Container | Standardbausteine, bei jedem Anbieter (STACKIT, IONOS, IT-Dienstleister des Freistaats) verfügbar |
| Login über Keycloak (OIDC) | MVP mit Testkonten; BayernID und Behörden-Login werden später in Keycloak angebunden, ohne Änderungen am Anwendungscode |
| Rechte, Dokument-Sichtbarkeit und Pseudonymisierung im Backend | Im Klickdummy steuert das Frontend die Sichtbarkeit – im echten System darf nur der Server entscheiden |
| Externe Dienste hinter Adaptern (ÖPNV, Schuldaten) | Jetzt simuliert, später echte Schnittstelle, ohne Fachlogik anzufassen |

## Etappen

0. Projektgrundgerüst (dieses Repo, CI, lokale Infrastruktur)
1. Fachmodell und API-Vertrag; Schuldaten und Fahrzeit aus den Klickdummies übernehmen
2. Durchstich Antragstellende: Formular → API → Datenbank, Upload, Status im Dashboard
3. Durchstich Bearbeitung: Übersicht, Vorgang, Stellungnahmen, Laufweg, Revisionsprotokoll
4. Login und Rollen (Keycloak), serverseitige Rechte und Pseudonymisierung
5. Bescheid-PDF, E-Mail-Benachrichtigungen, Fristen
6. Vorbereitung echter Daten: Hosting in deutscher Cloud, Datenschutz-Folgenabschätzung, Löschfristen, BayernID, echte Schnittstellen

## Datenschutz

Bis Etappe 6 werden **ausschließlich Testdaten** verarbeitet. Die Frontends liegen bis dahin auf GitHub Pages (US-Infrastruktur) – für echte personenbezogene Daten ist ein Umzug nötig.
