# BTL Portal — pravila projekta

Portal Balkanske trkačke lige (btl). Monorepo: `backend/` (Java 21, Spring Boot, Maven wrapper), `frontend/` (React + TypeScript, Vite), `docker-compose.yml` (PostgreSQL 18).

## Komunikacija

- Sva komunikacija sa korisnikom je na srpskom jeziku, ali se tehnički elementi (nazivi klasa, polja, komandi) referenciraju na engleskom.
- SAV kod je isključivo na engleskom: nazivi promenljivih, polja, metoda, komentari, poruke izuzetaka, commit poruke, nazivi testova. Jedini srpski u kodu su UI tekstovi vidljivi posetiocima sajta.
- Nikad ne koristiti em-dash (—) u tekstu za korisnika; u krajnjem slučaju n-dash (–).

## Rad bez prekida (obavezno, iznad svega ostalog)

- **Nikad ne stajati.** Rad se ne prekida ni kad stigne pitanje, ni kad je celina
  gotova, ni na kraju izveštaja.
- **Kad vlasnik nešto pita:** odgovoriti kratko i **istog trenutka nastaviti** ono
  na čemu se radilo, u istoj poruci. Odgovor nije kraj rada nego prekid od par
  redova.
- **Izveštavanje:** javljati posle svake gotove celine, kratko i konkretno. Nikad
  ne pisati „SLEDEĆE:" i stati. Piše se **„POČINJEM:"** i tog trenutka se počinje,
  u istoj poruci.
- **Jedino što zaustavlja rad** je izričito „stani" od vlasnika, ili pitanje na
  koje se bez njegovog odgovora ne može dalje. U drugom slučaju se pitanje postavi
  i **odmah nastavi sa onim delom posla koji od tog odgovora ne zavisi**.

## Odluke (izvor istine, pročitati pre rada)

Sve tehničke i produktne odluke žive van repoa, u dva dnevnika odluka koji moraju biti međusobno usklađeni:

- `../btl-produkt/ADL.md` — arhitektura i tehnika: stack, server, edge proxy, deploy, keširanje, bezbednost, analitika, frontend standardi.
- `../btl-produkt/PDL.md` — produkt: pravila lige, formula bodovanja, kategorije, članstvo, rang liste, obim izrade. Stavke nose oznake [ODLUKA] / [NASLEĐENO] / [OTVORENO] / [UKINUTO].

Ništa se ne predlaže ni ne odlučuje u sukobu sa tim fajlovima, a svaka nova odluka se u njih upisuje istog trenutka. Oni su namerno van git repoa jer sadrže operativne detalje servera, a repo je javan.

## Domen (izvor istine)

- Pravila lige: Pravilnik BTL 2017 (domenski kontekst; periodične trke se NE koriste).
- Formula bodova: `BTL = (40 × Le)^3.257 / (2 × Tsec^2.137)`, `Le = L + (1.25×AP + 0.75×AN)/200`. L u km, AP/AN u metrima (AN pozitivan broj), Tsec u sekundama, prikaz na 2 decimale. Stepen 2.137 ide SAMO na Tsec. Implementacija: `backend/src/main/java/com/btl/portal/domain/scoring/BtlScoreCalculator.java`. Zlatni test set u `BtlScoreCalculatorTest` je NEPRIKOSNOVEN: ne menjati očekivane vrednosti.

## Bezbednost (obavezno)

- Nikad kredencijali, tajne ili tokeni u kodu ili commitima; sve kroz env varijable (`.env` je gitignorisan, `.env.example` bez pravih vrednosti).
- Svaki novi endpoint mora imati definisana pravila autorizacije i test autorizacije (401/403 slučajevi).
- Sav korisnički unos se validira na backendu (Bean Validation); upiti isključivo kroz JPA/parametrizovane upite.
- Lozinke: BCrypt/Argon2. Tokeni: httpOnly kolačići, nikad localStorage.

## UI standardi (obavezno za svaku stranicu i komponentu)

- Potpuna responsivnost: mobile-first CSS; ispravan prikaz na mobilnom (od 360px širine), tabletu i desktopu; bez horizontalnog skrola. Svaka UI izmena se verifikuje na sve tri širine ekrana pre PR-a.
- Pristupačnost po WCAG 2.2 AA kao minimum: semantički HTML i landmark elementi, potpuna tastaturna navigacija sa vidljivim fokusom, kontrast teksta najmanje 4.5:1, alt tekstovi na slikama, labele na svim poljima forme, ARIA samo tamo gde semantika nije dovoljna, poštovanje prefers-reduced-motion. Testovi komponenti koriste role/label upite, ne CSS selektore.

## Testiranje i kvalitet

- Coverage prag je 100% (JaCoCo BUNDLE line+branch; Vitest thresholds). Build PADA ispod 100%. Izuzeci od pokrivenosti se dodaju samo uz obrazloženje u PR-u (tipično: čisti config/bootstrap).
- Integracioni testovi idu protiv prave PostgreSQL baze kroz Testcontainers (nikad H2).
- Šema baze se menja isključivo kroz Flyway migracije (`backend/src/main/resources/db/migration`), nikad ručno.

## Komande

- Backend: `cd backend && ./mvnw verify` (build + testovi + coverage prag)
- Frontend: `cd frontend && npm run test:coverage && npm run lint && npm run build`
- Lokalna baza: `docker compose up -d postgres` (traži `.env`, kopiraj iz `.env.example`)
- Ceo stack u kontejnerima: `docker compose --profile full up --build`
- Backend lokalno protiv compose baze: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local`
- Produkcijski deploy: `cd /opt/btl/deploy && docker compose -f compose.prod.yml up -d --build frontend` na hostu. Portove 80/443 drži zajednički edge proxy van ovog repoa; nikad ne dodavati servis koji ih zauzima i nikad ne pokretati `docker compose down` nad tim projektom. Detalji: `deploy/README.md`.

## Proces

- `main` grana prima izmene isključivo kroz PR sa zelenim CI (`.github/workflows/verify.yml`).
- Pre svakog PR-a: pokrenuti oba test paketa lokalno i /code-review prolaz.
- OBAVEZNO pre merge-a netrivijalnog PR-a: nezavisna recenzija kroz subagenta koji NIJE pisao kod. Recenzent dobija isključivo diff i opis PR-a (svež kontekst, bez konteksta autora) i vraća nalaze; kritični i visoki nalazi blokiraju merge dok se ne razreše. Za bezbednosno osetljive izmene (auth, podaci, upload) dodatno i security-reviewer agent.
