package com.btl.portal.web;

import com.btl.portal.domain.category.Category;
import com.btl.portal.domain.season.SeasonClock;
import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
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
 * <p><b>AND SINCE 21.09.2026 WHAT REPLACES IT IS ANSWERED: the age band, which is
 * the one thing Article 74 says IS public.</b> „Datum rodjenja se nikada ne
 * prikazuje, ni u punom ni u skraćenom obliku. Javna je samo kategorija koja iz
 * njega proizlazi." The year is the shortened form and stays; the category that
 * comes out of it is the sentence's second half and it had been owed since
 * 13.09.2026, when B52 took the year off {@code public/mock/competitors.json} and
 * put the band there instead. Until this increment the debt was carried as a NAME
 * in {@code CompetitorApiTest} rather than as a field, so that it could not be
 * forgotten; the name is gone because the field is here.
 *
 * <p><b>THE BAND AND NEVER THE FINISHED CODE, so that the sex is not written
 * twice.</b> PDL, 13.09.2026, measured and decided exactly this: the served record
 * carries „pojas a ne gotovu šifru, da pol ne bi bio zapisan dvaput". So this
 * answers {@code 24-}, {@code 25-39}, {@code 40-54} or {@code 55+}, with no
 * {@code M} and no {@code Ž} in it, and {@code gender} is the field beside it.
 * {@code frontend/src/data/categories.ts} puts the two together in
 * {@code categoryCodeFor}, and that is where the mark belongs. Answering
 * {@code M40-54} here would publish the same fact twice and give the screen a
 * second, disagreeing home for it.
 *
 * <p><b>AND THE BEGINNERS' CATEGORY IS NOT THIS FIELD AND IS NOT ANSWERED
 * INSTEAD OF IT.</b> A member in his first season carries {@code R} rather than a
 * band (PDL P7, owner 03.08. and 11.08.2026), but which of the two a screen draws
 * is decided by {@code firstSeason2027}, which this resource already answers, and
 * the band is answered BESIDE it rather than replaced by it - exactly as the
 * served file does for all thirty two members. Whether somebody may still be in
 * that category depends on his whole history of points, which this server does not
 * have yet; nothing here needs it, because nothing here chooses between the two.
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
 * <p><b>TWO OF THEM CAME BACK HERE ON 20.09.2026 AND LEFT AGAIN ON 25.09.2026, and
 * the round trip is worth keeping because of what the second half measured.</b>
 * P-javno (ADL, 13.09.2026) put everything Article 73 does not list „iza resursa
 * koji zna ko pita"; this route knows, so his own referral link
 * ({@code referralCode}) and his count of whom he brought in ({@code referredCount})
 * were answered here on the caller's own row and on nobody else's.
 *
 * <p><b>That shape was right about who may read them and wrong about WHICH member it
 * could reach.</b> This query ends {@code where c.active}, so the member whose fee
 * has LAPSED has no row here and never reached the condition at all - and he is
 * exactly the man V24 section 6 promises the link to: „Svaki clan ima licni link za
 * preporuku... koji vam stoji ispisan na vasoj strani „Moja clanarina"", which is the
 * page he opens to renew. Signed in with his own cookie he was answered neither
 * field, while a member whose fee stood was answered both.
 *
 * <p><b>OWNER, 25.09.2026 (PDL P26a): the link „se sklanja sa javne liste takmicara"
 * and stays only on „Moja clanarina".</b> Both fields are the caller's OWN business
 * rather than anything Article 73 makes public, so the answer everybody may read is
 * not where they belong under any condition. They are answered by {@link MeApi},
 * which reads ONE row and that row is his, whether or not his fee is standing - and
 * that class had already named the two homes as a boundary waiting for this word.
 * ADL A8 is kept either way: „kod preporuke i godina rodjenja idu iskljucivo kroz
 * endpoint koji trazi prijavu, i nikad u odgovor koji vidi posetilac."
 *
 * <p><b>What that buys, and it is a claim this resource could not make while they
 * were here:</b> a signed in member is answered what a visitor is, to the byte.
 * {@code theVisitorsAnswerHasNotMoved} used to cut two fields out before comparing;
 * it now compares whole answers, and the cut is gone rather than adjusted.
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
 * oneself; what every reader of it wanted is a COUNT, and since 25.09.2026 the one
 * place that answers it is {@link MeApi}.
 *
 * <p>All of these omissions are the reason this resource exists. PDL, 06.09.2026,
 * measured and named exactly these fields as the ones that cannot leave the
 * public file „dok portal nema bekend", because one file was serving the public
 * side, the member's own screens and the administration at once. This is that
 * backend, and it must not repeat the file it replaces. <b>TWO audiences out of one
 * resource since 25.09.2026 and not three</b>: the public side is the answer below,
 * the administration is the field this paragraph is about, and the member's own
 * screens are {@link MeApi}, whole. The member's two fields stood here between
 * 20.09.2026 and 25.09.2026 and P26a sent them to the door that answers him whether
 * or not his fee is standing.
 *
 * <p><b>There were five of these names until 21.09.2026 and there are four, because
 * the age band was never one of them.</b> It stood in that list as a DEBT rather
 * than a refusal - the one name there that Article 74 makes public - and the list
 * is checked both ways, so answering the band is what took it out. The four that
 * are left are withheld for good.
 *
 * <p>All four names are named at the call site in {@code CompetitorApiTest},
 * with the reason, and each one is checked to be one the portal really serves. A
 * field that went missing by accident and one left out on purpose look the same
 * from a test; this is what tells them apart. <b>Three of the four are omissions
 * from EVERY answer again, which they had stopped being for four days</b>, and the
 * cases say which is which: {@code noReferralCodeLeavesTheServer} asks EVERY kind of
 * caller's answer for every code in the database, and
 * {@code theAdministrationIsTheOnlyOneToldHowAMembershipIsHeld} asks the answers of
 * all five kinds of caller for the basis, which is the one that still depends on who
 * is asking.
 *
 * <p><b>AND SINCE 26.09.2026 THE PORTRAIT LEAVES HERE, which is the one home of what a
 * member looks like.</b> PDL P28c, owner: „po odobravanju slike ona tog trenutka pocinje da
 * se vidi na svim avatar mestima (u rang listama, profilnoj sekciji, gornjem desnom
 * zaglavlju ulogovanog korisnika itd.)" Every circle in the portal is drawn by
 * {@code frontend/src/components/Portrait.tsx}, which takes a whole {@code Competitor}, and
 * the header of the signed in member finds its own record in this very answer
 * ({@code frontend/src/app/AccountMenu.tsx}). So there is one route to teach and not nine,
 * and P28c says so in as many words: „Krug dobija JEDAN dom."
 *
 * <p><b>The address is the DIGEST and never {@code photo.id}</b>, and it is
 * {@link PhotoApi}'s arrangement arriving at its second publisher rather than a choice made
 * again here (ADL A60, 20.09.2026). A key is countable, so an address built on one would let
 * anybody walk 1, 2, 3 and learn which rows the portal holds; sixty four hexadecimal
 * characters are not walked. {@link TeamApi} publishes a team's mark the same way and for
 * the same reason, and {@code CompetitorApiTest} hands the address this builds back to the
 * dispatcher rather than comparing two spellings, so a rename is caught by the route.
 *
 * <p><b>The portrait and its square are two halves of one fact and leave together</b>, the
 * same rule {@link TeamApi} keeps for a mark. Here they leave together BY CONSTRUCTION
 * rather than by two conditions agreeing: all four columns come off one joined row, so there
 * is no arrangement of the data in which one of them is there and the others are not. Null
 * and never the empty path for a member who has none, which
 * {@code frontend/src/data/types.ts} refuses in as many words about a team - „a team that
 * has none is not a team whose logo is the empty path" - and an empty path is an address a
 * browser would ask for. Null is also what the portal already reads as „the whole picture"
 * ({@code frontend/src/components/crop.ts}).
 *
 * <p><b>AND THE PICTURE THAT IS WAITING IS NOT THE PICTURE THAT IS ON THE PROFILE.</b>
 * {@code competitor.photo_id} is what a moderator has approved and
 * {@code verification.photo_id} is what he has not yet looked at; ADL A60 makes the first
 * public and the second not, and PDL P28a says why - „Profilnu sliku administrator odobrava
 * pre objave". So this reads the column ON THE MEMBER and never the queue, and it is the
 * DIGEST that must not leave rather than only the bytes: {@link PhotoApi} already refuses
 * bytes no public holder points at, but a digest answered here would tell a visitor that
 * this member has a picture in moderation, and tell whoever holds the file that it is that
 * one. {@code aPictureWaitingForAModeratorIsNobodysPortrait} reads the whole answer as text
 * for every kind of caller, and
 * {@code aMemberWhoseOnlyPictureIsWaitingCarriesNoPortrait} is the half a {@code coalesce}
 * of the two columns would otherwise pass.
 *
 * <p><b>A hidden profile is still in this list, and since 26.09.2026 its PORTRAIT is the one
 * thing on the list that hiding takes away.</b> Hiding a profile is about the
 * profile PAGE (PDL P23); the member number and the name stay public (Article
 * 73), and the portal needs the flag in order to know what to draw. Deleting a
 * member is the other door and it takes the row with it. A lapsed fee is a third
 * door and it is the one above: it takes the member off the list without taking
 * anything away from them.
 *
 * <p><b>Why the portrait is the exception, and it is a decision rather than a reading of
 * mine.</b> ADL A60 left one boundary open in as many words - „`competitor.photo_id` se
 * tretira kao javan bez obzira na `profile_hidden`" - and named what would close it: „Prvi
 * resurs koji ga objavi mora u istom potezu da donese pravilo o skrivenom profilu, inace
 * granica pada tog dana." This is that resource. <b>[ODLUKA 26.09.2026, owner]</b>, chosen
 * between three offered: the digest is withheld from a caller who is not signed in, AND
 * {@link PhotoApi} refuses such a portrait to the same caller. The two offers refused were
 * to call the digest public outright, and to withhold it here alone - the second on the
 * measurement that the digest IS the whole permission, because {@link PhotoApi} asked nobody
 * who was calling, so a member could pass the address on and any visitor would get the
 * bytes. PDL, 06.09.2026 already puts the photograph among what hiding hides.
 *
 * <p><b>Hidden from a caller who is NOT SIGNED IN, and from nobody else</b>, which is the
 * owner's own limit: „Takmicar od ulogovanih kolega ne moze da sakrije profil" (PDL,
 * 06.09.2026), with the reason in the published policy - „ali ne i od ostalih clanova, jer bi
 * time nestao smisao zajednickog rangiranja". {@code frontend/src/profile/visible.ts} is the
 * one home of the same sentence on the other side.
 *
 * <p><b>What that does NOT cover, named rather than left to be found.</b> The fee is not part
 * of this rule: {@link PhotoApi} goes on answering the portrait of a member whose fee has
 * lapsed to anybody holding the digest. It cannot be got from here - such a member is not on
 * this list at all - and no decision covers it, so nothing is invented for it. The biography
 * is the other one: PDL, 06.09.2026 names it beside the photograph among what hiding hides,
 * and this resource answers it to everybody. <b>[ODLUKA 26.09.2026, owner]</b> the same rule
 * applies to it, and it is its own increment so that this one does not grow past the change
 * it is measuring.
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

	/**
	 * WHERE A PICTURE IS ASKED FOR, and the name that follows is its digest.
	 *
	 * <p>The same text {@link PhotoApi} maps and {@link ApiSecurity} opens, and
	 * {@link TeamApi} already keeps a literal of its own for a team's mark. Kept as a literal
	 * here too rather than reached for through any of the three, for the reason that one
	 * writes out: a constant copied is only ever as good as what proves it equal, and what
	 * proves it is {@code thePortraitIsTheAddressOfThatMembersOwnPicture}, which hands the
	 * address this builds back to the dispatcher and requires it to arrive at
	 * {@link PhotoApi}. A rename that left this behind is caught by the route and not by a
	 * comparison of two strings.
	 */
	private static final String A_PICTURE_IS_ASKED_FOR_AT = "/api/photos/";

	private final JdbcClient db;

	private final WhatHeMayDo mayHe;

	private final Clock clock;

	/**
	 * <b>{@code MemberOfAccount} was the fourth of these until 25.09.2026 and is gone with
	 * the question it answered.</b> This route asked WHICH MEMBER the caller is, for the
	 * two fields his own row carried; P26a took both off the answer, so the only thing
	 * left to ask about the caller is whether he is the administration - and that is a
	 * question about the ACCOUNT. A resource that no longer needs to know who anybody is
	 * should not be holding the thing that tells it.
	 */
	CompetitorApi(JdbcClient db, WhatHeMayDo mayHe, Clock clock) {
		this.db = db;
		this.mayHe = mayHe;
		this.clock = clock;
	}

	/**
	 * THE SEASON THE BAND IS WORKED OUT FOR, which is the one that is RUNNING and never
	 * earlier than the first the league has.
	 *
	 * <p><b>One season and never a band per season, and that is a measurement rather
	 * than a simplification.</b> PDL, 13.09.2026: a map of band-by-season „vraća tačnu
	 * godinu rođenja" for 25 of the 32 members, because a member who crosses a boundary
	 * narrows the candidate years to one. „Iz jednog pojasa za tekuću sezonu ne vraća se
	 * ni za jednog, jer je najuži skup kandidata širok petnaest godina." So the year is
	 * private BECAUSE only one season is answered, and answering a second would hand
	 * back the very field this resource was written to withhold. The cost is written
	 * down in the same place and accepted: a screen drawing a category for an earlier
	 * season draws today's band.
	 *
	 * <p><b>Read off the {@link Clock} bean and in the league's own zone</b>, for the
	 * reason {@code ResultApi} writes beside its own: a server kept in UTC, as
	 * containers are, would still be calling it last year for the first hour of every
	 * New Year in Belgrade, and that hour is a boundary this field moves on.
	 *
	 * <p><b>And it is NOT {@code SeasonClock.seasonBeingPaidFor}.</b> That one answers
	 * from 1 October with NEXT year, which would move every member's band forward a
	 * season in the autumn without a single birthday - and the band moves once, on 1
	 * January, which is the whole of PDL P7 („uzrast se utvrđuje jednom, na 1. januar
	 * sezone"). {@code aBandDoesNotMoveWhenTheNextSeasonGoesOnSale} refuses it.
	 *
	 * <p><b>The floor under the plain calendar year is the league's first season</b>,
	 * the same {@code Math.max} shape {@code frontend/src/data/season.ts} uses: through
	 * 2026 the calendar answers 2026 and there is no season 2026 (PDL P2), so a band
	 * worked out for it is a band for a season that does not exist.
	 *
	 * <p><b>WHAT IS NOT DECIDED HERE, written down rather than left to be found.</b>
	 * From 1 January 2028 this answer and the served file part company: the generator
	 * that wrote {@code competitors.json} holds {@code SEZONA = 2027} as a literal
	 * ({@code btl-produkt/istorijski-podaci/napravi-mock.py}), so it answers 2027 for
	 * ever while this follows the running season. This is the reading PDL P7 gives - the
	 * age is settled on 1 January OF THE SEASON, so a new season settles it again - and
	 * the file's constant is an artefact of a mock built for a 2027 demo rather than a
	 * decision. It is named here because the two agree until then and a disagreement
	 * that starts on a date nobody is watching is the kind that gets found by a member.
	 */
	private int theBandsSeason() {
		return Math.max(SeasonClock.FIRST_SEASON,
				LocalDate.now(clock.withZone(SeasonClock.ZONE)).getYear());
	}

	/**
	 * Which circle of the portrait is drawn, as three fractions between 0 and 1.
	 *
	 * <p>The same three numbers and the same names {@link TeamApi.Crop} answers for a team's
	 * mark, because it is the same fact about a different thing, and the portal reads both
	 * through one piece of arithmetic ({@code frontend/src/components/crop.ts}).
	 *
	 * @param size the diameter, as a fraction of the picture's shorter edge. The column is
	 *             {@code crop_diameter} since V21 and the portal's word is {@code size};
	 *             {@link TeamApi} writes out why the answer carries the portal's, and it
	 *             matters which way round: {@code cropIn} asks for {@code size} and quietly
	 *             returns the whole picture for a record without it, so answering
	 *             {@code diameter} would lose every crop without one error anywhere
	 */
	record Crop(BigDecimal x, BigDecimal y, BigDecimal size) {
	}

	/**
	 * @param photo          where this member's portrait is asked for, or NULL for a member
	 *                       who has none - and for a member who hides his profile when
	 *                       nobody is signed in, which is the same shape on purpose. PDL,
	 *                       06.09.2026 requires that „Oba slucaja dobijaju isti ishod": told
	 *                       apart, the absence would say „this member has a picture and I am
	 *                       not showing it to you", which names him as one of the members who
	 *                       hide. Null and never the empty path: see the note on this class
	 * @param crop           the square of the portrait, or null for a member who has no
	 *                       portrait in this answer. The other half of {@code photo} and
	 *                       never answered without it
	 * @param birthdayShown  what the member chose about their birthday, which the
	 *                       portal needs in order to draw the card at all
	 * @param ageBand        the band alone and never the finished code, so the sex is
	 *                       not written twice: see the note on this class. Answered on
	 *                       every record to everybody, because Article 74 makes it the
	 *                       one thing about a date of birth that IS public, and it does
	 *                       not depend on {@code birthdayShown} - that choice hides the
	 *                       date, not the category it produces (PDL, 06.09.2026)
	 * @param membershipBasis on what basis the membership on THIS record is held, on
	 *                       every record of an answer the administration asked for and
	 *                       ABSENT from every record of anybody else's - a visitor's, a
	 *                       member's own included, and a signed in moderator who does
	 *                       not hold {@link #OVER_THE_MEMBERS}. Absent rather than null
	 *                       or empty: „I am not telling you" and „he pays nothing" must
	 *                       not be the same shape, and a key carrying null is a key the
	 *                       next change fills in.
	 *                       <p>IT IS THE LAST OF THREE SUCH COMPONENTS AND WAS THE ODD
	 *                       ONE OUT OF THEM. {@code referralCode} and
	 *                       {@code referredCount} stood beside it until 25.09.2026 and
	 *                       left together (PDL P26a); they were the CALLER'S OWN facts
	 *                       answered back to him on a public list, while this is a fact
	 *                       about everybody answered to the few who may read it
	 */
	record Competitor(String memberNumber, String firstName, String lastName, String gender,
			String city, String country, String ageBand, boolean firstSeason2027, int firstSeason,
			String bio, Long teamId, Integer teamSince, boolean profileHidden,
			String birthdayShown, String photo, Crop crop,
			@JsonInclude(JsonInclude.Include.NON_NULL) String membershipBasis) {
	}

	/**
	 * @param member who the chain worked out is asking, or NULL when nobody is: this
	 *               route is on {@code ApiSecurity.READ_BY_ANYBODY}, so an anonymous
	 *               GET reaches this method rather than being answered 401, and
	 *               Spring's resolver hands a parameter of this type nothing when the
	 *               principal is the anonymous token. Measured rather than assumed, by
	 *               {@code theVisitorsAnswerHasNotMoved}: the visitor's answer carries
	 *               the one remaining conditional field nowhere, asked by KEY over every
	 *               record. It named all three before 21.09.2026 while the case asked
	 *               about two, and a resource handing the basis to everybody walked past
	 *               it.
	 *               <p><b>AND SINCE 25.09.2026 THAT CASE ASKS SOMETHING STRONGER, because
	 *               the two fields that made the answers differ are gone</b> (PDL P26a):
	 *               a signed in MEMBER is now answered what a visitor is, to the byte,
	 *               with nothing cut out of either. That claim was not available while
	 *               those two existed.
	 *               <p><b>AND SINCE 26.09.2026 IT HOLDS OF EVERY FIELD BUT ONE, which is
	 *               said here rather than left for the case to carry alone.</b> A session
	 *               now decides one thing: whether a member who hides his profile has his
	 *               portrait answered ([ODLUKA 26.09.2026, owner]; see the note on this
	 *               class). So the two answers are equal with the PORTRAITS BLANKED on both
	 *               sides and with nothing else cut, and the case says so out loud - it
	 *               first requires that the two really DO differ before the blanking, so
	 *               the normalisation cannot become the thing that makes it pass
	 */
	@GetMapping("/api/competitors")
	List<Competitor> competitors(@AuthenticationPrincipal WhoIsAsking.Member member) {
		/* WHO IS ASKING IS ONE QUESTION HERE AND IT WAS TWO UNTIL 25.09.2026.

		   „Which member is the caller" used to be asked as well, for the two fields his
		   own row carried. P26a took both off this answer, so the only thing left to ask
		   is whether he is the administration - and this route no longer needs to know
		   which member anybody is. `MemberOfAccount` left the constructor with the
		   question.

		   IT IS ASKED OF THE ACCOUNT AND NEVER OF THE MEMBER: a moderator who does not
		   race has no member at all (V23), so reading it off a member would refuse the
		   ordinary case outright.

		   `member != null` is not a nicety here. This is the first route to ask „may
		   he" while standing on `ApiSecurity.READ_BY_ANYBODY`, so the principal of a
		   visitor is Spring's anonymous token; the overload takes the caller rather
		   than reaching for the context, and its own note says what that is for. */
		boolean administration = member != null && mayHe.may(member, OVER_THE_MEMBERS);

		/* AND WHETHER ANYBODY IS ASKING AT ALL, which is a second question and not the one
		   above. It decides one thing only: whether a hidden member's portrait leaves (PDL
		   P23 and the decision of 26.09.2026, see the note on this class).

		   IT IS READ OFF THE ACCOUNT, and that is the same trap the line above avoids rather
		   than a repetition of it. An account that does not race has no member at all (V23,
		   owner 14.09.2026), so a condition asked of the caller's MEMBER would hide a hidden
		   member's portrait from a signed in caller - and the rule is about a reader who is
		   NOT signed in, which he is. This route stopped asking which member anybody is on
		   25.09.2026 (P26a) and it does not start again: „is there a session" is the whole
		   question, and `aHiddenProfilesPortraitLeavesToEverybodyWhoIsSignedIn` walks an
		   account with no member of its own for exactly that reason.

		   IT IS NOT `!administration` EITHER: the portal's word is „ne i od ostalih clanova,
		   jer bi time nestao smisao zajednickog rangiranja", so every member sees it and not
		   only the administration. */
		boolean signedIn = member != null;

		/* AND THE SEASON THE BANDS BELOW ARE WORKED OUT FOR, read ONCE for the whole
		   answer rather than per row. Two members with the same year of birth must come
		   back in the same band, and a clock read inside the mapper can cross midnight
		   on 1 January between two rows of one list - which is the one night of the year
		   this field moves on. `theBandsSeason` says which season it is and why. */
		int season = theBandsSeason();

		return db.sql("select c.member_number, c.first_name, c.last_name, c.gender,"
						+ " coalesce(town.name, c.city) as city,"
						+ " coalesce(town_country.code, typed_country.code) as country,"
						+ " c.first_season_2027, c.first_season,"
						+ " c.bio, m.team_id, m.season_from as team_since,"
						+ " c.profile_hidden, c.birthday_shown,"
						/* THE CALLER'S OWN REFERRAL LINK AND HIS COUNT OF WHOM HE BROUGHT IN
						   STOOD HERE UNTIL 25.09.2026, each as `case when c.id = :me then ...`.
						   Both are gone and neither moved: {@link MeApi} already answered both,
						   word for word, and that class named the two homes as a boundary
						   waiting for the owner's word.

						   OWNER, 25.09.2026 (PDL P26a): the personal referral link „se sklanja
						   sa javne liste takmicara" and stays only on „Moja clanarina". The
						   reason is not tidiness but a measurement: this query ends
						   `where c.active`, so the member whose fee has LAPSED never reached
						   the `case` at all - and he is exactly the man V24 section 6 promises
						   the link to, on exactly the page he opens to renew.

						   ONE FACT, ONE HOME, AND THE HOME IS THE ONE THAT ANSWERS HIM. Both
						   facts are a caller's own business rather than anything Article 73
						   makes public, so a list anybody may read is not where they belong at
						   any condition. What is left of the caller below is the basis, and its
						   condition is the CALLER rather than the row - which is the difference
						   that outlived the two that are gone.

						   AND THE BASIS, ON EVERY ROW OR ON NONE. The condition is the CALLER
						   and never the row, and that is why it is the one that stayed: it is a
						   fact about everybody, answered to the few who may read it, rather
						   than a caller's own fact answered back to him on a public list.
						   Written as `c.id = :me` it would hand the administration its own
						   basis and nothing else, and
						   `aModeratorOverTheMembersIsToldHowEveryMembershipIsHeld` refuses that.

						   EVERY ROW MEANS THE CALLER'S OWN ROW AS WELL, and that is measured
						   since 21.09.2026 rather than read off this sentence. `... and c.id is
						   distinct from :me` - the whole list except the one asking - left all
						   21 cases green until an administration account was put ON the list,
						   because neither of the two there had a row in the answer at all.
						   `theAdministratorsOwnRowCarriesTheBasisLikeEveryOther` is what
						   refuses it now.

						   FALSE ANSWERS NULL AND NOT AN EMPTY STRING, so `@JsonInclude` leaves
						   the key out and the answer of everybody else is what it was to the
						   byte.

						   CAST, for the reason `TeamApi` writes out beside its own: a parameter
						   standing alone in a `case` has no neighbour to take a type from and
						   PostgreSQL refuses the statement rather than guessing. */
						+ " case when cast(:administration as boolean)"
						+ "  then c.membership_basis end as membership_basis,"
						/* AND THE YEAR, WHICH IS READ HERE AND LEAVES NOWHERE. It is the
						   input the band is worked out from and it is the one field on this
						   table the privacy policy is written about, so it is taken LAST and
						   turned into a band before anything is built out of the row: it
						   reaches a local and never a component of `Competitor`.

						   THE YEAR AND NOT THE DATE, although the table holds the date since
						   V8 and `birth_year` is generated off it. `Category` takes a year on
						   purpose and says why: „the day is not part of the question, and
						   taking it would invite somebody to use it." Selecting `birth_date`
						   here to pass the same year would carry the day as far as this
						   method for no reason at all.

						   `noYearOfBirthLeavesTheServer` reads the whole answer as TEXT
						   rather than by field name, so it refuses the year however it is
						   spelt and whatever it is called - which is what makes reading it
						   here safe to do rather than merely intended to be. */
						/* AND THE PORTRAIT AND ITS SQUARE, WHICH ARE ONE FACT AND ARE ASKED FOR
						   IN ONE BREATH, exactly as `TeamApi` asks for a team's mark. The digest
						   is what the picture is asked for BY (PhotoApi, ADL A60) and never
						   `mine.id`, which is countable. `crop_diameter` and not `crop_side`: V21
						   renamed it when the three became fractions.

						   ALL FOUR COME OFF THE SAME JOINED ROW, so „the portrait and its square
						   leave together or neither does" is the shape of the answer rather than
						   four conditions that have to agree - and the rule about a hidden
						   profile is therefore written ONCE, on the join below, rather than four
						   times here. A `case` per column is the shape that can drift; this one
						   cannot.

						   THEY STAND BEFORE THE YEAR rather than after it, so that the sentence
						   below stays true: the year is still the LAST column read. */
						+ " mine.digest, mine.crop_x, mine.crop_y, mine.crop_diameter,"
						+ " c.birth_year"
						+ " from competitor c"
						+ " left join place town on town.id = c.place_id"
						+ " left join country town_country on town_country.id = town.country_id"
						+ " left join country typed_country on typed_country.id = c.country_id"
						/* The membership that has not ended: a member is in one team at a time
						   (V11), and the season it started in is what the portal draws beside the
						   club's name. */
						+ " left join team_membership m on m.competitor_id = c.id"
						+ "  and m.season_to is null"
						/* THE PORTRAIT THE MODERATOR HAS APPROVED, AND THE ONE RULE ABOUT A
						   HIDDEN PROFILE, IN ONE PLACE.

						   `c.photo_id` AND NEVER `verification.photo_id`: the first is what has
						   been approved and the second is what nobody has looked at yet, and ADL
						   A60 makes only the first public. Nothing in this FROM clause reaches
						   the queue at all, which is why a waiting picture cannot arrive here by
						   any arrangement of the data rather than by a condition somebody has to
						   remember.

						   LEFT, because a member with no portrait is an ordinary member and not
						   a member missing from the list. `photo.id` is the primary key, so this
						   joins at most one row and a member still comes back once.

						   AND THE CONDITION IS ON THE JOIN, WHICH IS WHAT MAKES IT ONE RULE. For
						   a member who hides his profile and a caller who is not signed in the
						   row simply does not join, so the digest is never read, the square is
						   never read, and the answer is byte for byte the answer of a member who
						   has no portrait at all - which is what PDL, 06.09.2026 requires („Oba
						   slucaja dobijaju isti ishod"). Written as a `case` over the digest it
						   would be four cases, and a fifth column tomorrow would be a fifth.

						   THE PARAMETER IS CAST because it stands alone as an operand of `or`
						   with nothing beside it to take a type from, which is the same refusal
						   `TeamApi` writes out beside its own („could not determine data type of
						   parameter") and the same shape `:administration` takes above. */
						+ " left join photo mine on mine.id = c.photo_id"
						+ "  and (cast(:signedIn as boolean) or not c.profile_hidden)"
						/* AND ONLY THE MEMBERS WHOSE FEE IS STANDING, which is the whole of what
						   this resource is allowed to say about a fee. PDL P11: „Status clanarine
						   se ne prikazuje na profilu... ko nije platio, ne vidi se nigde osim u
						   istorijskim godinama." Owner, 13.09.2026, asked which shape that takes
						   here, chose this one over serving the flag: a member whose fee has
						   lapsed is not on this list at all. */
						+ " where c.active"
						+ " order by c.member_number")
				.param("administration", administration)
				.param("signedIn", signedIn)
				.query((row, one) -> {
					/* Exact decimal all the way out, never a double, which is `TeamApi`'s own
					   sentence about the same three numbers: V21 chose `numeric(9, 8)` because
					   the rule is about the exact boundaries 0 and 1, and a binary fraction
					   cannot be trusted at one.

					   EVERY COLUMN OF `photo` IS NOT NULL (V8), so each of these two is null
					   exactly when no row joined - which is a member with no portrait, or a
					   member hiding his profile from a caller who is not signed in. They are
					   read side by side rather than one from the other so that the answer says
					   what the row says. */
					String portrait = row.getString(15);
					BigDecimal across = row.getBigDecimal(16);

					return new Competitor(row.getString(1), row.getString(2),
						row.getString(3), row.getString(4), row.getString(5), row.getString(6),
						/* THE RULE IS ASKED FOR, NEVER REPEATED HERE. `Category` is where the
						   league's bands live and where the decision that age is settled on 1
						   January rather than on the birthday is written down (PDL P7, changed
						   from the 2017 rulebook). A second copy of that arithmetic in a
						   mapper is a second place to fix when a band moves. */
						Category.ageBandFor(row.getInt(19), season).code(),
						row.getBoolean(7), row.getInt(8), row.getString(9),
						row.getObject(10) == null ? null : row.getLong(10),
						row.getObject(11) == null ? null : row.getInt(11),
						row.getBoolean(12), row.getString(13),
						/* The digest and never the key, and never the empty path for a member
						   who has no portrait: an empty path is an address a browser would ask
						   for. */
						portrait == null ? null : A_PICTURE_IS_ASKED_FOR_AT + portrait,
						across == null ? null
								: new Crop(across, row.getBigDecimal(17), row.getBigDecimal(18)),
						row.getString(14));
				})
				.list();
	}
}
