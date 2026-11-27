# BTL Portal

Portal Balkanske trkačke lige: kalendar trka, rezultati, BTL bodovi, rang liste i profili takmičara.

Produkcija: [balkanskatrkackaliga.net](https://balkanskatrkackaliga.net)

## Struktura

| Deo | Tehnologija |
|---|---|
| `backend/` | Java 21, Spring Boot, Spring Security, JPA, Flyway, Maven wrapper |
| `frontend/` | React 19, TypeScript, Vite, Vitest |
| `docker-compose.yml` | PostgreSQL 18 (+ ceo stack kroz `--profile full`) |

## Lokalni razvoj

```bash
cp .env.example .env   # pa postavi lozinke
docker compose up -d postgres
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local
cd frontend && npm install && npm run dev
```

Frontend: http://localhost:5173 (API pozivi se proksiraju na backend, port 8080).

## Testovi

```bash
cd backend && ./mvnw verify            # testovi + JaCoCo prag 100%
cd frontend && npm run test:coverage   # testovi + coverage prag 100%
```

Integracioni testovi koriste Testcontainers (potreban Docker).

## Produkcija

TLS i javno rutiranje drži zajednički edge proxy na hostu, van ovog repoa; odavde se isporučuje samo aplikacija. Postupak, ograničenja i kopija edge konfiguracije: [deploy/README.md](deploy/README.md).

```bash
ssh root@btl-prod
cd /opt/btl && git pull && cd deploy
docker compose -f compose.prod.yml up -d --build frontend
```

## Pravila

- `main` prima izmene samo kroz PR sa zelenim CI-jem.
- Šema baze se menja samo kroz Flyway migracije.
- Formula BTL bodova (od 26.11.2026): `103,34 × (Tref / Tsec)^4,25 × (Le / 10)^0,39`, `Le = L + (9×AP + 1×AN)/1000`, gde je `Tref` referentno vreme za dužinu `Le` (tabela u `BtlScoreCalculator`). Zlatni test set u `BtlScoreCalculatorTest` je izvor istine.
