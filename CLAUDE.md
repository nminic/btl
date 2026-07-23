# BTL Portal — pravila projekta

Portal Balkanske trkačke lige (btl). Monorepo: `backend/` (Java 21, Spring Boot, Maven wrapper), `frontend/` (React + TypeScript, Vite), `docker-compose.yml` (MySQL 8.4).

## Komunikacija

- Sva komunikacija sa korisnikom je na srpskom jeziku. Kod, imena i komentari u kodu su na engleskom, osim domenskih termina (BTL bodovi, kategorije) gde je srpski naziv precizniji.
- Nikad ne koristiti em-dash (—) u tekstu za korisnika; u krajnjem slučaju n-dash (–).

## Domen (izvor istine)

- Pravila lige: Pravilnik BTL 2017 (domenski kontekst; periodične trke se NE koriste).
- Formula bodova: `BTL = (40 × Le)^3.257 / (2 × Tsec^2.137)`, `Le = L + (1.25×AP + 0.75×AN)/200`. L u km, AP/AN u metrima (AN pozitivan broj), Tsec u sekundama, prikaz na 2 decimale. Stepen 2.137 ide SAMO na Tsec. Implementacija: `backend/src/main/java/com/btl/portal/domain/scoring/BtlScoreCalculator.java`. Zlatni test set u `BtlScoreCalculatorTest` je NEPRIKOSNOVEN: ne menjati očekivane vrednosti.

## Bezbednost (obavezno)

- Nikad kredencijali, tajne ili tokeni u kodu ili commitima; sve kroz env varijable (`.env` je gitignorisan, `.env.example` bez pravih vrednosti).
- Svaki novi endpoint mora imati definisana pravila autorizacije i test autorizacije (401/403 slučajevi).
- Sav korisnički unos se validira na backendu (Bean Validation); upiti isključivo kroz JPA/parametrizovane upite.
- Lozinke: BCrypt/Argon2. Tokeni: httpOnly kolačići, nikad localStorage.

## Testiranje i kvalitet

- Coverage prag je 100% (JaCoCo BUNDLE line+branch; Vitest thresholds). Build PADA ispod 100%. Izuzeci od pokrivenosti se dodaju samo uz obrazloženje u PR-u (tipično: čisti config/bootstrap).
- Integracioni testovi idu protiv prave MySQL baze kroz Testcontainers (nikad H2).
- Šema baze se menja isključivo kroz Flyway migracije (`backend/src/main/resources/db/migration`), nikad ručno.

## Komande

- Backend: `cd backend && ./mvnw verify` (build + testovi + coverage prag)
- Frontend: `cd frontend && npm run test:coverage && npm run lint && npm run build`
- Lokalna baza: `docker compose up -d mysql` (traži `.env`, kopiraj iz `.env.example`)
- Ceo stack u kontejnerima: `docker compose --profile full up --build`
- Backend lokalno protiv compose baze: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local`

## Proces

- `main` grana prima izmene isključivo kroz PR sa zelenim CI (`.github/workflows/verify.yml`).
- Pre svakog PR-a: pokrenuti oba test paketa lokalno i /code-review prolaz.
- OBAVEZNO pre merge-a netrivijalnog PR-a: nezavisna recenzija kroz subagenta koji NIJE pisao kod. Recenzent dobija isključivo diff i opis PR-a (svež kontekst, bez konteksta autora) i vraća nalaze; kritični i visoki nalazi blokiraju merge dok se ne razreše. Za bezbednosno osetljive izmene (auth, podaci, upload) dodatno i security-reviewer agent.
