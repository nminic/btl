/*
 * WHAT FACEBOOK HOLDS AT EVERY ADDRESS OF A PROFILE ITS CRAWLER HAS READ.
 *
 * PDL P11, the entry „Profil ima deljivu sliku za društvene mreže (OG sliku)", item 10 (owner, 15.11.2026, chosen with
 * the assistant's recommendation): „Facebook se osvežava sa servera: posle svake promene koja menja karticu server
 * traži od Facebooka da ponovo pročita profil." And item 14 (owner, 16.11.2026, chosen between the two ways
 * offered, with the assistant's recommendation): the server remembers the profiles Facebook's crawler has already opened and
 * asks Facebook to refresh only those; a profile Facebook has never read is not asked about, because Facebook reads it
 * fresh the first time somebody pastes it.
 *
 * ONE ROW IS ONE ADDRESS FACEBOOK'S CRAWLER HAS READ, of one member, and nothing else. `address` is the address of the
 * profile without the host (`/sr/takmicar/000001-nikola-minic`), which carries the language, the number and the name,
 * and `card` is the address of the card Facebook was last given there (`/api/cards/competitor/000001-sr1-0f3a9c2b7d4e6a18.jpg`),
 * which carries a digest of everything the preview is made of. `card` is NULL when what Facebook holds there is the
 * front page's preview: the profile stopped being shown, Facebook was asked about the address once, and nothing more
 * is asked while it stays so. No moment is kept: nothing the job or a deletion does reads one.
 *
 * WHO WRITES A ROW, AND WHAT NOBODY DOES. `CompetitorPreviewApi` adds the row of the address it served Facebook's
 * crawler, or gives that row the card it served (`WhatFacebookHasRead`); `FacebookIsAskedToReadAChangedCard` gives a
 * row it asked Facebook about the card Facebook will hold there. Neither touches another row, and nothing deletes one:
 * a row goes only with its member, by the key below. That is the whole point of the shape. The first versions of this
 * file kept one row per member and language and wrote the address into it, so a reading at a new address (a rename)
 * either overwrote the one Facebook read before or kept it on the side, where a run that could not fit it took it out
 * without asking; three rounds of review of PR 744 found an address lost, and with it the name of a deleted member
 * kept at Facebook. Here a row holds one address and nothing can take it out but the member's own deletion.
 *
 * A MEMBER WHO IS DELETED TAKES HIS ROWS WITH HIM, in the same statement that deletes him: the Privacy Policy says
 * that when a member asks to be deleted „ime i članski broj nestaju", and the address carries his name. Item 14
 * (owner, 16.11.2026, chosen with the assistant's recommendation) asks for one more thing first: when a member whose
 * profile Facebook holds a card of is deleted, the server asks Facebook AT ONCE to read his addresses again, so that
 * Facebook gets the front page's preview, and the name is kept not a minute after the deletion. So the deletion
 * (`CompetitorWriteApi.takeAway`, the one home every road that deletes a member goes through) reads every row of his
 * whose `card` is not NULL before it deletes him, and hands the addresses to Facebook after the commit. The key also
 * follows a member number that changes, so the row stays his; the address keeps the number Facebook read, and what
 * it serves is worked out from the address, as nginx does.
 *
 * The address is held to the shape the preview writes (`CompetitorPreviewApi.profilePath`): the language, the six
 * digits of the number, and the name as `EventAddress.written` spells it (small letters and digits, a dash between
 * words) after a dash, or nothing.
 *
 * No `id`: the pair is the key, and nothing points at a row.
 *
 * CHANGED IN PLACE ON 16.11.2026, three times, before the merge: the file is applied on no database (the highest
 * version on production and on QA was measured on 16.11.2026 to be 101) and PR 744, which brings it, is not merged,
 * which is the condition ADL A2 names for a change in place.
 */
create table shared_card (
    member_number text not null,
    address       text not null,
    card          text,

    constraint shared_card_pk primary key (member_number, address),
    constraint shared_card_member_fk foreign key (member_number) references competitor (member_number)
        on delete cascade on update cascade,

    constraint shared_card_card_is_a_card check (card like '/api/cards/competitor/%'),
    constraint shared_card_address_is_a_profile check (address ~ '^/(sr|en)/takmicar/[0-9]{6}(-[a-z0-9]+)*$')
);
