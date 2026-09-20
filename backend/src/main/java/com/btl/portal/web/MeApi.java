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
 * <p><b>TWO FIELDS THE SCREEN READS ARE DELIBERATELY NOT HERE, and each omission
 * is held by a case rather than by this paragraph.</b> ADL P-javno, 13.09.2026:
 * „Kad je sporno, polje se IZOSTAVLJA i izostavljanje se imenuje sa razlogom, pa
 * se vlasniku javi. Nikad se ne servira 'za svaki slucaj'."
 *
 * <ul>
 * <li><b>The basis the membership is held on.</b> PDL P8, 28.07.2026: „Osnov
 * clanstva se nikad ne prikazuje javno. Ni na profilu, ni u tabelama, nigde.
 * <b>Vide ga samo Superadmin i moderatori sa pravom nad clanovima.</b>" The
 * member is not on that list, and the same sentence is quoted twice more in this
 * repository as the reason for something already carried out - over
 * {@code membership.basis} in V22 („Never shown publicly, to anybody, on any
 * screen") and in {@link CompetitorApi}. Against it stands a MEASUREMENT rather
 * than a decision, PDL of 06.09.2026: „`membershipBasis` nosi oslobodjenje od
 * clanarine, i clanu i administraciji", and {@code pages/member/Membership.tsx}
 * reads it about itself today. Two opposite answers both pass a full suite, so it
 * is the meaning of a term and not a fault, and the owner decides it before the
 * code does.</li>
 * <li><b>The referral code, and who the caller brought in.</b> Not withheld -
 * ANSWERED ALREADY, by {@link CompetitorApi} since 20.09.2026, on the caller's own
 * row and nobody else's, as {@code referralCode} and as {@code referredCount}. A
 * second home for one fact is the thing that makes two answers able to disagree,
 * so this route does not become one.</li>
 * </ul>
 *
 * <p><b>A BOUNDARY, WRITTEN DOWN BECAUSE IT IS REAL AND NOT BECAUSE IT IS
 * COMFORTABLE: no pattern over the English above measures anything.</b> What the
 * cases hold is the thing the prose is about - that the words of every basis the
 * schema knows are absent from this answer, that no referral code in the database
 * is in it, and that the three shapes an account can have are three different
 * answers. Prose has no guard and cannot be given one that converges; a pattern
 * over English has to be right about sentences nobody has written yet.
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
	 * <p>Every one of these four is a fact Article 73 already makes public about
	 * every member, so nothing leaves here that does not leave {@link CompetitorApi}
	 * for a member whose fee is standing. What this route adds is not secrecy but
	 * ADDRESSING: the caller no longer has to find himself in a public list by a
	 * number his browser remembered, which is a lookup that answers nothing at all
	 * for the three people it matters most to - the moderator who is on no list, the
	 * registered person who has no number to look up by, and the member whose fee has
	 * lapsed and who is therefore off the list altogether.
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
	 * @param teamId       ABSENT for a member in no team. One team at a time (V11), so
	 *                     the membership that has not ended is one row or none
	 */
	record MyOwnRecord(@JsonInclude(JsonInclude.Include.NON_NULL) String memberNumber,
			String country, int firstSeason,
			@JsonInclude(JsonInclude.Include.NON_NULL) Long teamId) {
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
						+ " c.first_season, m.team_id"
						+ " from competitor c"
						+ " left join place town on town.id = c.place_id"
						+ " left join country town_country on town_country.id = town.country_id"
						+ " left join country typed_country on typed_country.id = c.country_id"
						/* The membership that has not ended, which is the one the portal draws
						   beside the club's name. Without `season_to is null` a member who has
						   changed clubs has two rows and the answer is whichever one the
						   database hands back first. */
						+ " left join team_membership m on m.competitor_id = c.id"
						+ "  and m.season_to is null"
						+ " where c.id = :me")
				.param("me", me)
				.query((row, one) -> new MyOwnRecord(row.getString(1), row.getString(2),
						row.getInt(3), row.getObject(4) == null ? null : row.getLong(4)))
				.single();
	}
}
