package com.btl.portal.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * WHO RUNS IN THE LEAGUE, and only what the league publishes about them.
 *
 * <p><b>The year of birth does not leave this server, and that is the whole
 * reason this resource was written before the easier ones.</b> The published
 * privacy policy and Article 74 of the rulebook say it in one sentence: „Datum
 * rođenja se nikada ne prikazuje, ni u punom ni u skraćenom obliku. Javna je
 * samo kategorija koja iz njega proizlazi." The year IS the shortened form. The
 * portal served {@code birthYear} for all thirty two members until 13.09.2026,
 * when B52 removed it from {@code public/mock/competitors.json} and put the age
 * band there instead; that was the thing that had to stop before the policy takes
 * effect on 15.09.2026 (risk R4). This server is the other door onto the same
 * fact, and it was shut first.
 *
 * <p><b>What replaces it is the category, and it is not here yet.</b> The age
 * band is worked out from the year and the season, and a member in their first
 * season carries that category instead, which depends on their whole history of
 * points (PDL P7, and the owner's decisions of 03.08. and 11.08.2026). That is
 * its own increment, on the server, the same way the points themselves are.
 * Nothing reads this resource yet.
 *
 * <p><b>What changed on 13.09.2026, and what it means for that increment.</b> The
 * screens no longer work the band out from what they have, because they no longer
 * have it: B52 took the year off the served record and put the band itself there.
 * So this resource now owes a field the portal really serves, rather than one it
 * merely will. It is named in {@code CompetitorApiTest} as owed rather than
 * withheld, and that name fails the moment this resource starts answering with it,
 * so the debt cannot be forgotten.
 *
 * <p><b>And nothing about the membership fee leaves either.</b> The same article
 * of the rulebook goes on: „Datum rođenja se nikada ne prikazuje, ni u punom ni
 * u skraćenom obliku. Javna je samo kategorija koja iz njega proizlazi. <b>Isto
 * važi za adresu elektronske pošte, adresu, sve u vezi sa članarinom i privatne
 * poruke.</b>" The basis on which a membership is held says who is exempt from
 * paying, so it is „sve u vezi sa članarinom" and it stays behind. What the
 * member sees about their own fee is their own screen's business, once there is
 * a resource that answers only to them.
 *
 * <p><b>And that is why the list itself is only the members whose fee is
 * standing.</b> Whether it is standing is the fee's own status, and answering
 * with it names, beside a full name and a member number, everybody who has not
 * paid. PDL P11 decided that long before this resource existed: „Status
 * članarine se ne prikazuje na profilu. Prisustvo člana na sajtu u tekućoj
 * godini samo po sebi znači da je članarina aktivna; ko nije platio, ne vidi se
 * nigde osim u istorijskim godinama." A review found the flag still leaving here
 * after the basis had been removed, and the owner, asked on 13.09.2026 which of
 * the two shapes P11 takes on the server, chose this one: <b>not on the list at
 * all</b>, rather than on the list with the flag withheld.
 *
 * <p>What follows from that, and is owed: the profile and the historical tables
 * of a member whose fee has lapsed need a resource that knows them, and it is
 * not this one. Until it exists those screens have nothing to read, which is
 * visible rather than silent, and that is the point.
 *
 * <p><b>And neither the referral code nor who handed it out.</b> Article 73
 * lists what is public and neither is on it. This one is worth the extra
 * sentence, because the name hides it: the portal reads {@code referredBy} as the
 * CODE of whoever brought the member in ({@code data/types.ts}: „Not the member
 * number, which is public and consecutive"). Answering with the member number
 * instead would quietly change what the field means and hand every screen that
 * counts referrals an answer of nothing; answering with the code would publish a
 * secret beside a name. Counting who a member brought in is a question about
 * that member, and it belongs to the resource that knows who is asking.
 *
 * <p><b>AND SINCE 20.09.2026 THIS IS THAT RESOURCE, for the member's OWN two of
 * them and for nobody else's.</b> P-javno (ADL, 13.09.2026) put everything Article
 * 73 does not list „iza resursa koji zna ko pita"; this route now knows, so the two
 * of those fields that are the member's own about HIMSELF come back to him:
 *
 * <ul>
 * <li><b>His own referral link</b> ({@code referralCode}). PDL, 06.09.2026,
 * measured: „`referralCode` je clanov sopstveni link, a poredi se sa tudjim
 * `referredBy`", and the terms of use say where it is drawn - „Svaki clan ima licni
 * link za preporuku... koji vam stoji ispisan na vasoj strani „Moja clanarina""
 * (V24, section 6). ADL A8 named the road it may travel in as many words: „kod
 * preporuke i godina rodjenja idu iskljucivo kroz endpoint koji trazi prijavu, i
 * nikad u odgovor koji vidi posetilac."</li>
 * <li><b>How many he brought in</b> ({@code referredCount}), which is the number
 * {@code pages/member/Membership.tsx} draws and the money the terms promise him:
 * „Iznos leze na vas balans u trenutku aktivacije." It is answered as a COUNT and
 * never as the column it is counted from, and that is the whole difference this
 * resource makes: the screen works it out today with a query „nad svima, ne nad
 * sobom" (PDL, 06.09.2026), which on a list anybody may read is every member's
 * referrer published beside his name - and, because {@code referredBy} IS a code,
 * every member's code published under another name.</li>
 * </ul>
 *
 * <p><b>Whose row carries them is the point, so it is the row and not the
 * list.</b> Both are answered on the ONE record whose member is the caller, and
 * are ABSENT - not null - from every other record and from every record of an
 * answer nobody signed in asked for. A field that is null for a stranger and null
 * for a visitor says the same thing twice and tells the two apart nowhere;
 * a field that is not there at all leaves the visitor's answer byte for byte what
 * it was before this increment, which is what {@code /mock} is being aligned
 * against while this is written.
 *
 * <p><b>AND SINCE 21.09.2026 THE ADMINISTRATION IS ANSWERED THE ONE FIELD THAT IS
 * ITS OWN, on every record and nobody else's.</b> PDL P8, 28.07.2026: „Osnov
 * clanstva se nikad ne prikazuje javno. Ni na profilu, ni u tabelama, nigde.
 * <b>Vide ga samo Superadmin i moderatori sa pravom nad clanovima.</b>" The owner's
 * reason is the shape of the rule: „to je podatak o novcu, a ne o trcanju, i nikoga
 * se ne tice ko je pocascen". So {@code membershipBasis} is answered when, and only
 * when, whoever is asking holds {@link #OVER_THE_MEMBERS} - which the superadmin
 * holds by his mode and a moderator holds one tick at a time (V5).
 *
 * <p><b>A MEMBER DOES NOT GET HIS OWN THROUGH THIS DOOR, and that is a decision with
 * a measurement behind it rather than an omission.</b> The owner sharpened P8 on
 * 20.09.2026: „Clan vidi SVOJ osnov clanstva; tudji ne vidi niko osim
 * administracije." That half cannot be served from here, and the reason is this
 * resource's own first rule: the list is the members whose fee is STANDING (see
 * above), so a member whose fee has lapsed is not on it at all - and he is exactly
 * the man the sharpening is about, „covek koji ne placa clanarinu treba da zna da je
 * ne placa". Answered here it would reach every member except the ones it was
 * written for. It belongs on a route that answers about one caller whether or not he
 * is on any list, which is {@link MeApi}.
 *
 * <p><b>AND IT IS NOT THERE YET, said here rather than implied.</b> Measured on
 * 21.09.2026 against {@code origin/main}: {@code MeApi.WhoIAm} carries {@code role}
 * and {@code account} and nothing else, so as of this increment the member's own
 * basis leaves the server through NO route. That is the other half of P8 and it is
 * its own piece of work; what this one settles is the half about everybody else.
 *
 * <p>The boundary in both directions, with a case on each side:
 * {@code theAdministrationIsTheOnlyOneToldHowAMembershipIsHeld} fails if a plain
 * member is answered it anywhere, including on his own row, and
 * {@code aModeratorOverTheMembersIsToldHowEveryMembershipIsHeld} fails if the
 * administration is answered it nowhere.
 *
 * <p><b>The fact has two homes today and this reads the older one on purpose.</b>
 * {@code competitor.membership_basis} stands per PERSON (V7); {@code membership.basis}
 * stands per person per SEASON (V22) and is the shape the owner decided on 13.09.2026.
 * V22 left the column where it is with the reason written out - „it is read today, and
 * dropping a column that is read is a different increment from adding a table that is
 * not" - and PDL records the two homes as a boundary rather than passing over them.
 * This resource answers the field the PORTAL reads, and the portal reads the column:
 * {@code frontend/src/data/types.ts} declares {@code membershipBasis} and
 * {@code AdminMembers.tsx} draws it as a tag. Reading the table instead would answer
 * nothing at all for anybody honorary, because the screen that grants an honorary
 * membership does not exist yet and no such row is ever written (PDL, B50). Moving
 * the fact is the increment that removes {@code competitor.active}, and it moves both
 * homes and all eight readers at once.
 *
 * <p><b>What is NOT answered here, and why each one is a decision rather than an
 * oversight.</b> {@code referredBy} itself - the code of whoever brought the CALLER
 * in - is answered by nothing, because no screen in the portal reads it about
 * oneself; what every reader of it wanted is the count above.
 *
 * <p>All of these omissions are the reason this resource exists. PDL, 06.09.2026,
 * measured and named exactly these fields as the ones that cannot leave the
 * public file „dok portal nema bekend", because one file was serving the public
 * side, the member's own screens and the administration at once. This is that
 * backend, and it must not repeat the file it replaces. <b>The three audiences are
 * now three different answers out of one resource rather than one file read by
 * three</b>: the public side is the answer below, the member's own screens are the
 * two fields above, and the administration is the field this paragraph is about.
 *
 * <p>All five names are named at the call site in {@code CompetitorApiTest},
 * with the reason, and each one is checked to be one the portal really serves. A
 * field that went missing by accident and one left out on purpose look the same
 * from a test; this is what tells them apart. Three of the five are no longer
 * omissions from EVERY answer but from the answers of everybody they are not
 * about, and the cases say which is which: {@code noReferralCodeLeavesTheServer}
 * asks the visitor's answer for every code in the database,
 * {@code aMemberIsHandedHisOwnCodeAndNobodyElses} asks the member's for the other
 * three, and {@code theAdministrationIsTheOnlyOneToldHowAMembershipIsHeld} asks
 * the answers of all five kinds of caller for the basis.
 *
 * <p><b>A hidden profile is still in this list.</b> Hiding a profile is about the
 * profile PAGE (PDL P23); the member number and the name stay public (Article
 * 73), and the portal needs the flag in order to know what to draw. Deleting a
 * member is the other door and it takes the row with it. A lapsed fee is a third
 * door and it is the one above: it takes the member off the list without taking
 * anything away from them.
 *
 * <p><b>In member number order</b>, which is the one order the portal speaks of
 * them in: it is printed on the card and it never changes.
 */
@RestController
class CompetitorApi {

	/**
	 * THE BOX THE SUPERADMIN TICKS FOR SOMEBODY HE TRUSTS WITH THE MEMBERS, which is
	 * what PDL P8's „moderatori sa pravom nad clanovima" is in the matrix.
	 *
	 * <p><b>The code as {@code admin_right.code} generates it</b>, {@code scope:target}
	 * over the row V5 writes as {@code ('entity', 'members')}. It is a constant and not
	 * a {@link RightIsNeeded} annotation because this route is open to everybody and
	 * only one FIELD of the answer is guarded; an annotation would shut the list of
	 * members to the league.
	 *
	 * <p><b>That costs it the floor annotations get, so it is given its own.</b>
	 * {@code everyRightARouteAsksForIsOneTheMatrixHolds} reads the annotations off the
	 * dispatcher and cannot see a string in a query, and the thing it guards is not a
	 * typo but a leak: a misspelt right is refused to every moderator and ALLOWED to the
	 * superadmin, whose mode answers yes to any string there is (see
	 * {@link RightIsNeeded}). So it would be a door that reads shut in every case
	 * written with a moderator. {@code theRightThisResourceAsksForIsOneTheMatrixHolds}
	 * asks {@code admin_right} itself, in the same commit as this line.
	 */
	static final String OVER_THE_MEMBERS = "entity:members";

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	private final WhatHeMayDo mayHe;

	CompetitorApi(JdbcClient db, MemberOfAccount memberOfAccount, WhatHeMayDo mayHe) {
		this.db = db;
		this.memberOfAccount = memberOfAccount;
		this.mayHe = mayHe;
	}

	/**
	 * @param birthdayShown  what the member chose about their birthday, which the
	 *                       portal needs in order to draw the card at all
	 * @param referralCode   the caller's OWN link, and absent from every other record
	 *                       and from every answer nobody signed in asked for. Absent
	 *                       rather than null: see the note on this class for why the
	 *                       difference is the whole point
	 * @param referredCount  how many members the caller brought in whose fee is
	 *                       standing, on the caller's own record and nowhere else.
	 *                       The COUNT and never the column it is counted from
	 * @param membershipBasis on what basis the membership on THIS record is held, on
	 *                       every record of an answer the administration asked for and
	 *                       ABSENT from every record of anybody else's - a visitor's, a
	 *                       member's own included, and a signed in moderator who does
	 *                       not hold {@link #OVER_THE_MEMBERS}. Absent rather than null
	 *                       or empty, for the reason written on {@code referralCode}:
	 *                       „I am not telling you" and „he pays nothing" must not be the
	 *                       same shape, and a key carrying null is a key the next change
	 *                       fills in
	 */
	record Competitor(String memberNumber, String firstName, String lastName, String gender,
			String city, String country, boolean firstSeason2027, int firstSeason,
			String bio, Long teamId, Integer teamSince, boolean profileHidden,
			String birthdayShown,
			@JsonInclude(JsonInclude.Include.NON_NULL) String referralCode,
			@JsonInclude(JsonInclude.Include.NON_NULL) Integer referredCount,
			@JsonInclude(JsonInclude.Include.NON_NULL) String membershipBasis) {
	}

	/**
	 * @param member who the chain worked out is asking, or NULL when nobody is: this
	 *               route is on {@code ApiSecurity.READ_BY_ANYBODY}, so an anonymous
	 *               GET reaches this method rather than being answered 401, and
	 *               Spring's resolver hands a parameter of this type nothing when the
	 *               principal is the anonymous token. Measured rather than assumed, by
	 *               {@code theVisitorsAnswerHasNotMoved}: the visitor's answer carries
	 *               none of the three conditional fields below at all
	 */
	@GetMapping("/api/competitors")
	List<Competitor> competitors(@AuthenticationPrincipal WhoIsAsking.Member member) {
		/* The caller AS A MEMBER, which is a second question and may answer nothing:
		   an account that does not race has no member behind it at all (V23, owner
		   14.09.2026), so nothing on the two fields below is added for him.

		   THAT USED TO READ „so a signed in moderator gets exactly the visitor's
		   answer", AND SINCE THE LINE BELOW IT IS NO LONGER TRUE OF EVERY MODERATOR.
		   It is still true of one who does not hold the right over the members, which
		   is what `anAccountThatRacesForNobodyIsAnsweredWhatAVisitorIs` holds - and
		   that case now says out loud which of the two it is measuring.

		   Read here rather than off `WhoIsAsking.Member`, which is the shape that
		   record's own javadoc invites and `InboxApi` already follows. */
		Long me = member == null ? null : memberOfAccount.competitorId(member.account());

		/* AND WHETHER HE IS THE ADMINISTRATION, which is a third question and none of
		   the two above. It is asked of the ACCOUNT and never of the member: a
		   moderator who does not race has no member at all (V23), so reading it off
		   `me` would refuse the ordinary case outright.

		   `member != null` is not a nicety here. This is the first route to ask „may
		   he" while standing on `ApiSecurity.READ_BY_ANYBODY`, so the principal of a
		   visitor is Spring's anonymous token; the overload takes the caller rather
		   than reaching for the context, and its own note says what that is for. */
		boolean administration = member != null && mayHe.may(member, OVER_THE_MEMBERS);

		return db.sql("select c.member_number, c.first_name, c.last_name, c.gender,"
						+ " coalesce(town.name, c.city) as city,"
						+ " coalesce(town_country.code, typed_country.code) as country,"
						+ " c.first_season_2027, c.first_season,"
						+ " c.bio, m.team_id, m.season_from as team_since,"
						+ " c.profile_hidden, c.birthday_shown,"
						/* AND THE CALLER'S OWN TWO, ON THE CALLER'S OWN ROW. Written as a
						   condition on the row rather than as a second query against one
						   member, so the answer keeps its one row per member: a join here
						   would be the one shape that can change what everybody else sees.

						   `c.id = :me` IS NULL, NOT FALSE, WHEN NOBODY IS ASKING, and that
						   is what carries the whole rule: a null `case` answers null, a null
						   is left out by `@JsonInclude`, and the visitor's answer therefore
						   has nothing added to it - no key, no null, no byte. */
						+ " case when c.id = :me then c.referral_code end as referral_code,"
						/* THE COUNT, AND ONLY OF THE MEMBERS WHOSE FEE IS STANDING, which is
						   the same set `pages/member/Membership.tsx` counts today
						   (`one.referredBy === me.referralCode && one.active`). `referred_by`
						   is the KEY of the member who brought this one in and not his code
						   (V7), so this counts on the key; the portal's word for the same
						   fact is the code, and the two meet here rather than in a screen.

						   Cast, because `count(*)` is a bigint and what comes back is read as
						   a whole number that fits the portal's own type. */
						+ " case when c.id = :me then cast((select count(*) from competitor brought"
						+ "  where brought.referred_by = c.id and brought.active) as integer)"
						+ " end as referred_count,"
						/* AND THE BASIS, ON EVERY ROW OR ON NONE. The condition is the CALLER
						   and never the row, which is the whole difference between this field
						   and the two above: those are the caller's own fact and this is a fact
						   about everybody, answered to the few who may read it. Written as
						   `c.id = :me` it would hand the administration its own basis and
						   nothing else, which is the shape a copy of the line above produces
						   and `aModeratorOverTheMembersIsToldHowEveryMembershipIsHeld` refuses.

						   FALSE ANSWERS NULL AND NOT AN EMPTY STRING, so `@JsonInclude` leaves
						   the key out and the answer of everybody else is what it was to the
						   byte - the same rule the two fields above stand on.

						   CAST, for the reason `TeamApi` writes out beside its own: a parameter
						   standing alone in a `case` has no neighbour to take a type from and
						   PostgreSQL refuses the statement rather than guessing. */
						+ " case when cast(:administration as boolean)"
						+ "  then c.membership_basis end as membership_basis"
						+ " from competitor c"
						+ " left join place town on town.id = c.place_id"
						+ " left join country town_country on town_country.id = town.country_id"
						+ " left join country typed_country on typed_country.id = c.country_id"
						/* The membership that has not ended: a member is in one team at a time
						   (V11), and the season it started in is what the portal draws beside the
						   club's name. */
						+ " left join team_membership m on m.competitor_id = c.id"
						+ "  and m.season_to is null"
						/* AND ONLY THE MEMBERS WHOSE FEE IS STANDING, which is the whole of what
						   this resource is allowed to say about a fee. PDL P11: „Status clanarine
						   se ne prikazuje na profilu... ko nije platio, ne vidi se nigde osim u
						   istorijskim godinama." Owner, 13.09.2026, asked which shape that takes
						   here, chose this one over serving the flag: a member whose fee has
						   lapsed is not on this list at all. */
						+ " where c.active"
						+ " order by c.member_number")
				.param("me", me)
				.param("administration", administration)
				.query((row, one) -> new Competitor(row.getString(1), row.getString(2),
						row.getString(3), row.getString(4), row.getString(5), row.getString(6),
						row.getBoolean(7), row.getInt(8), row.getString(9),
						row.getObject(10) == null ? null : row.getLong(10),
						row.getObject(11) == null ? null : row.getInt(11),
						row.getBoolean(12), row.getString(13),
						row.getString(14), row.getObject(15, Integer.class),
						row.getString(16)))
				.list();
	}
}
