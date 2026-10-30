/*
 * THE CATEGORY A MEMBER WANTS IS KEPT PER SEASON, AND THE COLUMN THAT KEPT ONE FOR ALL OF THEM GOES.
 *
 * PDL, owner, 30.10.2026, in the answers to the questions of PR 664: „Hocu strukturalno ovo da resim,
 * zasto se kategorije ne cuvaju po sezoni vec sad?" Until today `competitor.first_season_2027` (V7) was
 * one boolean per member whose NAME carried a season, so it could hold the wish for 2027 and nothing
 * else: the debt the owner chose to record on 27.09.2026 („da zapises kao tehnicki dug da se ne
 * zaboravi i resi strukturalno nekad sto pre"), which became live the first day a second season is on
 * sale, 11 November 2027.
 *
 * WHAT IS KEPT IS THE WISH AND NOT THE CATEGORY. PDL P7, derived 26.09.2026 from the owner's word
 * „ZELI": „Ono što se čuva je ŽELJA, ne kategorija ... kategorija u kojoj se takmiči je izvedena: želja
 * i pravo." So a row here says what he ticked for one season, and the category he runs in is worked out
 * from it and from his right, every time it is asked (`CategoryOfASeason`). Nothing here is corrected
 * when a verification closes his right.
 *
 * A SEASON WITH NO ROW OF ITS OWN TAKES THE LAST ONE BEFORE IT. PDL, owner, 30.10.2026, „Izbor
 * kategorije za novu sezonu nasleđuje poslednji raniji izbor": „član koji za novu sezonu ne dodirne boks
 * ostaje u kategoriji koju je poslednji put izabrao, dok god ima pravo na nju". And the addition to the
 * decision of 27.09.2026 the same day: „Starosna je podrazumevana samo kad član nema nijedan raniji
 * izbor". That is a reading of these rows (the latest season not after the one asked), not a row
 * written for every season, so a wish written for 2029 can never change what 2028 reads.
 *
 * THE KEY IS THE MEMBER AND THE SEASON, AND IT GOES WITH HIM. V79 kept the rows of money a deleted
 * member leaves behind and said, of what does not stay, „Results, the profile, ducats, messages
 * addressed to him, pairs and teams go as before". A wish about a category is part of the profile and
 * no bookkeeping, so the cascade is the decision and not an oversight; the frozen category of a season
 * lives in `season_competitor.category` (V17), which loses only its pointer.
 */
create table category_wish (
    competitor_id bigint  not null,
    season        integer not null,

    /* True for the beginners' category, false for the one of his age (PDL P7: „Dve opcije su
       Starosna i Početnička"). */
    beginner      boolean not null,

    constraint category_wish_pk primary key (competitor_id, season),
    constraint category_wish_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete cascade,

    constraint category_wish_season_not_before_the_league check (season >= 2027)
);

/*
 * EVERY MEMBER'S WISH BECOMES HIS WISH FOR 2027, the first season of the league and the only one the
 * column ever meant (there is no season before it, PDL P2). It is written for EVERY member, whatever
 * memberships he holds: by the inheritance above the row for 2027 is what each later season reads
 * until he ticks the box again, so a member who has already paid for 2028 keeps exactly the choice he
 * had. A false is written too: it says „he chose the age category" and not „he chose nothing", which
 * is what the column said.
 */
insert into category_wish (competitor_id, season, beginner)
select id, 2027, first_season_2027
from competitor;

alter table competitor drop column first_season_2027;
