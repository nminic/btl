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
import java.time.ZonedDateTime;
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
 * <p>What followed from that was owed, and is answered since 10.10.2026 in two
 * places that together know such a member: {@code GET /api/me} ({@link MeApi})
 * answers him the page of his own profile and nobody else (PDL P8, 25.09.2026,
 * „Treba da moze da otvori svoj profil dokle god postoji"), and
 * {@code GET /api/results} carries his name on the results of the seasons he was
 * a member in (PDL P23, 03.10.2026, „Ime ide uz stari rezultat člana kome je
 * istekla članarina"). Neither is this resource, which stays what it was: the
 * members whose fee is standing.
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
 * were here:</b> a signed in member is answered what a visitor is, to the byte, apart from what
 * hiding moves for a reader who may read a hidden profile (below).
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
 * {@code AdminMembers.tsx} draws it as a tag. Until 27.09.2026 there was a second
 * reason - that no row of the table existed for anybody the fee had been forgiven,
 * „because the screen that grants an honorary membership does not exist yet and no such
 * row is ever written (PDL, B50)". {@link MembershipWriteApi} writes them now, and it
 * writes BOTH homes for exactly this reason, so what this resource answers is unchanged
 * and the boundary is again the one it always was: the column is what the portal reads.
 * Moving the fact is still the increment that removes {@code competitor.active}, and it
 * moves both homes and all eight readers at once.
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
 * member looks like.</b> PDL P28f, owner: „po odobravanju slike ona tog trenutka pocinje da
 * se vidi na svim avatar mestima (u rang listama, profilnoj sekciji, gornjem desnom
 * zaglavlju ulogovanog korisnika itd.)" Every circle in the portal is drawn by
 * {@code frontend/src/components/Portrait.tsx}, which takes a whole {@code Competitor}, and
 * the header of the signed in member finds its own record in this very answer
 * ({@code frontend/src/app/AccountMenu.tsx}). So there is one route to teach and not nine,
 * and P28f says so in as many words: „Krug dobija JEDAN dom."
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
 * <p><b>A hidden profile is still in this list, and what hiding takes off its record - from a
 * reader who is neither an active member nor the administration - is what a profile page would
 * have shown: the portrait since 26.09.2026, the biography since 27.09.2026 and the link to his
 * team since 02.10.2026.</b>
 * Each of the three has its own decision and its own paragraph below. Hiding a profile is about the
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
 * between three offered: the digest is withheld from a caller who may not read a hidden profile,
 * AND {@link PhotoApi} refuses such a portrait to the same caller. The two offers refused were
 * to call the digest public outright, and to withhold it here alone - the second on the
 * measurement that the digest IS the whole permission, because {@link PhotoApi} asked nobody
 * who was calling, so a member could pass the address on and any visitor would get the
 * bytes. PDL, 06.09.2026 already puts the photograph among what hiding hides.
 *
 * <p><b>Hidden from everybody who is NEITHER AN ACTIVE MEMBER NOR THE ADMINISTRATION, and from
 * nobody else.</b> The owner's own limit was „Takmicar od ulogovanih kolega ne moze da sakrije
 * profil" (PDL, 06.09.2026), and until 03.10.2026 this resource read „ulogovanih" as „anybody
 * with a session". The owner chose otherwise between offered outcomes (PDL P23, 03.10.2026,
 * „Skrivanje deluje prema svakome ko nije aktivan član ni administracija,
 * nikad prema aktivnom članu"): the other member is a
 * member activated for the season, and the administration, so a free account and a member
 * whose fee has lapsed are answered what a visitor is. The reason in the published policy -
 * „ali ne i od ostalih clanova, jer bi time nestao smisao zajednickog rangiranja" - is about
 * members, and they are not. {@code frontend/src/pages/profile/visible.ts} is the one home of
 * the same sentence on the other side, and {@link ActiveMemberOrAdministration} is where it is
 * asked on this one.
 *
 * <p><b>What that does NOT cover, named rather than left to be found.</b> The fee of the one
 * ASKING is part of this rule since 03.10.2026; the fee of the member whose portrait it is, is
 * not: {@link PhotoApi} goes on answering the portrait of a member whose fee has lapsed to a
 * reader who may read hidden profiles and holds the digest. It cannot be got from here - such a
 * member is not on this list at all - and no decision covers it, so nothing is invented for it.
 *
 * <p><b>AND SINCE THIS INCREMENT THE BIOGRAPHY IS WITHHELD BY THE SAME RULE, in its own PR so
 * that the portrait's guard did not grow past the change it was measuring</b> (rule of
 * 01.09.2026: a guard must not outgrow the change it measures). PDL, 06.09.2026 names the
 * biography beside the photograph among what hiding hides, and {@code CompetitorApi} went on
 * answering it to everybody until now - the gap PDL, 26.09.2026 names as „zateceno stanje,
 * nadjeno merenjem uz granu iznad". <b>[ODLUKA 26.09.2026, owner]</b>: „Isto pravilo kao za
 * fotografiju", chosen without weighing a second offer because none was asked for.
 *
 * <p><b>THE MECHANISM IS NOT THE PORTRAIT'S, and that is the schema's doing rather than a
 * second choice made here.</b> {@code photo}/{@code crop} come off a JOINED row, so the join's
 * own condition is where „may not read it, hidden" and „no picture at all" become one shape
 * without a {@code case} anywhere. {@code bio} is a column of {@code competitor} itself (V7), the
 * FROM table, which never fails to match - there is no join to carry the condition, so it stands on
 * the SELECT expression instead, the shape {@code membershipBasis} already uses two names below
 * for a different question (whether the CALLER is the administration, rather than whether
 * he may read a hidden profile at all). See the note on {@code bio} in {@link Competitor} for the one
 * way this still differs from the portrait: there is no "member with none" state to borrow the
 * null from.
 *
 * <p><b>AND SINCE 02.10.2026 THE LINK TO HIS TEAM, BY THE SAME RULE AND, FOR THE FIRST TIME, THE
 * SAME TEXT.</b> PDL, odeljak 16, [ODLUKA 27.09.2026, owner]: chosen between three offered
 * outcomes, with the coordinator's recommendation, that the team is withheld from a visitor the
 * same as the biography and the photograph - and the owner's own words on it the same day: „Samo
 * da se razumemo, mozda on sakrije profil, ali ako je deo tima, njegovo ime se vidi u timu i bodovi
 * koje je doneo." So {@code teamId} and {@code teamSince} leave his record for a
 * reader who may not read a hidden profile (a visitor, and since 03.10.2026 equally a free account
 * and a member whose fee has lapsed), and the team does NOT lose him: his points go into the team's sum
 * and his name onto its page. The reasoning written under the decision says why that half carries
 * weight: his points are part of the team's sum, so taking him off the team would change the
 * arithmetic of the league and not only a page.
 *
 * <p><b>Which is why the link moves rather than goes.</b> {@link TeamApi} answers it on the team, as
 * {@code alsoInTheTeam}, to exactly the reader this resource withholds it from and to nobody else:
 * the same condition, {@link #THE_PROFILE_IS_OPEN_TO_THE_CALLER}, read here as „yes" and there as
 * „no". So for every reader each standing membership stands on exactly one of the two doors, and
 * one link never has two homes. The channel - a field on the team's resource - is derived and not
 * the owner's word; PDL records it beside P13 (02.10.2026).
 *
 * <p><b>The shape is null, which is what a member in no team is answered.</b> The portrait's
 * decision gave it: „Oblik je null, nikad odsutan kljuc" (PDL, 26.09.2026). And the condition stands
 * on the SELECT expression rather than on the join, the biography's mechanism rather than the
 * portrait's, because the join is {@link MeApi}'s clause word for word and stays one text.
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

	/**
	 * WHETHER THE ONE ASKING MAY READ WHAT A MEMBER'S PROFILE HOLDS, written ONCE and asked of
	 * three things here and of one list in {@link TeamApi}.
	 *
	 * <p><b>One text and not three, because the owner made the axis one.</b> PDL, odeljak 18,
	 * 27.09.2026: „Clan koji je aktiviran za sezonu ne moze sakriti svoje rezultate niti profil od
	 * drugih clanova (osim recimo da se ne prikazuje datum rodjenja). Moze sakriti samo od
	 * neulogovanih posetilaca profil." Until 02.10.2026 the portrait's join and the biography's
	 * {@code case} each spelt this out for themselves; the link to his team is the third thing it
	 * decides, and {@link TeamApi} has to ask the same question with the answer turned over, so a
	 * spelling per use would have been four homes of one sentence.
	 *
	 * <p><b>WHO MAY READ IT IS DECIDED BY {@link ActiveMemberOrAdministration} AND NOT BY THIS
	 * TEXT, and it is bound as a boolean.</b> Since 03.10.2026 the owner's „drugi clan" is a member
	 * activated for the season, and the administration (PDL P23, 03.10.2026, „Skrivanje deluje prema
	 * svakome ko nije aktivan član ni administracija,
	 * nikad prema aktivnom članu"). It used to be „anybody with a session",
	 * which was this resource's own reading (PDL 02.10.2026, since overturned: „Skriven profil vidi
	 * svako ko je prijavljen, i administrativni nalog koji ne trci"), and a free account and a member
	 * whose fee has lapsed read it by it. The administration is read off the role the REQUEST
	 * carries and a member's fee off {@code competitor.active}, so an account that races for
	 * nobody and is the administration still reads it, and one that races for nobody and is not
	 * does not.
	 *
	 * <p><b>A fragment rather than a query</b>: it needs the member aliased {@code c} and
	 * {@code :readsHiddenProfiles} bound, which is the price {@link TeamApi#WHO_STANDS_IN_A_TEAM}
	 * names for the same shape. The parameter is CAST because it stands alone as an operand of
	 * {@code or}, with nothing beside it to take a type from, and PostgreSQL refuses the statement
	 * rather than guessing („could not determine data type of parameter").
	 */
	static final String THE_PROFILE_IS_OPEN_TO_THE_CALLER =
			"(cast(:readsHiddenProfiles as boolean) or not c.profile_hidden)";

	private final JdbcClient db;

	private final WhatHeMayDo mayHe;

	private final Clock clock;

	private final ActiveMemberOrAdministration readers;

	/**
	 * <b>{@code MemberOfAccount} left this constructor on 25.09.2026 with the question it
	 * answered, and the question is back since 03.10.2026 through the one class that owns it.</b>
	 * This route asked WHICH MEMBER the caller is, for the two fields his own row carried; P26a
	 * took both off the answer, so for a week the only thing left to ask about the caller was
	 * whether he is the administration. The hidden profile asks one more: whether he is a member
	 * whose fee is standing, which is a question about his MEMBER and not only about his account.
	 * It is not asked here but of {@link ActiveMemberOrAdministration}, so that this route does not
	 * hold a second spelling of who reads what the league keeps for its own.
	 */
	CompetitorApi(JdbcClient db, WhatHeMayDo mayHe, Clock clock,
			ActiveMemberOrAdministration readers) {
		this.db = db;
		this.mayHe = mayHe;
		this.clock = clock;
		this.readers = readers;
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
	 *                       who has none - and for a member who hides his profile when the
	 *                       reader may not read it, which is the same shape on purpose. PDL,
	 *                       06.09.2026 requires that „Oba slucaja dobijaju isti ishod": told
	 *                       apart, the absence would say „this member has a picture and I am
	 *                       not showing it to you", which names him as one of the members who
	 *                       hide. Null and never the empty path: see the note on this class
	 * @param crop           the square of the portrait, or null for a member who has no
	 *                       portrait in this answer. The other half of {@code photo} and
	 *                       never answered without it
	 * @param bio            what the member wrote about himself, or NULL for a member who
	 *                       hides his profile when the reader may not read it - the same shape as
	 *                       {@code photo} and for the same reason (PDL, 06.09.2026 names both
	 *                       among what hiding hides). UNLIKE {@code photo}, there is no
	 *                       "member with none" state to borrow the shape from: the column is
	 *                       NOT NULL and may be empty (V7), so a member who has written
	 *                       nothing already reads as {@code ""} to everybody, hiding or not,
	 *                       and only hiding from a reader who may not read it answers
	 *                       {@code null}. Withheld on the SELECT expression rather than on a
	 *                       join, because this column stands on {@code competitor} itself,
	 *                       the FROM table, which never fails to match
	 * @param teamId         the team of the membership that has NOT ENDED, or NULL for a
	 *                       member who is in none - and, since 02.10.2026, for a member who
	 *                       hides his profile when the reader may not read it, which is the same
	 *                       shape on purpose: the portrait's decision says „Oblik je null,
	 *                       nikad odsutan kljuc ... skriven clan se cita tacno kao clan koji
	 *                       sliku nema" (PDL, 26.09.2026), and this is the same withholding
	 *                       (PDL, odeljak 16, [ODLUKA 27.09.2026, owner]). The link is not
	 *                       lost: {@link TeamApi} names him on his team, as
	 *                       {@code alsoInTheTeam}, to exactly the reader it is withheld from
	 *                       here
	 * @param teamSince      the season that membership began in, null exactly when
	 *                       {@code teamId} is, for both of its reasons: the two halves of the
	 *                       link leave together or neither does
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
	 *               <p><b>AND SINCE 26.09.2026 IT HOLDS OF EVERY FIELD BUT THOSE HIDING
	 *               MOVES, which is said here rather than left for the case to carry
	 *               alone.</b> Who the reader is decides, for a member who hides his profile,
	 *               whether his portrait is answered and whether his biography is [ODLUKA
	 *               26.09.2026, owner, twice], and since 02.10.2026 whether the link to his team is
	 *               [ODLUKA 27.09.2026, owner] (see the note on this class). So the two
	 *               answers are equal on every OTHER name the portal reads, and the case
	 *               NAMES the fields it excuses rather than discovering them by what it
	 *               declines to look at - a comparison that has to ignore something to pass
	 *               is only as honest as the reason it gives for the difference (rule of
	 *               14.09.2026, from a review whose only real finding was its own blind
	 *               spot). It first requires that the answers really DO differ before
	 *               excusing anything, so naming them cannot become the thing that makes the
	 *               case pass
	 *               <p><b>AND SINCE 03.10.2026 A FREE ACCOUNT AND A MEMBER WHOSE FEE HAS LAPSED
	 *               ARE ANSWERED WHAT A VISITOR IS, WHOLE</b>: not a field of the two answers
	 *               differs, hiding's included, because they are readers who may not read a
	 *               hidden profile. {@code TheSameReadersReadAHiddenProfileOnEveryDoorTest}
	 *               compares them text for text, with nothing named as excused.
	 */
	@GetMapping("/api/competitors")
	List<Competitor> competitors(@AuthenticationPrincipal WhoIsAsking.Member member) {
		/* WHO IS ASKING IS TWO QUESTIONS HERE, AND THE FIRST IS ABOUT THE BASIS.

		   Whether the caller is the administration over the members decides one field of the
		   answer, `membershipBasis`, and nothing else. IT IS ASKED OF THE ACCOUNT AND NEVER OF
		   THE MEMBER: a moderator who does not race has no member at all (V23), so reading it
		   off a member would refuse the ordinary case outright.

		   `member != null` is not a nicety here. This is the first route to ask „may
		   he" while standing on `ApiSecurity.READ_BY_ANYBODY`, so the principal of a
		   visitor is Spring's anonymous token; the overload takes the caller rather
		   than reaching for the context, and its own note says what that is for. */
		boolean administration = member != null && mayHe.may(member, OVER_THE_MEMBERS);

		/* AND WHETHER HE MAY READ A HIDDEN PROFILE, which is a second question and not the one
		   above. It decides what a hidden member's record gives a reader, and since 02.10.2026
		   that is three things: his portrait, his biography and the link to his team (PDL P23,
		   the decisions of 26.09.2026 and 27.09.2026). All three are asked through
		   `THE_PROFILE_IS_OPEN_TO_THE_CALLER`, which is the one place the question is written.

		   SINCE 03.10.2026 THE ANSWER IS NOT „IS THERE A SESSION". PDL P23, 03.10.2026,
		   „Skrivanje deluje prema svakome ko nije aktivan član ni administracija,
		   nikad prema aktivnom članu": an active
		   member and the administration read it, and a free account or a member whose fee has
		   lapsed is answered what a visitor is. That is `ActiveMemberOrAdministration`, which
		   reads the role off the REQUEST and the fee off `competitor.active`, and answers no
		   for a request with no session (`member` is null for a visitor and the class takes
		   it), so an account that races for nobody and is the administration still reads it.

		   IT IS NOT `administration` EITHER, which is the sibling mistake and a live one: the
		   administration reads it, and so does every member whose fee is standing, so the
		   condition written as `:administration` would stop an active member seeing a hiding
		   colleague's biography.
		   `TheSameReadersReadAHiddenProfileOnEveryDoorTest` walks ten kinds of reader for
		   exactly that reason. */
		boolean readsHiddenProfiles = readers.includes(member);

		/* AND THE SEASON THE BANDS BELOW ARE WORKED OUT FOR, read ONCE for the whole
		   answer rather than per row. Two members with the same year of birth must come
		   back in the same band, and a clock read inside the mapper can cross midnight
		   on 1 January between two rows of one list - which is the one night of the year
		   this field moves on. `SeasonClock.seasonTheBandIsWorkedOutFor` says which season
		   it is and why. */
		int season = SeasonClock.seasonTheBandIsWorkedOutFor(ZonedDateTime.now(clock));

		return db.sql("select c.member_number, c.first_name, c.last_name, c.gender,"
						+ " coalesce(town.name, c.city) as city,"
						+ " coalesce(town_country.code, typed_country.code) as country,"
						+ " c.first_season_2027, c.first_season,"
						/* THE BIOGRAPHY, WITHHELD BY THE SAME RULE AS THE PORTRAIT BUT NOT BY
						   THE SAME MECHANISM, because it stands on `competitor` itself rather
						   than on a joined row that can simply fail to match (see the note on
						   this class and on `bio` in `Competitor`).

						   THE SAME CONDITION AS THE PORTRAIT'S JOIN, and since 02.10.2026 the
						   same TEXT: `THE_PROFILE_IS_OPEN_TO_THE_CALLER`, one sentence of the
						   owner's asked of three things. Written as `:administration` instead -
						   the mistake `membership_basis` two names below makes on purpose for a
						   different question - an active member would stop seeing a hiding
						   colleague's biography although PDL P23, 03.10.2026 requires that he
						   still does; the case
						   `aHiddenProfilesBiographyLeavesToAnActiveMemberAndToTheAdministration`
						   is written to catch exactly that swap. */
						+ " case when " + THE_PROFILE_IS_OPEN_TO_THE_CALLER
						+ "  then c.bio end as bio,"
						/* AND THE TEAM HE IS IN, WITHHELD BY THE SAME CONDITION SINCE 02.10.2026.
						   PDL, odeljak 16 [ODLUKA 27.09.2026, owner]: chosen between offered
						   outcomes, the team is withheld from a reader who may not read a hidden
						   profile, the same as the biography and the photograph - and the
						   owner's own words on it the same day:
						   „mozda on sakrije profil, ali ako je deo tima, njegovo ime se vidi u timu
						   i bodovi koje je doneo." So what goes is the LINK FROM HIS RECORD, both
						   halves of it, and nothing about the team.

						   NULL, WHICH IS WHAT A MEMBER IN NO TEAM IS ANSWERED, ON PURPOSE. The
						   portrait's decision gave the shape: „Oblik je null, nikad odsutan kljuc
						   ... skriven clan se cita tacno kao clan koji sliku nema" (PDL,
						   26.09.2026), and this is the same withholding.

						   ON THE SELECT EXPRESSION AND NOT ON THE JOIN BELOW, for two reasons. The
						   join is `MeApi`'s clause word for word and its note says so, so the
						   clause stays one text. And the condition here is the same one the
						   biography stands on, two lines up.

						   THE LINK IS NOT LOST, IT IS MOVED: `TeamApi` names him on his team, as
						   `alsoInTheTeam`, by this same condition turned over, so for every reader
						   each standing membership is on exactly one of the two doors.
						   `TeamApiTest.theTwoDoorsNameEveryStandingMembershipOnceToEveryCaller`
						   holds that over every kind of caller. */
						+ " case when " + THE_PROFILE_IS_OPEN_TO_THE_CALLER
						+ "  then m.team_id end as team_id,"
						+ " case when " + THE_PROFILE_IS_OPEN_TO_THE_CALLER
						+ "  then m.season_from end as team_since,"
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
						   a member who hides his profile and a caller who may not read it the
						   row simply does not join, so the digest is never read, the square is
						   never read, and the answer is byte for byte the answer of a member who
						   has no portrait at all - which is what PDL, 06.09.2026 requires („Oba
						   slucaja dobijaju isti ishod"). Written as a `case` over the digest it
						   would be four cases, and a fifth column tomorrow would be a fifth.

						   THE CONDITION IS `THE_PROFILE_IS_OPEN_TO_THE_CALLER`, the one text the
						   biography and the team above stand on as well; its note says why it is
						   cast. */
						+ " left join photo mine on mine.id = c.photo_id"
						+ "  and " + THE_PROFILE_IS_OPEN_TO_THE_CALLER
						/* AND ONLY THE MEMBERS WHOSE FEE IS STANDING, which is the whole of what
						   this resource is allowed to say about a fee. PDL P11: „Status clanarine
						   se ne prikazuje na profilu... ko nije platio, ne vidi se nigde osim u
						   istorijskim godinama." Owner, 13.09.2026, asked which shape that takes
						   here, chose this one over serving the flag: a member whose fee has
						   lapsed is not on this list at all. */
						+ " where c.active"
						+ " order by c.member_number")
				.param("administration", administration)
				.param("readsHiddenProfiles", readsHiddenProfiles)
				.query((row, one) -> {
					/* Exact decimal all the way out, never a double, which is `TeamApi`'s own
					   sentence about the same three numbers: V21 chose `numeric(9, 8)` because
					   the rule is about the exact boundaries 0 and 1, and a binary fraction
					   cannot be trusted at one.

					   EVERY COLUMN OF `photo` IS NOT NULL (V8), so each of these two is null
					   exactly when no row joined - which is a member with no portrait, or a
					   member hiding his profile from a caller who may not read it. They are
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
