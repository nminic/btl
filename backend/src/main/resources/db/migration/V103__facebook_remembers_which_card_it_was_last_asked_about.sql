/*
 * WHAT FACEBOOK WAS LAST ASKED TO READ, FOR EVERY PROFILE A VISITOR IS SHOWN, IN EACH LANGUAGE.
 *
 * PDL P11, the entry „Profil ima deljivu sliku za društvene mreže (OG sliku)", item 10 (owner, 15.11.2026, chosen with
 * the assistant's recommendation): „Facebook se osvežava sa servera: posle svake promene koja menja karticu server
 * traži od Facebooka da ponovo pročita profil." `FacebookIsAskedToReadAChangedCard` compares every card as it stands
 * with the row here, asks Facebook about the ones that differ, and writes them down; the rows are what it compares
 * with the next time, and they survive a restart, which a list in memory would not: every deploy would otherwise
 * forget what changed in the minutes before it.
 *
 * A row is one profile in one language, because the two languages are two addresses and two cards. `card` is the
 * address of the card (`/api/cards/competitor/000001-sr1-0f3a9c2b7d4e6a18.jpg`), which carries a digest of everything
 * the card draws, and `address` is the address of the profile (`/sr/takmicar/000001-nikola-minic`), which carries the
 * name, both without the host.
 *
 * IT HOLDS WHAT IS PUBLIC AND ONLY WHILE IT IS. A row stands for a profile a visitor is shown; the run that finds the
 * profile hidden or lapsed asks Facebook about it once and deletes the row. The address carries the member's name, so
 * a member who is DELETED takes his rows with him, by the key below, in the same statement that deletes him: the
 * Privacy Policy says that when a member asks to be deleted „ime i članski broj nestaju", and this table is not where
 * they would stay. The price, named: Facebook is not asked about the page of a member deleted while his profile was
 * shown, and keeps what it last read of it until it reads it again by itself. The key also follows a member number
 * that changes, so the row stays his and the next run sees an address that moved.
 *
 * No `id`: the pair is the key, and nothing points at a row.
 */
create table shared_card (
    member_number text not null,
    language      text not null,
    card          text not null,
    address       text not null,

    constraint shared_card_pk primary key (member_number, language),
    constraint shared_card_member_fk foreign key (member_number) references competitor (member_number)
        on delete cascade on update cascade,

    constraint shared_card_language_known check (language in ('sr', 'en')),
    constraint shared_card_card_is_a_card check (card like '/api/cards/competitor/%'),
    constraint shared_card_address_is_a_profile check (address like '/' || language || '/takmicar/%')
);
