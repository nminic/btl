# BTL Portal

Portal Balkanske trkačke lige: kalendar trka, rezultati, BTL bodovi, rang liste i profili takmičara.

Produkcija: [balkanskatrkackaliga.net](https://balkanskatrkackaliga.net)

## Struktura

| Deo | Tehnologija |
|---|---|
| `backend/` | Java 21, Spring Boot, Spring Security, JPA, Flyway, Maven wrapper |
| `frontend/` | React 19, TypeScript, Vite, Vitest |
| `docker-compose.yml` | MySQL 8.4 (+ ceo stack kroz `--profile full`) |

## Lokalni razvoj

```bash
cp .env.example .env   # pa postavi lozinke
docker compose up -d mysql
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

## Pravila

- `main` prima izmene samo kroz PR sa zelenim CI-jem.
- Šema baze se menja samo kroz Flyway migracije.
- Formula BTL bodova: `(40 × Le)^3.257 / (2 × Tsec^2.137)`, `Le = L + (1.25×AP + 0.75×AN)/200`. Zlatni test set u `BtlScoreCalculatorTest` je izvor istine.
