package com.btl.portal.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

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
 * computed both inside a query that ends {@code where c.active}, so a member whose
 * fee has lapsed is not among its rows at all and his row never reached the
 * {@code case} that would have filled them in: signed in with his own cookie he
 * asked {@code /api/competitors} and got back neither field, while an active member
 * got both. He is exactly the person V24 section 6 promises them to - „a koji vam
 * stoji ispisan na vasoj strani 'Moja clanarina', uz sam link" - and that page is
 * where he goes to renew. It is also the case this class makes for itself two
 * paragraphs up: this route exists BECAUSE {@link CompetitorApi} leaves him off.
 * <b>The owner read that measurement and took the other door away</b> (PDL P26a,
 * 25.09.2026), so this is not one of two answers any more but the only one.</li>
 * </ul>
 *
 * <p><b>AND THAT BOUNDARY IS CLOSED AS OF 25.09.2026: those two facts have ONE home
 * and it is this one.</b> It was written here on 21.09.2026 as two homes waiting for
 * a decision - „which door keeps the fact ... wants the owner's word on whether a
 * public list is the place for a member's private link at all". The owner gave it
 * (PDL P26a): the link „se sklanja sa javne liste takmicara" and stays only on „Moja
 * clanarina". {@link CompetitorApi} answers neither field to anybody any more, and
 * the case that held the two doors together went with the second door rather than
 * being loosened - measured first, three mutations, before it was touched.
 *
 * <p><b>What the counting clause is now, said because it used to be said the other
 * way.</b> It was „{@link CompetitorApi}'s word for word", which was the cheapest
 * thing that stopped two homes drifting. There is no second clause to agree with;
 * this is the clause. What holds it is behaviour rather than a twin:
 * {@code andHowManyHeBroughtInWhoseFeeStands} arranges the fixture so that every
 * wrong way of counting answers a different number, and
 * {@code aMemberWhoseFeeHasLapsedIsStillHandedHisOwnRecord} asks the same of the one
 * member the other door could never reach. Measured 25.09.2026: dropping
 * {@code and brought.active} from this clause fails both, independently of the case
 * that compared the doors.
 *
 * <p><b>AND SINCE 10.10.2026 IT CARRIES THE RECORD HIS OWN PROFILE IS DRAWN FROM, which is
 * the debt the paragraph about a lapsed fee names.</b> {@link CompetitorApi}'s own javadoc
 * says the profile of a member whose fee has lapsed "need a resource that knows them, and it
 * is not this one", and that paragraph answers that this one is. The owner then said what that
 * profile is for (PDL P8a, 25.09.2026, „Treba da moze da otvori svoj profil dokle god
 * postoji"), and a profile cannot be drawn from seven facts about a fee: it is headed by a
 * name and stands on a town, a category, a biography and a portrait, none of which reached a
 * member who is on no row of the public list.
 *
 * <p><b>The names are {@link CompetitorApi.Competitor}'s, for the same facts, on purpose</b>,
 * so that the portal reads one vocabulary for a member whichever door answered him. What
 * keeps the two from drifting is not a shared query - the precedent above is to write the
 * clause where it is read - but a case that asks both doors about the same member and
 * compares every name they share ({@code MeApiTest.theTwoDoorsAnswerTheSameMemberFieldForField}).
 *
 * <p><b>NOTHING IS WITHHELD FROM HIM, and that is the one place the two doors differ on
 * purpose.</b> {@link CompetitorApi} holds a hidden profile's biography, portrait and link to
 * its team back from a reader who is neither an active member nor the administration (PDL P23,
 * 03.10.2026, „Skrivanje deluje prema svakome ko nije aktivan član ni administracija, nikad
 * prema aktivnom članu"), and a member whose fee has lapsed is such a reader of everybody's
 * page. He is not one of his own: the record of the decision gives the reason in as many
 * words (the record's sentence, not the owner's) - when a member looks at himself nothing about
 * himself is hidden from him. So there is no {@code THE_PROFILE_IS_OPEN_TO_THE_CALLER} in
 * this query, and {@code MeApiTest.aMemberWhoseFeeHasLapsedAndHidesHisProfileIsHandedAllOfIt}
 * refuses the one carried in.
 *
 * <p><b>WHAT IS NOT DECIDED HERE: THE BYTES OF A HIDDEN PORTRAIT.</b> {@code photo} is the
 * address of his own approved portrait, answered to him whatever his profile says. Whether the
 * bytes behind that address are served to him is {@link PhotoApi}'s question, and it refuses
 * them to a reader who is neither an active member nor the administration - his own included,
 * when his fee has lapsed AND his profile is hidden. No decision covers that member looking at
 * his own portrait, so this answers the address and leaves the bytes where they are; it is
 * named here so that the next reader meets a boundary and not a fault.
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

	/**
	 * WHERE A PICTURE IS ASKED FOR, and the name that follows is its digest.
	 *
	 * <p>The same text {@link PhotoApi} maps, kept as a literal here as {@link CompetitorApi},
	 * {@link TeamApi} and {@link MePhotoApi} keep one each, for the reason they write out: a
	 * constant copied is only ever as good as what proves it equal, and what proves it is
	 * {@code MeApiTest.thePortraitIsTheAddressOfHisOwnPicture}, which hands the address this
	 * builds back to the dispatcher and requires it to arrive at {@link PhotoApi}.
	 */
	private static final String A_PICTURE_IS_ASKED_FOR_AT = "/api/photos/";

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
	 * <p>Four of the first seven are facts Article 73 makes public about everybody, so a
	 * member whose fee is standing can read them elsewhere. <b>THE OTHER THREE LEAVE THE
	 * SERVER THROUGH THIS ROUTE AND NO OTHER</b>: the basis his membership is held on,
	 * here since 20.09.2026 on the owner's word, and his referral link and his count of
	 * whom he brought in, which became this route's alone on 25.09.2026 (PDL P26a).
	 * <b>That sentence read „two more {@link CompetitorApi} hands the caller on his own
	 * row" until that day</b>, and it is corrected rather than deleted because what
	 * changed is a fact about the portal and not a wording. What this route adds is
	 * therefore no longer only ADDRESSING for two of them: the caller no
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
	 *                     is on the key. <b>THE CLAUSE WAS {@link CompetitorApi}'S WORD FOR
	 *                     WORD UNTIL 25.09.2026 AND IS NOW SIMPLY THE CLAUSE</b>: P26a took
	 *                     the second home away, so there is nothing left for it to agree
	 *                     with, and what holds it is the pair of cases named on this class
	 *                     rather than a twin. Never absent: a {@code count} answers a
	 *                     number even when nobody was brought in.
	 *
	 *                     <p><b>AND IT IS NOT HIS BALANCE, WHICH IS THE CORRECTION OF
	 *                     27.09.2026.</b> Until then the screen multiplied this count by the
	 *                     referral row of the price list and called the product a balance, and
	 *                     that was wrong in two ways at once. It counts members whose fee is
	 *                     standing NOW, while PDL 11.08.2026 says „Balans ne propada nikad i
	 *                     prenosi se iz sezone u sezonu" - so a referral that lapses would take
	 *                     back a reward that was earned; and a product of a count knows nothing
	 *                     of what has been SPENT, which since 26.09.2026 is a thing that happens.
	 *
	 *                     <p><b>The balance itself is NOT answered here, and that is deliberate.</b>
	 *                     It is served by {@code GET /api/me/membership}, which is the route the one
	 *                     screen that shows a balance ({@code pages/member/Membership.tsx}) has to
	 *                     call anyway for the fee and the payment code. This route is read by every
	 *                     request whether the screen wants it or not, and the reasoning
	 *                     {@link MyApplicationsApi} is written with applies exactly: reading the
	 *                     book here would cost every caller of {@code /api/me} a query for a
	 *                     question one screen asks. So the count keeps its own meaning, which is
	 *                     worth showing („you have brought in six people"), and the money has one
	 *                     home and it is the book
	 *
	 * <p><b>THE ELEVEN THAT FOLLOW ARE THE PROFILE, since 10.10.2026</b>, and each is the
	 * fact {@link CompetitorApi.Competitor} answers under the same name, WITHOUT the withholding
	 * that record applies to a hidden profile: this is his own page, and nothing about himself is
	 * hidden from him (see the class). Every one is read off the row {@code recordOf} already
	 * reads, so none of them can come from somebody else's.
	 *
	 * @param firstName    never absent: {@code competitor_first_name_not_blank} (V7)
	 * @param lastName     never absent, for the same reason
	 * @param gender       {@code M} or {@code F} and nothing else
	 *                     ({@code competitor_gender_known}, V7), so there is no branch for a third
	 * @param city         the town's name out of the codebook when the town came from it, and the
	 *                     typed one otherwise: the same {@code coalesce} {@link CompetitorApi}
	 *                     reads, written where it is read for the reason the country is
	 * @param firstSeason2027 whether he runs in the beginners' category (PDL P7). Never absent:
	 *                     the column is NOT NULL
	 * @param teamSince    the season the membership that has NOT ENDED began in, and ABSENT
	 *                     exactly when {@code teamId} is: the two halves of the link to a team
	 *                     come off one joined row, so a club is never named without its year
	 * @param bio          what he has written about himself and a moderator has approved, which
	 *                     is the column and never the text that waits in the queue. Empty for most
	 *                     members and never absent: the column is NOT NULL and may be {@code ""}
	 * @param profileHidden whether he has hidden his page from readers who may not read a hidden
	 *                     one. Answered to HIM too: the setting is his, and the screen that lets
	 *                     him change it has to know where it stands
	 * @param birthdayShown what he chose about his birthday ({@code none}, {@code year} or
	 *                     {@code full}), which the portal needs in order to draw the card at all.
	 *                     The date itself never leaves, to him or to anybody
	 * @param photo        where his approved portrait is asked for, as the whole address, and
	 *                     ABSENT for a member who has none. The address is the DIGEST of the
	 *                     content and never {@code photo.id}, which is countable (see
	 *                     {@link PhotoApi})
	 * @param crop         which circle of it is drawn, and ABSENT exactly when {@code photo} is:
	 *                     the other half of the same fact, read off the same joined row
	 */
	record MyOwnRecord(@JsonInclude(JsonInclude.Include.NON_NULL) String memberNumber,
			String country, int firstSeason,
			@JsonInclude(JsonInclude.Include.NON_NULL) Long teamId,
			String membershipBasis, String referralCode, int referredCount,
			String firstName, String lastName, String gender, String city,
			boolean firstSeason2027,
			@JsonInclude(JsonInclude.Include.NON_NULL) Integer teamSince,
			String bio, boolean profileHidden, String birthdayShown,
			@JsonInclude(JsonInclude.Include.NON_NULL) String photo,
			@JsonInclude(JsonInclude.Include.NON_NULL) CompetitorApi.Crop crop) {
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
						/* AND HOW MANY HE HAS BROUGHT IN WHOSE FEE IS STANDING.

						   THIS SAID „word for word `CompetitorApi`'s" UNTIL 25.09.2026, and the
						   twin it named is gone: P26a took both facts off the public list, so
						   this is the only clause there is. What stops it drifting is no longer
						   a second copy to compare with but the fixture underneath
						   `andHowManyHeBroughtInWhoseFeeStands`, arranged so that every wrong
						   way of counting answers a different number.

						   Cast, because `count(*)` is a bigint and what comes back is read as
						   a whole number that fits the portal's own type. */
						+ " cast((select count(*) from competitor brought"
						+ "  where brought.referred_by = c.id and brought.active) as integer)"
						+ "  as referred_count,"
						/* THE PROFILE, WHICH IS WHAT HIS OWN PAGE IS DRAWN FROM (class note). The
						   names and the town are read the way `CompetitorApi` reads them, and
						   NOTHING here is gated on whether the profile is hidden: it is his own,
						   and this query has no `THE_PROFILE_IS_OPEN_TO_THE_CALLER` on purpose.
						   `bio` is the column a moderator's approval wrote, never the queue's
						   text, and the portrait comes off `c.photo_id` for the same reason
						   (see the join below). */
						+ " c.first_name, c.last_name, c.gender,"
						+ " coalesce(town.name, c.city) as city,"
						+ " c.first_season_2027, m.season_from as team_since,"
						+ " c.bio, c.profile_hidden, c.birthday_shown,"
						/* THE PORTRAIT AND ITS SQUARE, ONE FACT ASKED FOR IN ONE BREATH: all four
						   come off the same joined row, every column of which is NOT NULL (V8), so
						   they are present together or not at all. The digest is the address and
						   `portrait.id` never is. */
						+ " portrait.digest, portrait.crop_x, portrait.crop_y,"
						+ " portrait.crop_diameter"
						+ " from competitor c"
						+ " left join place town on town.id = c.place_id"
						+ " left join country town_country on town_country.id = town.country_id"
						+ " left join country typed_country on typed_country.id = c.country_id"
						/* THE PORTRAIT A MODERATOR HAS APPROVED: `c.photo_id` and never
						   `verification.photo_id`, which is what nobody has looked at yet and what
						   ADL A60 does not make public. Nothing in this FROM reaches the queue, so
						   a waiting picture cannot arrive here by any arrangement of the data. A
						   `left join`, because a member with no portrait is an ordinary member. */
						+ " left join photo portrait on portrait.id = c.photo_id"
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
				.query((row, one) -> {
					/* Exact decimal all the way out, never a double: `CompetitorApi` and `TeamApi`
					   say why about the same three numbers (V21 chose `numeric(9, 8)`). Every
					   column of `photo` is NOT NULL (V8), so each of these is null exactly when
					   no row joined, and the two are read side by side rather than one from the
					   other so that the answer says what the row says. */
					String portrait = row.getString(17);
					BigDecimal across = row.getBigDecimal(18);

					return new MyOwnRecord(row.getString(1), row.getString(2), row.getInt(3),
							row.getObject(4) == null ? null : row.getLong(4),
							row.getString(5), row.getString(6), row.getInt(7),
							row.getString(8), row.getString(9), row.getString(10),
							row.getString(11), row.getBoolean(12),
							row.getObject(13) == null ? null : row.getInt(13),
							row.getString(14), row.getBoolean(15), row.getString(16),
							/* The digest and never the key, and never the empty path for a member
							   who has no portrait: an empty path is an address a browser would ask
							   for. */
							portrait == null ? null : A_PICTURE_IS_ASKED_FOR_AT + portrait,
							across == null ? null
									: new CompetitorApi.Crop(across, row.getBigDecimal(19),
											row.getBigDecimal(20)));
				})
				.single();
	}
}
