/*
 * WHAT FACEBOOK HOLDS OF EVERY PROFILE ITS CRAWLER HAS READ, IN EACH LANGUAGE.
 *
 * PDL P11, the entry „Profil ima deljivu sliku za društvene mreže (OG sliku)", item 10 (owner, 15.11.2026, chosen with
 * the assistant's recommendation): „Facebook se osvežava sa servera: posle svake promene koja menja karticu server
 * traži od Facebooka da ponovo pročita profil." And item 14 (owner, 16.11.2026, chosen between the two ways
 * offered, with the assistant's recommendation): the server remembers the profiles Facebook's crawler has already opened and
 * asks Facebook to refresh only those; a profile Facebook has never read is not asked about, because Facebook reads it
 * fresh the first time somebody pastes it.
 *
 * So a row is WRITTEN BY FACEBOOK READING A PROFILE, and by nothing else: `CompetitorPreviewApi` writes it down when
 * the reader of a shown profile is Facebook's crawler (`WhatFacebookHasRead`). `FacebookIsAskedToReadAChangedCard`
 * then compares every row with the card as it stands, asks Facebook about the ones that differ, and writes them as
 * Facebook will hold them; it never adds a row. The rows survive a restart, which a list in memory would not.
 *
 * A row is one profile in one language, because the two languages are two addresses and two cards. `address` is the
 * address of the profile (`/sr/takmicar/000001-nikola-minic`), which carries the name, and `card` is the address of
 * the card Facebook holds there (`/api/cards/competitor/000001-sr1-0f3a9c2b7d4e6a18.jpg`), which carries a digest of
 * everything the card draws, both without the host. `card` is NULL when what Facebook holds at that address is the
 * front page's preview: the profile stopped being shown, Facebook was asked about it once, and nothing more is asked
 * while it stays so. The row stays, because Facebook has read that profile, and when it is shown again Facebook is
 * asked again (item 14). No moment is kept: nothing the job or a deletion does reads one.
 *
 * A MEMBER WHO IS DELETED TAKES HIS ROWS WITH HIM, by the key below, in the same statement that deletes him: the
 * Privacy Policy says that when a member asks to be deleted „ime i članski broj nestaju", and the address carries his
 * name. Item 14 (owner, 16.11.2026, chosen with the assistant's recommendation) asks for one more thing first: when a
 * member whose profile Facebook holds a card of is deleted, the server asks Facebook AT ONCE to read his addresses
 * again, so that Facebook gets the front page's preview, and the name is kept not a minute after the deletion. So the
 * deletion (`CompetitorWriteApi.takeAway`, the one home every road that deletes a member goes through) reads the
 * addresses of his rows whose `card` is not NULL before it deletes him, and hands them to Facebook after the commit;
 * the rows go with him. The key also follows a member number that changes, so the row stays his and the next run sees
 * an address that moved.
 *
 * No `id`: the pair is the key, and nothing points at a row.
 *
 * CHANGED IN PLACE ON 16.11.2026, before the merge: the first version wrote every shown profile down on the job's
 * first run, held `card` NOT NULL and deleted the row of a profile no longer shown. That was the condition named in
 * ADL A2 for a change in place is that the file is applied on no database, and PR 744, which brings it, was not merged
 * when it was changed.
 */
create table shared_card (
    member_number text not null,
    language      text not null,
    card          text,
    address       text not null,

    constraint shared_card_pk primary key (member_number, language),
    constraint shared_card_member_fk foreign key (member_number) references competitor (member_number)
        on delete cascade on update cascade,

    constraint shared_card_language_known check (language in ('sr', 'en')),
    constraint shared_card_card_is_a_card check (card like '/api/cards/competitor/%'),
    constraint shared_card_address_is_a_profile check (address like '/' || language || '/takmicar/%')
);
