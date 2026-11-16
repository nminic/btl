/*
 * WHEN THE SERVER LAST ASKED FACEBOOK ABOUT AN ADDRESS, so that the addresses Facebook keeps refusing do not stand at
 * the head of every run and keep the ones behind them from ever being asked.
 *
 * PDL P11, the entry „Profil ima deljivu sliku za društvene mreže (OG sliku)", item 16 (owner, 16.11.2026, chosen with
 * the assistant's recommendation): „Kad Facebook odbije ili ne odgovori, server pokušava ponovo: adresa se označava kao
 * osvežena tek kad Facebook prihvati zahtev, pa je sledeći prolaz pita ponovo." A run asks at most
 * `btl.facebook.per-pass` rows, ten by default, and until this file it took them in the order of the member number and
 * the address, so rows Facebook refuses for good at the head of that order were asked on every run and no row behind
 * them ever was (the review of PR 744, fourth round, measured it with one row a run over a hundred runs: the same
 * address every time). With `asked_at` a run takes first the rows it has never asked about, then the ones it asked
 * about longest ago, so a row that is refused goes behind the others and every row is asked in its turn, the refused
 * ones included, which item 16 still asks for.
 *
 * NOT A SECOND HOME OF „REFRESHED". A row is refreshed when its `card` is what its address serves, and only
 * Facebook's acceptance of a request writes `card` there (`FacebookIsAskedToReadAChangedCard`). `asked_at` says only
 * when a request about the row last went, accepted or not, and nothing reads it but the order of a run.
 *
 * EMPTY FOR EVERY ROW ALREADY STANDING, and for every row the crawler adds: such a row has not been asked about, so it
 * comes first, and among themselves the rows that have not been asked keep the order every row had until now.
 *
 * V103 says that no moment is kept because nothing the job or a deletion does reads one; the job reads this one from
 * here on. It goes with the member like the rest of the row, by the key V103 gives the table, so it keeps nothing of
 * a deleted member.
 */
alter table shared_card add column asked_at timestamptz;
