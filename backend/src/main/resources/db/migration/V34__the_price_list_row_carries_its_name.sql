/*
 * A ROW OF THE PRICE LIST CARRIES ITS OWN NAME.
 *
 * THE DECISION, PDL P12b, 1, owner 25.09.2026: „Naziv perioda postaje kolona u bazi koju
 * administrator menja sam iz administracije." He chose it between the outcomes offered and
 * REFUSED the recommendation that the names stay text of the portal changed through a pull
 * request. What it completes is older and was half kept: „Periodi su stalni: redovi se ne
 * dodaju i ne brisu, menjaju se samo cene i NAZIVI PERIODA" (owner, 30.07.2026, PDL:827) -
 * and until today the portal could change a price and could not change a name, because
 * `price_row` had no column for one.
 *
 * WHEN, WHICH IS ITS OWN HALF OF THAT DECISION AND IS NOT BEING IGNORED HERE. PDL:8122 reads
 * „Kad: zajedno sa ekranom cenovnika, ne pre", with the reason written beside it: „dodavanje
 * kolone pre ekrana daje nazivu DVA DOMA dok ekran jos cita recnik." The owner settled on
 * 26.09.2026 that the moment is now, choosing that the backend goes first and the screen
 * follows, and the cost he was shown is the one that paragraph names: for as long as the
 * screen reads the dictionary, the name has two homes. What is done about it is not a
 * sentence - `TheRowNameHasOneHomeTest` holds the seven rows of this table against
 * `frontend/src/i18n/sr.json` and fails the day the two disagree IN THE REPOSITORY. The half
 * it cannot see is named at the foot of this file.
 *
 * WHAT THE SEVEN NAMES ARE AND WHERE EACH COMES FROM. Nothing here is written fresh.
 *
 *   early, regular, late, season, junior, referral
 *       Copied WORD FOR WORD out of `frontend/src/i18n/sr.json`, under `pricing.rows`, which
 *       is the only home those six have ever had and the text a visitor reads today under
 *       Clan 14 of the rulebook (`PriceTable`). Six names for seven rows, which is how the
 *       gap below was found in the first place.
 *
 *   processing
 *       „Taksa za obradu placanja", and it is NOT invented here either. The dictionary has no
 *       key for it - the fee is drawn as a NOTE on both screens that mention it and never as a
 *       row - so the name is taken from the place PDL:803 makes authoritative for the fee:
 *       „merodavan javni prikaz cena i takse je od tada Clan 14 Pravilnika", and that article
 *       calls it exactly this, twice (V24:532 and V24:542). The owner's own decision of
 *       03.08.2026 uses the same words (PDL:790). The short form „Taksa za obradu" also exists
 *       (PDL:8128) as the heading of the decision this file carries out; the longer one was
 *       taken because it is what the public text says.
 *
 * AND BECAUSE IT IS NOW A COLUMN, THE NAME IS NO LONGER WHAT THIS FILE SAYS IT IS. Every one
 * of the seven above is a STARTING value: `PUT /api/pricing/{key}` writes this column from
 * today, so a name the owner wants spelt differently is one request away and needs no
 * migration. That is the whole point of the decision and it is why choosing the fee's name
 * out of the rulebook is cheap rather than final.
 *
 * WHY THE COLUMN ARRIVES NULLABLE AND IS THEN MADE NOT NULL, WHICH IS THE MEASUREMENT AND NOT
 * A FORMALITY. V23 added two NOT NULL columns to `account` in one statement and could, for a
 * reason it wrote down: nothing inserts into that table. V4 inserts SEVEN rows into this one,
 * so the same statement here would refuse outright - „column label of relation price_row
 * contains null values". The road taken instead answers the question that matters: the column
 * arrives empty, each of the seven rows is named by its key, and `SET NOT NULL` is then what
 * ASKS whether any row was left out. An eighth row nobody mentioned, a key spelt wrong, a
 * name that never landed - each of them stops the migration and the server with it. A DEFAULT
 * would have done the opposite: it would have put a word that is nobody's name into the column
 * a public table draws, and nothing would have failed.
 *
 * NOT UNIQUE, AND THAT IS MY REASONING RATHER THAN ANY DECISION. `country_name_unique` is the
 * only unique name in this schema and a country's name is its identity in a codebook; `place`,
 * `team`, `league` and `ducat` all carry a name and none of them is unique. A price row is
 * identified by its KEY (`price_row_key_unique`, V4) and named for a reader, and two rows given
 * the same name by an administrator is an untidy table rather than a member charged the wrong
 * amount. If it is ever to be refused, the route is where that belongs, with a sentence an
 * administrator can act on.
 *
 * COLLATE sr_latn, the same as every other name in this schema (`country.name`, `place.name`,
 * `team.name`, `league.name`, `ducat.name`): these are Serbian words and „Cacak" sorts after
 * „Cvetovo" under anything untailored (V1, O21). Nothing orders the price list by its name
 * today - `sort_order` is the order somebody chose and `PricingApi` says so - and the collation
 * is here because it is a property of the column rather than of today's only query.
 */
alter table price_row
    add column label text collate sr_latn;


/* THE SIX OUT OF THE DICTIONARY AND THE SEVENTH OUT OF THE RULEBOOK. By key, because the key
   is what names a row (V4), and `id` is a bigserial nothing outside the portal sees. */
update price_row set label = '1. do 5. oktobra'            where key = 'early';
update price_row set label = '6. oktobra do 30. novembra'  where key = 'regular';
update price_row set label = '1. do 31. decembra'          where key = 'late';
update price_row set label = '1. januara do 30. septembra' where key = 'season';
update price_row set label = 'Uzrast do 14 godina'         where key = 'junior';
update price_row set label = 'Taksa za obradu plaćanja'    where key = 'processing';
update price_row set label = 'Preporuka novog člana'       where key = 'referral';


/* AND NOW THE QUESTION: IS THERE A ROW WITHOUT A NAME? This statement is the only thing that
   asks it, and it asks it of whatever the database actually holds rather than of the seven
   lines above. `price_row_label_not_blank` is the other half, and it is written in the shape
   `country_name_not_blank` and `account_first_name_not_blank` already use: NOT NULL alone
   would take a column of spaces, which draws as an empty cell and reads as a column nobody
   filled in. */
alter table price_row
    alter column label set not null;

alter table price_row
    add constraint price_row_label_not_blank check (btrim(label) <> '');


comment on column price_row.label is
    'What the row is called, in the words a reader sees. A column since V34 and no longer text '
        'of the portal: the owner decided on 25.09.2026 (PDL P12b) that the administration '
        'changes it, which completes his own sentence of 30.07.2026 that a price list changes '
        '"cene i nazivi perioda". The six period and level names came out of '
        'frontend/src/i18n/sr.json (pricing.rows); the fee had no name anywhere a screen could '
        'reach and took the one Clan 14 of the rulebook gives it (V24). BOUNDARY, until the '
        'pricing screen reads GET /api/pricing: a name changed through the route moves this '
        'column and does not move the bundled dictionary, so the page a visitor reads still '
        'shows the old one. TheRowNameHasOneHomeTest holds the two equal in the repository and '
        'cannot see them part at run time.';
