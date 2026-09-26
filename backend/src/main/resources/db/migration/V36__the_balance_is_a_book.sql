/*
 * THE BALANCE IS A BOOK, AND THE BALANCE IS THE SUM OF THE BOOK.
 *
 * ADL, `Virtuelni balans`: "Program preporuke stvara stanje ... na nalogu člana. To je obaveza
 * udruženja, NE BROJ U KOLONI: traži knjigu promena (ko, kada, koliko, iz kog razloga),
 * nepromenljive stavke, i saldo koji se uvek IZVODI IZ KNJIGE, nikad ne upisuje direktno."
 * ADL's audit trail is exactly three things and this is one of them, with the sentence "Ko
 * projektuje šemu ne sme da doda četvrto ni da izostavi jedno od ovo troje." So the table below
 * is not a convenience for a feature; it is one of the three records the schema was told to
 * carry, and it arrives now because PDL 14.08.2026 parked it on the database ("Knjiga promena
 * balansa čeka bazu, faza F5") and the database is here.
 *
 * WHY A BOOK AND NOT A COLUMN, SAID ONCE SO NOBODY ADDS THE COLUMN LATER. PDL 13.08.2026 says
 * "Balans se računa, ne pamti se kao broj", and until today that was read as "count who he
 * brought in and multiply". Counting answers what he EARNED. It cannot answer what he SPENT,
 * because spending would have to un-count a referral that happened. The moment the owner
 * decided (26.09.2026) that the balance comes off the invoice, the count stopped being enough
 * and the book became the only shape that holds both halves. The two decisions do not
 * disagree: neither of them lets a total be stored, and neither of them is contradicted by a
 * ledger whose entries are facts and whose total is always a sum.
 *
 * EVERY ENTRY CARRIES BOTH CURRENCIES AND NOTHING HERE EVER CONVERTS. ADL: "Dve valute su dva
 * zasebna cenovnika, ne jedan sa konverzijom". `price_row` publishes both numbers on one row
 * (V4: the referral is 5 and 600, the early period 35 and 4200), so an entry copies the pair
 * off the row that earned or spent it and no rate is ever applied to anything. That the seeded
 * list happens to satisfy 120 to the euro is TRUE TODAY AND NOT RELIED ON: `PUT
 * /api/pricing/{key}` can edit one column without the other, and an entry written before such
 * an edit keeps the pair it was written with, which is what "nepromenljive stavke" means.
 *
 * WHAT IS DELIBERATELY NOT HERE:
 *
 *   - No total anywhere, on any table. The balance is `sum(eur)`, `sum(rsd)` over a member's
 *     entries and there is no second place it could be read from, which is the whole point of
 *     ADL's "saldo koji se uvek izvodi iz knjige".
 *   - No entry for a membership the association gave away free. `feeExempt` owes nothing, so
 *     there is nothing to take off his invoice, and his balance is left standing for a season
 *     in which he is no longer exempt. DERIVED, not decided, and from PDL 11.08.2026: "Balans
 *     ne propada nikad i prenosi se iz sezone u sezonu."
 *   - No reset entry, although ADL names one ("Reset na nulu pri isteku članstva se knjiži kao
 *     stavka u knjizi"). That sentence stands from before 11.08.2026, when the owner STRUCK
 *     resetting altogether: PDL marks it [UKINUTO] and says the balance never perishes. A
 *     reason nothing can produce is a reason no constraint should name, so `reason` lists two
 *     and not three.
 */

/* ---------------------------------------------------------------------------------------------
 * THE BOOK
 * ------------------------------------------------------------------------------------------ */

create table balance_entry (
    id                     bigserial,

    /* WHOSE balance this moves. Not who caused it - that is `recorded_by` - and not who was
       brought in, which is `referred_competitor_id`. Three different people can stand on one
       row and the names are kept apart on purpose: the referrer earns, the moderator records,
       the newcomer is the reason. */
    competitor_id          bigint        not null,

    /* HOW MUCH, as the pair the price list published. Positive earns, negative spends, and
       which of the two is a row allowed to be is said by `reason` below rather than left to
       whoever writes the insert. */
    eur                    numeric(10,2) not null,
    rsd                    numeric(10,2) not null,

    /* WHY. ADL asks for "iz kog razloga" in those words. Two reasons and not more: the portal
       can only put money on a balance by a referral being activated, and can only take it off
       by a membership standing on it. */
    reason                 text          not null,

    /* The member whose activation earned it, for a referral and never otherwise. It is here
       rather than derivable because the rule it carries is ONCE PER PERSON BROUGHT IN, not
       once per season he stays: `balance_entry_one_a_referral` is that rule, and without this
       column the rule has nowhere to live. PDL: "Svaki član koji se registruje preko tog linka
       donosi preporučiocu 600 RSD", one member one reward, however many seasons he then pays
       for. */
    referred_competitor_id bigint,

    /* The season whose membership spent it, for a spend and never otherwise. No foreign key
       into `membership`: that table now names the entry it stands on (below), and two tables
       naming each other cannot both be inserted. The pair (competitor, season) already
       identifies the membership by `membership_pk` and the payment by `payment_one_a_season`,
       so the join exists without a cycle. */
    season                 integer,

    /* WHEN, from the portal's own clock and never from a form. */
    occurred_at            timestamptz   not null,

    /* WHO did it. The moderator who recognised the payment that activated the newcomer, or the
       member himself when he spends his own balance.

       NULLABLE, and not by accident: the key is `on delete set null` below, exactly as
       `payment_recorded_by_fk` (V16) is, and a column declared NOT NULL cannot be set to null
       by a cascade - so NOT NULL here would make deleting an account fail instead of forgetting
       it. The answer to ADL's "ko" survives in the frozen name beside it. */
    recorded_by            bigint,

    /* And his name frozen beside the key, for the reason V16 gives about `payment`: the key
       goes to NULL when an account is deleted and the book must still say who wrote the line.
       ADL asks for "ko", and a key that can become nothing does not answer it for ever. */
    recorded_by_name       text collate sr_latn not null,

    constraint balance_entry_pk primary key (id),

    /* The balance belongs to the person and dies with him. Same direction `membership_competitor_fk`
       (V22) takes for the rows that hang off a member: what survives a deleted member is the
       frozen season, and a liability of the association towards somebody who is gone is not a
       liability. */
    constraint balance_entry_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete cascade,

    /* But the CREDIT survives the person who caused it, which is V7's own decision about
       `competitor.referred_by` written out in full there: "A referral does. competitor.referred_by
       is ON DELETE SET NULL: the credit survives". Somebody who brought in a member who later
       left keeps what he earned; he did the thing he was paid for. */
    constraint balance_entry_referred_fk foreign key (referred_competitor_id) references competitor (id)
        on delete set null,

    /* The account may go; the row may not. */
    constraint balance_entry_recorded_by_fk foreign key (recorded_by) references account (id)
        on delete set null,

    constraint balance_entry_reason_known check (reason in ('referral', 'membership')),

    /* ONLY A REFERRAL EVER NAMES A MEMBER BROUGHT IN, so a spend cannot be half of both.

       THIS IS ONE DIRECTION AND NOT BOTH, and the reason is measured rather than tidy. The other
       direction - "a referral always names somebody" - is true when a line is WRITTEN and stops
       being true afterwards: `balance_entry_referred_fk` is ON DELETE SET NULL, because the man who
       brought somebody in earned his reward and deleting the newcomer must not take it back. Written
       as a check over both directions, deleting a member who had ever been brought in FAILED on this
       very constraint, which is the privacy promise PDL P23 makes broken by a rule about bookkeeping.
       So the half that is about writing a line is enforced where writing happens, by
       `balance_entry_says_who_earned_it` below.

       WHAT IS LOST WITH THE NEWCOMER, said out loud: once his row is gone the line no longer says
       who it was for, so `balance_entry_one_a_referral` can no longer stop the same human earning a
       second reward if he registers again. There is nothing left to recognise him by, and inventing
       one would mean keeping a deleted member's identity, which is the thing P23 forbids. */
    constraint balance_entry_only_a_referral_names_a_member
        check (referred_competitor_id is null or reason = 'referral'),

    /* And a spend always names the season it went to, in both directions: nothing ever nulls this
       column, so there is no moment at which half of it stops being true. */
    constraint balance_entry_membership_names_the_season
        check ((reason = 'membership') = (season is not null)),

    /* WHICH WAY EACH REASON IS ALLOWED TO MOVE THE BALANCE, and it is a constraint rather than
       a habit because a referral written negative would silently rob the member who earned it
       and nothing else in the schema would notice. Zero is refused in both directions: an entry
       that moves nothing is not a fact about money, and a spend of zero is what a member with
       an empty balance would write if the caller forgot to ask whether he had any. */
    constraint balance_entry_a_referral_adds
        check (reason <> 'referral' or (eur > 0 and rsd > 0)),

    constraint balance_entry_a_membership_takes
        check (reason <> 'membership' or (eur < 0 and rsd < 0)),

    /* ONE REWARD PER PERSON BROUGHT IN, said by the schema and not by the service that writes
       it. Postgres lets any number of NULLs through a unique index, so this binds the referral
       rows and leaves the spends alone without a partial index. Two moderators recognising two
       payments for the same newcomer at the same instant lose to this rather than paying the
       referrer twice. */
    constraint balance_entry_one_a_referral unique (referred_competitor_id),

    /* Nobody is his own reason. Same sentence `competitor_not_referred_by_itself` (V7) says
       about the column this one mirrors. */
    constraint balance_entry_not_referred_by_itself
        check (referred_competitor_id is null or referred_competitor_id <> competitor_id),

    constraint balance_entry_recorded_by_name_not_blank check (btrim(recorded_by_name) <> ''),

    /* The league's first season, the same floor `payment_season_not_before_the_league` (V16)
       puts under a payment. */
    constraint balance_entry_season_not_before_the_league check (season is null or season >= 2027)
);

/* The one question this table is asked in anger: what is this member's balance. */
create index balance_entry_competitor_idx on balance_entry (competitor_id);

comment on table balance_entry is
    'The book of balance changes (ADL, virtuelni balans): every movement as its own immutable row, and the balance itself is always the sum of them and never a stored number.';

/* ---------------------------------------------------------------------------------------------
 * WHAT A PAYMENT CODE PROMISED, WHICH IS NOT A MOVEMENT AND THEREFORE NOT AN ENTRY
 * ------------------------------------------------------------------------------------------ */

/*
 * Owner, 27.09.2026, on the one case the decision of the day before did not reach: a member mints a
 * code for 3.600 (4.200 less a balance of 600), then a seventh referral of his is activated and his
 * balance becomes 1.200, and only then does the 3.600 arrive. HE CHOSE: „skida se ono sto je kod
 * obecao, ne ono sto balans stoji na dan knjizenja." So 600 comes off and 600 stays for next year.
 *
 * TWO OUTCOMES WERE REFUSED, each with its cost stated: taking today's balance (the association's
 * liability would fall by 1.200 against a discount of 600, so it loses quietly on every such case),
 * and refusing the booking and asking for a fresh code (a member who paid exactly what he was told
 * gets a rejection because of something a THIRD person did).
 *
 * WHY THIS IS A TABLE OF ITS OWN AND NOT A THIRD `reason` IN THE BOOK. A promise is not money
 * moving: the owner refused deducting at minting on 26.09.2026 and that decision stands, so the
 * balance after minting is still the whole balance. Were a promise a row in `balance_entry`, every
 * reader of the book would have to remember to leave it out of the sum, and ADL's „saldo koji se
 * uvek izvodi iz knjige" would stop being a plain sum of a table and become a plain sum of a table
 * minus one kind of row. The book stays movements only, and what a code said is a fact beside it.
 *
 * AND IT IS ONE ROW PER MEMBER PER SEASON, REWRITTEN RATHER THAN ADDED TO. This is what settles the
 * boundary PDL 26.09.2026 left open in the words „dva koda kovana istog dana obecavaju isti novac
 * dvaput": a second code for the same season REPLACES the first, because the member is looking at
 * one screen showing one amount and that amount is what he will pay. The key is therefore
 * (competitor, season) and the write is an upsert - which is also why this table carries no
 * immutability trigger, unlike the book: the book records what HAPPENED and may never be edited,
 * while this records what the CURRENT code says and is meant to be overwritten.
 *
 * WHAT REMAINS OPEN, and it needs two seasons rather than two codes: a promise for season S and a
 * promise for S+1 can both stand, because minting one does not spend anything - and the booking
 * that comes second may find the balance already gone. Measured rather than argued: within ONE
 * season this cannot happen, because `payment_one_a_season` (V16) allows one payment and the season
 * is fixed by the day the money is booked (`SeasonClock.seasonBeingPaidFor`, never a form), so two
 * codes minted on one day necessarily name one season and at most one of them can ever be paid.
 * Crossing 1 October is the case that is left, and what the portal does there is take what is
 * actually in the book rather than go negative.
 */

create table balance_promise (
    /* WHOSE code, and FOR WHAT. The pair is the key because a member has at most one live code per
       season by construction: there is one screen and it shows one amount. */
    competitor_id bigint        not null,
    season        integer       not null,

    /* HOW MUCH THAT CODE SAID HIS BALANCE WOULD COVER, both currencies, off the same price row the
       invoice was built from. Never negative and allowed to be zero: a member with an empty book is
       promised nothing, and „nothing" is an honest answer to record rather than an absent row that
       a reader has to guess about. */
    eur           numeric(10,2) not null,
    rsd           numeric(10,2) not null,

    /* WHEN the code was last minted, so that a promise can be told apart from an older one in any
       question anybody asks later about why a booking took what it took. */
    promised_at   timestamptz   not null,

    constraint balance_promise_pk primary key (competitor_id, season),

    constraint balance_promise_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete cascade,

    constraint balance_promise_not_negative check (eur >= 0 and rsd >= 0),

    constraint balance_promise_season_not_before_the_league check (season >= 2027)
);

comment on table balance_promise is
    'What the payment code currently shown to a member says his balance will cover, per season. Not a movement and not part of the balance: the balance falls only when a payment is booked (owner, 26.09.2026), and then by exactly what this row says (owner, 27.09.2026).';

/* ---------------------------------------------------------------------------------------------
 * AND THE ENTRIES ARE IMMUTABLE, WHICH IS A WORD IN ADL AND THEREFORE A TRIGGER HERE
 * ------------------------------------------------------------------------------------------ */

/*
 * ADL says "nepromenljive stavke" and a table that merely intends it is a table that will be
 * amended by the first well meant `update`. There is no `no update` in SQL, so the refusal is
 * written as the thing PostgreSQL does have.
 *
 * DELETE IS NOT REFUSED, and that is a decision rather than an omission. The only deletion that
 * can reach a row here is the cascade from a deleted member, which is the privacy promise PDL
 * P23 makes and which V17 and V33 already carry out on his name. "Immutable" is about nobody
 * rewriting what a line says; a member exercising his right to be gone is not a rewrite of his
 * book, it is the removal of the person the book was about. Were DELETE refused too, deleting a
 * member would fail outright and the promise would be the thing that broke.
 *
 * AND NEITHER IS A KEY BEING FORGOTTEN, WHICH IS NOT AN AMENDMENT. Measured rather than reasoned
 * about, and it is why this function is not one `raise`: `balance_entry_referred_fk` and
 * `balance_entry_recorded_by_fk` are both ON DELETE SET NULL, and a cascade that sets a column to
 * null arrives here as an UPDATE. A blanket refusal therefore made `delete from competitor` FAIL
 * for anybody who had ever been brought in - the exact promise the paragraph above is about, broken
 * by the trigger meant to protect the line. So the two keys the schema is allowed to forget may go
 * to null, and nothing else may move at all.
 *
 * THE COMPARISON NAMES NO COLUMN EXCEPT THOSE TWO, on purpose. `to_jsonb(new)` against
 * `to_jsonb(old)` asks PostgreSQL what the row is rather than listing what the row has, so a column
 * added to this table tomorrow is protected the day it arrives and not the day somebody remembers
 * to add it here. The two exceptions are named because they ARE the exception.
 */
create function a_balance_entry_is_written_once() returns trigger
    language plpgsql
as $body$
begin
    /* Everything but the two forgettable keys, compared as the whole row. */
    if (to_jsonb(new) - 'referred_competitor_id' - 'recorded_by')
        is distinct from (to_jsonb(old) - 'referred_competitor_id' - 'recorded_by') then
        raise exception using
            errcode = '23514',
            message = tg_name || ': balance entry ' || old.id || ' cannot be changed once written',
            hint = 'ADL, virtuelni balans: nepromenljive stavke. Write a new entry instead.';
    end if;

    /* And those two may only ever be forgotten, never pointed somewhere else. */
    if (new.referred_competitor_id is not null
            and new.referred_competitor_id is distinct from old.referred_competitor_id)
        or (new.recorded_by is not null and new.recorded_by is distinct from old.recorded_by) then
        raise exception using
            errcode = '23514',
            message = tg_name || ': balance entry ' || old.id
                || ' cannot be made to name somebody else',
            hint = 'A key on a written line may be forgotten when a row goes, never re-pointed.';
    end if;

    return new;
end;
$body$;

create trigger balance_entry_is_written_once
    before update on balance_entry
    for each row
execute function a_balance_entry_is_written_once();

/*
 * AND A REWARD NAMES THE PERSON IT WAS EARNED FOR, AT THE MOMENT IT IS WRITTEN.
 *
 * This is the half of `balance_entry_only_a_referral_names_a_member` that a CHECK cannot hold, and
 * the note on that constraint says why: a check is true for the whole life of a row, and this one
 * stops being true the day the newcomer is deleted. Written as a trigger on INSERT alone it says
 * exactly what is meant - a line is written naming somebody - and says nothing about afterwards.
 *
 * It matters more than it looks: `balance_entry_one_a_referral` is a unique key over that column, so
 * a caller able to write rewards that name nobody could pay one referrer any number of times and the
 * once-per-person rule would refuse none of them.
 */
create function a_reward_says_who_earned_it() returns trigger
    language plpgsql
as $body$
begin
    if new.reason = 'referral' and new.referred_competitor_id is null then
        raise exception using
            errcode = '23514',
            message = tg_name || ': a reward has to name the member brought in',
            hint = 'PDL: the reward is for bringing one person in, and the line says which one.';
    end if;

    return new;
end;
$body$;

create trigger balance_entry_says_who_earned_it
    before insert on balance_entry
    for each row
execute function a_reward_says_who_earned_it();

/* ---------------------------------------------------------------------------------------------
 * A MEMBERSHIP MAY NOW STAND ON THE BOOK
 * ------------------------------------------------------------------------------------------ */

/*
 * The owner, 26.09.2026: "Balans veci ili jednak clanarini: QR koda nema, clanstvo se aktivira
 * iz balansa, a visak ostaje za sledecu godinu." That is a THIRD way to become a member, and
 * V22 knew two.
 *
 * WHAT THIS CHANGES IN A DECISION THAT WAS ALREADY WRITTEN, said out loud because the sentence
 * is still in ADL as this migration is applied. ADL, `Osnov članstva, ne samo status`, read:
 * "Član se aktivira na dva načina ... aktivacija nosi polje osnova i vezu ka uplati koja sme
 * biti prazna samo kad je osnov počasni. Bez toga se u knjigovodstvu i u izveštaju o naplati
 * pojavljuje 31 član bez uplate i nema načina da se objasni." The FEAR in that sentence is a
 * member with no trace, not a member with no payment - and a member activated from his balance
 * has a trace, in the book, naming the amount and the day and the person. So the third basis
 * arrives with its evidence column beside it, and the shape of the old rule is kept exactly:
 * every basis names the thing it stands on, and only the honorary one names nothing.
 */

alter table membership
    add column balance_entry_id bigint;

comment on column membership.balance_entry_id is
    'The entry in the book of balance that paid for this season, and empty exactly when the basis is not `balance`.';

alter table membership
    drop constraint membership_basis_known;

alter table membership
    add constraint membership_basis_known check (basis in ('payment', 'feeExempt', 'balance'));

alter table membership
    add constraint membership_balance_entry_fk foreign key (balance_entry_id)
        references balance_entry (id) on delete cascade;

/* The same shape `membership_basis_says_whether_a_payment_is_named` (V22) has, for the same
   reason it gives: the basis and the evidence are one fact said twice, and a row where they
   disagree is a row nothing can be refused by. V22's own constraint needs no change - for
   `balance` it reads false = false and is satisfied - which is measured rather than assumed and
   is what `MembershipConstraintsTest` now asks of it in both directions. */
alter table membership
    add constraint membership_basis_says_whether_a_book_entry_is_named
        check ((basis = 'balance') = (balance_entry_id is not null));

/* ---------------------------------------------------------------------------------------------
 * AND WHAT IS ALREADY OWED IS WRITTEN INTO THE BOOK NOW, ONCE
 * ------------------------------------------------------------------------------------------ */

/*
 * Every referral that has already earned its reward earned it under the rule PDL states, and
 * the book has to open with those lines in it or the first member to read his balance would see
 * zero where he saw a number yesterday.
 *
 * WHAT DECIDES THAT A REFERRAL HAS EARNED: the member brought in HAS A MEMBERSHIP, on any basis
 * and in any season. PDL 13.08.2026 in the owner's own words - "OK je da se za preporuku dobije
 * balans čak i ako je preporučen član dobio počasnu aktivaciju" - so the condition is activation
 * and nothing about money. `membership` is the table that answers "was he ever a member", which
 * is exactly what V22 was made for; `competitor.active` answers only "now" (V22 says so in its
 * own comment) and a balance that never perishes cannot be read off a fact that lapses.
 *
 * ONE ROW PER MEMBER BROUGHT IN, not per season he stayed, which `distinct` says here and
 * `balance_entry_one_a_referral` enforces for ever after.
 *
 * THE AMOUNT COMES OFF THE REFERRAL ROW OF THE PRICE LIST as it stands today. An entry is
 * immutable from the moment it is written and this is the moment; there is no earlier price to
 * honour, because until today no line was ever written.
 *
 * AND WHO IS CREDITED WITH WRITING IT: the account that recognised the newcomer's earliest
 * payment, because that is the act that earned the reward and `payment` remembers both the key
 * and the name. Where the newcomer has a membership but no payment anybody recognised - the
 * honorary case, which V22 deliberately left unseeded and which nothing writes yet - there is
 * no such account, and the `join` below drops him rather than inventing one. That leaves a
 * referral of an honorary member unrewarded by THIS migration and rewarded by the route that
 * grants the honour, the day it is built; inventing an account here would put a name in an
 * immutable book that never did the thing.
 */
insert into balance_entry (competitor_id, eur, rsd, reason, referred_competitor_id,
                           occurred_at, recorded_by, recorded_by_name)
select distinct on (brought.id)
       brought.referred_by,
       reward.eur,
       reward.rsd,
       'referral',
       brought.id,
       p.recorded_at,
       p.recorded_by,
       p.recorded_by_name
from competitor brought
    join membership m on m.competitor_id = brought.id
    join payment p on p.competitor_id = brought.id and p.state = 'recorded'
    cross join (select eur, rsd from price_row where key = 'referral') reward
where brought.referred_by is not null
  and brought.referred_by <> brought.id
  and p.recorded_by is not null
order by brought.id, p.season;
