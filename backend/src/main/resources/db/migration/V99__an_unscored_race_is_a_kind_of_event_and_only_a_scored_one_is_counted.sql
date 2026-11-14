/*
 * AN UNSCORED RACE IS A FOURTH KIND OF EVENT, AND WHAT THE LEAGUE COUNTS IS READ FROM ONE PLACE THAT ASKS
 * THE KIND.
 *
 * Owner, PDL, 14.11.2026, "Ostale discipline kao lična evidencija", fourth addition: "Polje „Vrsta
 * događaja” dobija četiri vrednosti umesto tri (do tada Trka, Trening, Skup): Bodovana trka
 * (podrazumevano; to je dosadašnja „Trka”), Nebodovana trka, Trening, Skup." So `race` keeps its name and
 * is the scored race, and the new value is `unscored`. The kind is the event's and only the event's: "Vrsta
 * se bira samo za ceo događaj; sve trke događaja su iste vrste" (third addition, same day), which is why
 * nothing here touches `race`.
 *
 * WHAT A RESULT OF AN UNSCORED RACE IS: derived in the record the same day from the decision that the
 * running leg of a triathlon is no longer scored, "Rezultat ostale discipline nema bodove i ne ulazi ni u
 * šta što liga računa (tabele, rang liste, kategorije, zbir tima i para, dukati, bedž sa brojem trka, Top
 * liste, Zagrevanje)", and the shape the record writes down as technique (my reasoning, in PDL): "svi
 * brojači na serveru čitaju iz jednog mesta koje pita vrstu događaja".
 *
 * THAT ONE PLACE IS `scored_race`: the races whose event is of the kind `race`, and nothing else. Every
 * count the server makes of results joins it (`join scored_race s on s.id = r.race_id`), and the route
 * that serves the runs of unscored races joins `unscored_race`, which is every race `scored_race` does not
 * hold, read off it rather than asking the kind a second time. So the two cannot overlap and cannot both
 * miss a race. A race under a training or a gathering cannot exist (the routes that write races refuse
 * it), and if one ever did it would land in `unscored_race`, which counts nothing - the safe side.
 *
 * BOTH VIEWS CARRY ONLY THE KEY OF THE RACE, and that is measured and not a taste. The first draft held
 * `result.*` behind a view `scored_result`, and PostgreSQL then refused `alter table result drop column
 * category` in `ResultsCarriedOverTest`, because a view over `r.*` depends on every column of `result`.
 * These two depend on `race.id`, `race.event_id`, `btl_event.id` and `btl_event.kind` and on nothing of
 * `result` at all, so a later change to `result` does not have to know they exist.
 *
 * NOTHING ALREADY STANDING CHANGES. Every event is `race`, `training` or `gathering` today and keeps it, the
 * constraint only widens, no row of `result` is written, and the frozen tables (V17, V84) are not read or
 * touched: a frozen table is a constant (PDL) and the snapshot of a season is what it was. So every answer
 * the portal gives about points is the same before this file and after it, which is what the owner asked
 * to be measured on production (PDL, 14.11.2026, "Uz korak 1 ide provera na produkciji: odgovori svih
 * javnih ruta sa obračunima pre i posle podizanja moraju biti isti, jer nebodovanih rezultata još nema").
 * `UnscoredKindCarriedOverTest` runs this file over rows of all three earlier kinds and measures that the
 * sum of `result.points`, and every row of `result` and `btl_event`, is what it was.
 */
alter table btl_event drop constraint btl_event_kind_known;

alter table btl_event
    add constraint btl_event_kind_known check (kind in ('race', 'unscored', 'training', 'gathering'));

create view scored_race as
    select ra.id
    from race ra
    join btl_event e on e.id = ra.event_id
    where e.kind = 'race';

create view unscored_race as
    select ra.id
    from race ra
    where ra.id not in (select s.id from scored_race s);
