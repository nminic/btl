package com.btl.portal.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * WHO THE PORTAL THINKS IS ASKING, AND WHAT IT HAS ON HIM, said back to whoever
 * asked.
 *
 * <p>The single page application has to know this before it draws anything: what
 * a visitor sees, what a member sees and what an administrator sees are three
 * different pages, and until now the answer lived in a browser tab and was lost
 * on every refresh.
 *
 * <p><b>It is behind the same rule as everything else, which is the point.</b>
 * Nobody signed in is answered 401 by the chain, not an empty body saying so:
 * an endpoint that answered "you are nobody" with 200 would be one more place
 * deciding what being signed in means, and the day it disagreed with the chain
 * the portal would show a member a page the server then refuses to fill.
 *
 * <p><b>AND SINCE 20.09.2026 IT CARRIES A MEMBER NUMBER, which is the sentence
 * this class used to spend four paragraphs refusing.</b> The refusal was never
 * about the number being unreachable - V23 gave {@code account} a
 * {@code competitor_id} on 14.09.2026 - but about nothing having asked for it:
 * "a field this record carries is a field every screen may read, and each one
 * added is a promise about what the portal answers before anybody has said which
 * screen needs it." Something has now asked. {@code frontend/src/data/client.ts}
 * measured on 20.09.2026 that what stops {@code /mock} being switched off is
 * FIELDS rather than shapes, and P-javno (ADL, 13.09.2026) puts every one of them
 * „iza resursa koji zna ko pita". This is that resource for the caller's own
 * record, and {@link CompetitorApi} is it for what the league publishes.
 *
 * <p><b>The other half of that old refusal is answered by the shape rather than
 * by an argument.</b> It said a member number here „would be null for a real
 * signed in administrator, and every screen reading it would need the branch
 * whether it wanted one or not". True, and that is why nothing here is null: an
 * account that races for nobody is answered with NO {@code member} key at all,
 * and a member who has not been given a number yet is answered with the key
 * {@code member} and no {@code memberNumber} inside it. The precedent is
 * {@link CompetitorApi}'s own, written for the same reason five days ago: a field
 * „ABSENT - not null ... A field that is null for a stranger and null for a
 * visitor says the same thing twice and tells the two apart nowhere."
 *
 * <p><b>WHY THE NUMBER MAY BE MISSING FROM A REAL MEMBER, which is a decision and
 * not a gap.</b> ADL A44, owner, 11.09.2026: „`member_number` postaje neobavezan
 * na `competitor`. Osoba je `competitor` od registracije, a clan postaje kad
 * dobije broj", and the cost he took with it: „svaki upit koji racuna da broj
 * postoji mora da kaze `member_number is not null`". This route does not compute
 * on the number, it answers with it, so what it owes A44 is the absence rather
 * than a filter - and a case says so.
 *
 * <p><b>AND IT ANSWERS A MEMBER WHOSE FEE HAS LAPSED, which is the whole of why
 * this is a second resource and not four more fields on the first one.</b>
 * {@link CompetitorApi} leaves such a member off its list entirely - owner,
 * 13.09.2026, asked which shape PDL P11 takes on the server - and its own javadoc
 * names the consequence as owed rather than solved: „the profile and the
 * historical tables of a member whose fee has lapsed need a resource that knows
 * them, and it is not this one." It is this one.
 *
 * <p><b>AND THREE FIELDS THAT ARE HIS OWN BUSINESS AND NOBODY ELSE'S, each here
 * because a decision or a measurement put it here.</b> Two of them were refused on
 * 20.09.2026 and both refusals are gone for different reasons: the first was
 * settled by the owner, the second was MEASURED AND FOUND FALSE.
 *
 * <ul>
 * <li><b>The basis his membership is held on.</b> Owner, 20.09.2026, asked outright
 * with three outcomes offered and one chosen: „Clan vidi SVOJ osnov clanstva; tudji
 * ne vidi niko osim administracije." PDL P8 of 28.07.2026 - „Osnov clanstva se
 * nikad ne prikazuje javno. Ni na profilu, ni u tabelama, nigde" - is about
 * SOMEBODY ELSE'S basis, and the owner's reason for saying so is that a man who is
 * not being charged has to know it, „inace ne razume zasto mu portal ne trazi
 * uplatu". That also settles what stood against P8 as a measurement rather than a
 * decision, PDL of 06.09.2026: „`membershipBasis` nosi oslobodjenje od clanarine, i
 * clanu i administraciji." <b>Somebody else's basis still leaves nowhere</b>, and
 * what holds that is the shape rather than this paragraph: the query below reads
 * one row and the row is his.</li>
 * <li><b>His referral code, and the count of who he has brought in.</b> These were
 * left out with the sentence „ANSWERED ALREADY, by {@link CompetitorApi}, on the
 * caller's own row", and that sentence does not survive a probe. That route
 * computes both inside a query that ends {@code where c.active}, so a member whose
 * fee has lapsed is not among its rows at all and his row never reaches the
 * {@code case} that would have filled them in: signed in with his own cookie he
 * asks {@code /api/competitors} and gets back neither field, while an active member
 * gets both. He is exactly the person V24 section 6 promises them to - „a koji vam
 * stoji ispisan na vasoj strani 'Moja clanarina', uz sam link" - and that page is
 * where he goes to renew. It is also the case this class makes for itself two
 * paragraphs up: this route exists BECAUSE {@link CompetitorApi} leaves him off.</li>
 * </ul>
 *
 * <p><b>AND THE BOUNDARY THAT COMES WITH THE SECOND ONE, named here rather than
 * left for a review to find: for a member whose fee is standing those two facts now
 * have TWO HOMES.</b> {@link CompetitorApi} answers them on the caller's own row
 * and this one answers them on his record. Two homes are what lets two answers
 * disagree, so the counting clause here is that one's word for word - as
 * {@code season_to is null} already is between these two - and a case measures that
 * the two doors really do still say the same thing. Which door keeps the fact is
 * one increment over both together and wants the owner's word on whether a public
 * list is the place for a member's private link at all; it is not this PR.
 *
 * <p><b>A BOUNDARY, WRITTEN DOWN BECAUSE IT IS REAL AND NOT BECAUSE IT IS
 * COMFORTABLE: no pattern over the English above measures anything.</b> What the
 * cases hold is the thing the prose is about - that the basis answered is the
 * caller's own and the other word in the schema is not it, that the code answered
 * is his and no other code in the database is anywhere in the answer, and that the
 * three shapes an account can have are three different answers. Prose has no guard
 * and cannot be given one that converges; a pattern over English has to be right
 * about sentences nobody has written yet.
 */
@RestController
class MeApi {

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	MeApi(JdbcClient db, MemberOfAccount memberOfAccount) {
		this.db = db;
		this.memberOfAccount = memberOfAccount;
	}

	/**
	 * What the portal knows about whoever is asking.
	 *
	 * @param member the caller's own record, or ABSENT when the account races for
	 *               nobody. Absent rather than null, and rather than an object of
	 *               nulls: „I have no record" and „my record is empty" are two
	 *               different facts and a reader has to be able to tell them apart
	 */
	record WhoIAm(String role, long account,
			@JsonInclude(JsonInclude.Include.NON_NULL) MyOwnRecord member) {
	}

	/**
	 * THE CALLER'S OWN RECORD, and only what is his own to see about himself.
	 *
	 * <p>Six of these seven are facts a member whose fee is standing can already read
	 * elsewhere: four of them Article 73 makes public about everybody, and two more
	 * {@link CompetitorApi} hands the caller on his own row. The SEVENTH, the basis his
	 * membership is held on, leaves nowhere else at all and is here on the owner's word
	 * of 20.09.2026. What this route adds is not secrecy but ADDRESSING: the caller no
	 * longer has to find himself in a public list by a number his browser remembered,
	 * which is a lookup that answers nothing at all for the three people it matters
	 * most to - the moderator who is on no list, the registered person who has no
	 * number to look up by, and the member whose fee has lapsed and who is therefore
	 * off the list altogether. The last of those three is why the three below are here
	 * rather than left to the other door.
	 *
	 * @param memberNumber ABSENT for a person who has registered and has not been
	 *                     given one (ADL A44, owner 11.09.2026). The record being
	 *                     present is what says „I am a competitor"; this being
	 *                     present is what says „I am a member"
	 * @param country      never absent: {@code competitor_town_is_from_the_codebook_or_typed}
	 *                     and {@code competitor_typed_town_names_its_country} (V7)
	 *                     between them make exactly one of the two roads to a country
	 *                     open on every row, so the {@code coalesce} below cannot come
	 *                     back empty and there is no branch here for one that did
	 * @param firstSeason  never absent: {@code competitor.first_season} is NOT NULL
	 *                     (V7). The season-by-season fact V22 added is a different
	 *                     question and „no resource reads it yet", in that migration's
	 *                     own words
	 * @param teamId       the team of the membership that has NOT ENDED, and ABSENT for a
	 *                     member who has none. <b>That is not the same question as „which
	 *                     team is he in this season", and the difference is measured rather
	 *                     than assumed</b>: V11 calls {@code season_to} „the last season he
	 *                     is in it", PDL of 20.08.2026 lets a member leave „od 1. januara
	 *                     naredne godine", and {@code SeasonClock.transfersTakeEffect}
	 *                     always answers next year - so between a transfer being agreed and
	 *                     1 January a member has a CLOSED membership in the team he is in
	 *                     and an OPEN one in the team he is going to, and this answers the
	 *                     second. <b>It is written this way on purpose</b>: the identical
	 *                     clause is {@link CompetitorApi}'s, so the portal answers one thing
	 *                     rather than two, and moving it is one increment over both together
	 *                     - with a product decision behind it, because no decision anywhere
	 *                     says which of the two a member's own page draws in October
	 * @param membershipBasis HIS OWN, and the only one that leaves here. Owner, 20.09.2026:
	 *                     „Clan vidi SVOJ osnov clanstva; tudji ne vidi niko osim
	 *                     administracije." Never absent: {@code competitor.membership_basis}
	 *                     is NOT NULL (V7) and {@code competitor_membership_basis_known}
	 *                     names the words it may hold, so there is no branch here for none
	 * @param referralCode never absent, and it names one row: {@code competitor.referral_code}
	 *                     is NOT NULL and UNIQUE (V7), and its shape is sixteen hexadecimal
	 *                     characters rather than anything a member number could collide with
	 * @param referredCount how many he has brought in WHOSE FEE IS STANDING, which is the
	 *                     condition the credit itself carries - PDL, 13.08.2026: „Zbir je broj
	 *                     clanova koje je taj clan doveo <b>i kojima je clanarina aktivirana</b>
	 *                     ... Ko se registrovao preko linka a clanarina mu nikad nije
	 *                     aktivirana, ne donosi nista." {@code referred_by} is the KEY of the
	 *                     member who brought this one in and not his code (V7), so the count
	 *                     is on the key. <b>The clause is {@link CompetitorApi}'s word for
	 *                     word</b>, for the reason {@code season_to is null} is: two homes for
	 *                     one fact may answer differently, and identical text is the cheapest
	 *                     thing that stops them. Never absent: a {@code count} answers a
	 *                     number even when nobody was brought in
	 */
	record MyOwnRecord(@JsonInclude(JsonInclude.Include.NON_NULL) String memberNumber,
			String country, int firstSeason,
			@JsonInclude(JsonInclude.Include.NON_NULL) Long teamId,
			String membershipBasis, String referralCode, int referredCount) {
	}

	/**
	 * @param member never null here: the chain answers 401 before this method runs,
	 *               so there is no branch for "nobody" and no case measuring one
	 */
	@GetMapping("/api/me")
	WhoIAm me(@AuthenticationPrincipal WhoIsAsking.Member member) {
		/* The caller AS A MEMBER, which is a second question and may answer nothing:
		   an account that does not race has no member behind it at all (V23, owner
		   14.09.2026). Read through the one home that already answers exactly this,
		   rather than as a third copy of the same one-column select, which is the
		   reasoning `MemberOfAccount` was written with and `CompetitorApi` follows. */
		Long me = memberOfAccount.competitorId(member.account());

		return new WhoIAm(member.role(), member.account(), me == null ? null : recordOf(me));
	}

	/**
	 * <p><b>One row, and it is his.</b> {@code account.competitor_id} is ON DELETE
	 * RESTRICT (V23) - „the member cannot be deleted while this column still names
	 * him" - so a value that is not null names a row that is there, and there is no
	 * case here for none.
	 */
	private MyOwnRecord recordOf(long me) {
		return db.sql("select c.member_number,"
						/* The town's country when the town came out of the codebook, and the
						   typed one otherwise, which is the same coalesce `CompetitorApi`
						   reads the public answer through. Written here rather than shared
						   with it: that one reads it for every member in one list, this one
						   for one member, and a helper between them would be a third place
						   deciding what a country is. */
						+ " coalesce(town_country.code, typed_country.code) as country,"
						+ " c.first_season, m.team_id,"
						/* HIS OWN, and there is one row here, so there is no shape in which
						   somebody else's could come out of it. */
						+ " c.membership_basis, c.referral_code,"
						/* AND HOW MANY HE HAS BROUGHT IN WHOSE FEE IS STANDING. Word for word
						   `CompetitorApi`'s, which is the point rather than an accident: that
						   route computes the same two facts for the caller and the day the two
						   clauses differ the portal answers one member two numbers.

						   Cast, because `count(*)` is a bigint and what comes back is read as
						   a whole number that fits the portal's own type. */
						+ " cast((select count(*) from competitor brought"
						+ "  where brought.referred_by = c.id and brought.active) as integer)"
						+ "  as referred_count"
						+ " from competitor c"
						+ " left join place town on town.id = c.place_id"
						+ " left join country town_country on town_country.id = town.country_id"
						+ " left join country typed_country on typed_country.id = c.country_id"
						/* The membership that has not ended. Without this clause a member who has
						   changed clubs has two rows and `single()` refuses the answer outright,
						   which is measured rather than argued.

						   WHAT IT DOES NOT SAY is which team he is in THIS season; see the note
						   on `teamId`. The clause is `CompetitorApi`'s word for word so that the
						   portal answers one thing rather than two, and the day that question
						   gets its decision both change together. */
						+ " left join team_membership m on m.competitor_id = c.id"
						+ "  and m.season_to is null"
						+ " where c.id = :me")
				.param("me", me)
				.query((row, one) -> new MyOwnRecord(row.getString(1), row.getString(2),
						row.getInt(3), row.getObject(4) == null ? null : row.getLong(4),
						row.getString(5), row.getString(6), row.getInt(7)))
				.single();
	}
}
