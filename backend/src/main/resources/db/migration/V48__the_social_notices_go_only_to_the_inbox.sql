/*
 * THE SIX SOCIAL NOTICES GO TO THE INBOX AND NOWHERE ELSE, SO THE SIX SWITCHES LEAVE.
 *
 * The owner, 29.09.2026 (PDL, „Drustvena obavestenja idu SAMO u sanduce portala, mejla
 * nema"): „Ako su ovo prekidaci, ja bih da se u potpunosti za njih izbace mailovi i da
 * funkcionise samo kao poruke u inbox portala."
 *
 * AND NO EXCEPTION, WHICH HE CHOSE BETWEEN NAMED OUTCOMES RATHER THAN BY DEFAULT. The team
 * invitation and the pair request carry a deadline, which was the case for keeping a mail
 * for those two, and he refused it with the price in front of him: a member who does not
 * sign in can let one run out without ever being told. That price is his, not this
 * migration's, and it is written here so the next reader does not read the absence of those
 * two as an oversight and put them back.
 *
 * WHAT THIS REPLACES IN P22, said rather than left to be found. P22 of 11.08.2026 read
 * „Zvono uvek, mejl podrazumevano ISKLJUCEN, clan ga sam pali: sve drustveno i sporedno".
 * The first half stands untouched - the bell still rings for all six, the portal inbox is
 * and remains the road these notices travel. The second half is what goes: there is no mail
 * to switch on, so there is no switch.
 *
 * THE SIX MANDATORY MAILS ARE NOT TOUCHED AND THERE ARE STILL SIX: the account confirmation,
 * the password change, the entered and the changed result, the extra request to check
 * something, and the large change to the portal. They never had a column here. V13 says why
 * in as many words - „The six mandatory mails have no switch and therefore no column. That
 * is the point: a column for them would be a promise the portal must refuse to keep." - and
 * that sentence is the reason this migration can drop the whole table without reading a
 * single mandatory mail's behaviour: none of them was ever asked about it.
 *
 * MEASURED, NOT ASSUMED, THAT NO MAIL EVER CONSULTED THESE COLUMNS. `Postman` is the only
 * class that sends, and it holds no `JdbcClient`, no `DataSource` and no statement of any
 * kind - it is handed an address and a text and posts them. The only SQL anywhere in
 * `backend/src/main/java` that names `notification_setting` or any of the six columns stood
 * in `NotificationApi` and `NotificationWriteApi`, the two routes this branch removes with
 * it; every other mention in the tree is a doc comment. So the switches governed nothing
 * that ran: not one of the six occasions had a mail to suppress in the first place, which
 * `WhatTheMessageSays.Message` and `WhatANoticeSays.Notice` say between them by holding only
 * the mandatory occasions. Dropping the table changes no mail that is sent today.
 *
 * AND THE TWO ROUTES GO WITH IT, which is the same decision and not a second one: „tabela
 * `notification_setting` i obe rute se uklanjaju novom migracijom". They were written
 * 18.09.2026 and no screen ever called either - measured, `me/notifications` has nought
 * hits in `frontend/src`. Code nobody calls is code somebody revives wrongly later.
 *
 * NOTHING POINTS AT THIS TABLE, so the order below is one statement and not three. Read out
 * of V13 rather than remembered: `notification_setting` holds one foreign key OUT, to
 * `competitor`, and no table in this schema holds one IN to it. A table dropped whole takes
 * its own primary key and its own foreign key with it, the same as `schedule_proposal` in
 * V31, and for the same reason nothing is named here one by one: neither
 * `notification_setting_pk` nor `notification_setting_competitor_fk` is reachable from
 * anywhere else in the schema.
 *
 * WHAT IS LOST, said plainly because a drop is not reversible. Whatever a member had turned
 * on. On QA and in production that is nothing at all: the routes that write this table were
 * never called by any screen, so every row that could exist is a row some test made. This is
 * stated as the reason no carry-over is written below, not as a claim that the data would be
 * worth carrying if it were there - there is no column left to carry it into.
 */

drop table notification_setting;
