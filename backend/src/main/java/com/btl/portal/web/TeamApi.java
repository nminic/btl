package com.btl.portal.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * THE TEAMS OF THE LEAGUE, and only what the rulebook publishes about them.
 *
 * <p><b>Article 73 is the measure and nothing else is.</b> It lists what a public
 * competition publishes - „Ime i prezime, clanski broj i kategorija, Mesto i
 * zemlja, Profilna fotografija, Svi verifikovani rezultati..., Bodovi, plasman,
 * statistika, dukati i priznanja, <b>Tim, trkacki par i klub</b>" - and the team
 * is on it by name. A team is also the one thing besides a member that has a
 * standing of its own (V11), so what makes it that thing is what this answers
 * with: which team it is, what it is called, where it is, and what it says about
 * itself. Everything else waits for a resource that knows who is asking, and
 * where this resource was in any doubt the field was LEFT OUT rather than served
 * "in case somebody needs it". Owner, 13.09.2026.
 *
 * <p><b>WHO ADMINISTERS THE TEAM DOES NOT LEAVE PUBLICLY.</b> The portal reads it
 * as {@code organizerMemberNumber} and it is kept out of the public answer for
 * three reasons, each of which would be enough on its own.
 *
 * <ul>
 * <li>Article 73 makes „Tim" public, which is WHICH team a member runs for. It
 * makes no role inside a team public, and administering one is a right and not a
 * standing: the same sentence lists points, placings and awards, and stops there.
 * PDL P13, 13.09.2026, draws the boundary in as many words: „Sa druge strane
 * granice stoji sve sto o timu govori kroz njegove ljude: ko ga vodi
 * ({@code admin_id}), ko je u njemu... To ne izlazi."</li>
 * <li><b>No public screen publishes it even today.</b> Measured before this was
 * written: the one public page that reads the field, {@code pages/TeamDetail.tsx},
 * never draws it. All three uses are conditions - {@code runs !== null} and
 * {@code runs === memberNumber} - which decide whether the READER may edit the
 * team and answer applications. That is an authorisation question, and the
 * answer to "may I edit this" belongs to the resource that knows who is asking,
 * not to a list anybody may read.</li>
 * <li>And the member it names may be one whose fee has lapsed, whom the owner's
 * decision of 13.09.2026 keeps off {@code /api/competitors} altogether (PDL P11,
 * „ko nije platio, ne vidi se nigde"). A member number answered here and absent
 * there says by subtraction exactly what that decision shut. The fixture holds
 * such a member and names a team after him, so this is measured and not argued.
 * <b>This third reason stops applying to the administration on 21.09.2026 and the
 * paragraph below says what it leaves behind instead</b>, because a reason that is
 * quietly no longer true reads as one that was never checked.</li>
 * </ul>
 *
 * <p><b>WHICH LEAVES THE ADMINISTRATION A NUMBER IT CANNOT LOOK UP, AND THAT IS NAMED
 * HERE RATHER THAN LEFT TO BE FOUND.</b> The third reason above is about subtraction:
 * a lapsed member is off {@code /api/competitors} entirely, so a number answered here
 * and missing there told a public reader what PDL P11 shut. The administration may
 * read the seat, so for it the subtraction is no longer a leak - but the two lists
 * still disagree, and now they disagree in the administration's hands. Measured on the
 * fixture: {@code klub-lovcen}'s seat holds {@code 000003}, whose {@code active} is
 * false; {@code /api/teams} answers the superadmin {@code "organizerMemberNumber":
 * "000003"} and {@code /api/competitors}, asked with the SAME cookie by the SAME
 * superadmin, answers {@code 000001}, {@code 000002} and {@code 000004} and no
 * {@code 000003} at all, because {@code CompetitorApi} ends on {@code where c.active}.
 * So {@code AdminTeams.tsx} draws a seat it cannot put a name to, and
 * {@code teamAdmin.ts} finds nobody in the roster to match.
 *
 * <p><b>It is not decided here, and the boundary is written down in both directions so
 * that whoever decides it has the two costs in front of him.</b> Either the
 * administration's list of members carries the lapsed ones - which is PDL P11 reopened,
 * for one audience - or the seat answers a lapsed member as null, which is the shape
 * the paragraph above gives to „there is no number to give you" and would put a HELD
 * seat and a seat held by a LAPSED member back into one sentence, the very join this
 * increment spent itself taking apart. The owner's rule of 13.09.2026 governs the gap
 * in between: „Kad je sporno, polje se IZOSTAVLJA i izostavljanje se imenuje sa
 * razlogom, pa se vlasniku javi." Nothing is omitted here because the field is already
 * answered and taking it back out is the second of those two costs; what is done
 * instead is the rest of that sentence - the case is named, the reason is named, and it
 * goes to the owner. {@code TeamApiTest} pins the disagreement itself so that a day on
 * which the two lists agree does not pass unnoticed.
 *
 * <p><b>And one half of that choice is already made ELSEWHERE, which is worth the
 * owner's knowing and is not on its own a reason to follow it here.</b>
 * {@link CommentApi} meets the same two lists and answers
 * {@code case when author.active then author.member_number end}, so a lapsed author's
 * number does not leave at all. Measured, and the difference measured with it: that
 * resource is PUBLIC, and its reason is the subtraction PDL P11 shut - a number leaving
 * there and missing from {@code /api/competitors} names whoever has not paid to anybody
 * who looks. This one answers the seat to the administration alone, which PDL P13 lets
 * appoint it, so that reason does not carry across and the choice does not follow from
 * it. What carries across is only the vocabulary, above.
 *
 * <p><b>AND ONE DEBT THE PORTAL OWES THE DAY THE MOCK IS SWITCHED OFF, written where
 * whoever switches it off will be standing.</b> {@code frontend/src/data/types.ts}
 * types this field {@code organizerMemberNumber: string} - REQUIRED, and neither
 * optional nor nullable - while the answer leaves the key out for four of the five
 * callers and, since 21.09.2026, may carry null for the fifth. Nothing is broken today
 * because the portal still reads {@code /mock} (ADL A50) and the served file writes a
 * string on every record. On the first day it reads this resource the type has to
 * become {@code organizerMemberNumber?: string | null}, and the two halves are two
 * different sentences: the {@code ?} is „I am not telling you" and the {@code null} is
 * „somebody holds it whom I cannot name". The frontend is not touched by this
 * increment; this paragraph is the whole of what it is owed.
 *
 * <p><b>AND SINCE 21.09.2026 IT DOES LEAVE TO THE ADMINISTRATION, which is the
 * other half of the same decision rather than a hole in it.</b> ADL, 13.09.2026:
 * „javno je ono sto Clan 73 nabraja, i nista vise. <b>Sve ostalo ceka resurs koji
 * zna ko pita.</b>" This is that resource, and the ones it waits for are named by
 * the owner rather than chosen here: „Administratora tima postavlja <b>Superadmin
 * ili moderator sa pravom nad timovima</b>" (PDL P13, 31.07.2026). Somebody who
 * may APPOINT the seat cannot be refused the sight of who sits in it, so the field
 * is answered when, and only when, whoever is asking holds {@link #OVER_THE_TEAMS} -
 * which the superadmin holds by his mode and a moderator holds one tick at a time
 * (V5).
 *
 * <p><b>And it is the administration's SCREENS that were measured, not assumed.</b>
 * What the plan said was that the field could go off the screen when the mock was
 * switched off, because {@code foundedByMe} answers the same question. That is true
 * of exactly one of its four readers. {@code frontend/src/data/teamAdmin.ts} asks
 * whether the reader may edit, and {@code foundedByMe} does replace it; the other
 * three DRAW it - {@code AdminTeams.tsx} builds the list of members to choose the
 * seat from and then finds the one sitting in it, and
 * {@code forms/definitions/admin-tim.form.json} carries the field of the form. With
 * the field gone the administration of teams would have broken, and silently.
 *
 * <p><b>THE SEAT HAS FOUR STATES AND THE ANSWER HAS FOUR SHAPES, one each, and that
 * is the correction of 21.09.2026.</b> {@code team.admin_id} is nullable by V11's own
 * decision - „It EMPTIES rather than blocking anything: when the seat is vacant the
 * portal reads the member who has been in the team longest, and that is a query, not
 * a column. So this says who was NAMED, and nothing here pretends it is always
 * somebody" - so „nobody is named to this seat" is a sentence of its own beside „I am
 * not telling you" and a member number. What stood here said those were all the
 * sentences there were, and a fourth was hiding inside the third:
 *
 * <ul>
 * <li><b>The key ABSENT</b>, which is „I am not telling you" and is what everybody
 * outside {@link #OVER_THE_TEAMS} is answered. Java {@code null} on the component.</li>
 * <li><b>The EMPTY STRING</b>, which is „nobody is named to this seat" and is read off
 * {@code t.admin_id is null} and off nothing else. It is also the shape the portal
 * already reads ({@code frontend/src/data/types.ts} types the field {@code string},
 * and the served file writes {@code ""} for the team that has none). Answered null
 * instead, the key would vanish and the administration would be told „you may not see
 * this" about a team it may see everything about.</li>
 * <li><b>A member number</b>, which is the member who holds it.</li>
 * <li><b>JSON null</b>, which is „somebody holds this seat and he is not a member, so
 * there is no number to give you". {@code Optional.empty()} on the component, and the
 * portal's own word for that rather than one invented here: {@link CommentApi} answers
 * {@code memberNumber} as null for an author there is no profile to lead to
 * ({@code case when author.active then author.member_number end}), and
 * {@code CommentApiTest} reads it back as {@code path("memberNumber").isNull()}.</li>
 * </ul>
 *
 * <p><b>Why the fourth is a state and not a spelling of the empty one, which is
 * measured rather than argued.</b> {@code competitor.member_number} has been nullable
 * since V16, whose own text names the trap - „a row in {@code competitor} is a PERSON
 * WHO REGISTERED. A MEMBER is a row whose {@code member_number} is there. <b>Any query
 * that counted members by counting rows now counts applicants too</b>" - and nothing
 * keeps such a row out of the seat: {@code team_admin_fk} (V11) points at
 * {@code competitor (id)} with no condition on it, and {@link TeamWriteApi} lets
 * anybody with a row there put a team forward, {@code JoiningATeam.mayJoin} asking
 * about the window and his memberships and never about a number. Written
 * {@code coalesce(seat.member_number, '')} the answer then said „nobody holds this
 * seat" about a seat that is HELD, and the administration's own screen
 * ({@code frontend/src/pages/admin/AdminTeams.tsx}) draws a free chair off exactly
 * that string. <b>And the contradiction is inside one record rather than in the eye of
 * a reader:</b> {@code foundedByMe} compares {@code t.admin_id} to the caller's KEY, so
 * the same registrant is told „you founded this team" by the field beside the one
 * telling him nobody did. {@code aSeatHeldByARegistrantIsNotAnEmptySeat} holds both
 * halves of that at once.
 *
 * <p><b>And it is {@code Optional} rather than a second field, because one fact keeps
 * one home.</b> A boolean beside the number would be the same fact answered twice, in
 * a name no screen reads, and the two would be free to disagree. Jackson 3 carries an
 * {@code Optional} itself, so {@code null} and {@code Optional.empty()} are the key
 * gone and the key carrying null - four shapes on one field, and
 * {@code theFourStatesOfTheSeatAreFourDifferentShapes} reads all four off the wire
 * rather than trusting the annotation.
 *
 * <p><b>WHAT DOES LEAVE, SINCE 20.09.2026, IS THE ANSWER TO THE QUESTION THE
 * NUMBER WAS BEING READ FOR, and only to the one asking it.</b> The paragraph
 * above says the number is read as a condition and never drawn, and that was
 * measured again before this was written: all three uses in
 * {@code pages/TeamDetail.tsx} are {@code runs !== null} and
 * {@code runs === memberNumber}, and the one use in {@code pages/member/EditTeam.tsx}
 * is a guard that refuses the page to anybody but the administrator, after which the
 * name it draws is the READER's own off the reader's own record. So no screen wants
 * to know who founded a team; every screen wants to know whether the reader did.
 * {@code foundedByMe} is that, and it is the number reduced to what Article 73 lets
 * the reader have - nothing about anybody else at all.
 *
 * <p><b>AND IT IS THE STORED FACT, NOT THE STANDING RULE, WHICH IS A BOUNDARY AND
 * IS WRITTEN DOWN RATHER THAN LEFT TO BE FOUND.</b> Who ADMINISTERS a team is more
 * than who founded it: „Administrator tima je onaj ko je tim osnovao. Kad se mesto
 * isprazni, po podrazumevanom ga preuzima clan koji je najduze u timu, dakle
 * najraniji `teamSince`, a kod izjednacenja manji broj clana" (owner, PDL,
 * 04.09.2026). The second half of that sentence is worked out from the roster and
 * lives in {@code frontend/src/data/teamAdmin.ts}; this resource does not repeat it,
 * because two homes for one rule drift and the other home is the one the owner's
 * decision was written against.
 *
 * <p><b>Which leaves exactly one thing owed, and it is smaller than it was.</b> What
 * stood here said the portal cannot tell whether a seat is EMPTY once the number is
 * gone. Since 21.09.2026 the ADMINISTRATION can - that is what the empty string
 * above says, and it is the state {@code teamAdmin.ts} opens with - so what is still
 * owed is the same question asked by a MEMBER, who is answered {@code foundedByMe}
 * and nothing else. {@code false} tells him „the seat is not yours" and cannot tell
 * him „and it is going spare". It is named here, and in {@code TeamApiTest}, rather
 * than guessed at: either this answers a second condition beside the one below, or
 * the standing rule moves here whole. That is a decision about where a rule lives
 * and it is the owner's to make.
 *
 * <p><b>AND NEITHER DO THE MEMBERS OF THE TEAM</b>, although they are public.
 * Article 73 does make them public and this resource still does not carry them,
 * and that is a decision about where one fact lives rather than about whether it
 * may be read. Who is in which team is already answered, once, by
 * {@code /api/competitors} as {@code teamId} and {@code teamSince}; two homes for
 * one fact drift, and the second home would be the worse of the two. Built here
 * out of {@code team_membership} it would carry the members whose fee has lapsed,
 * which is the door above again. Filtered to the members whose fee is standing it
 * would be the first list inverted, kept in a second place, by a second query
 * that has to be remembered every time the first one changes. So a member of a team
 * is named in no answer of this resource at all, to anybody.
 *
 * <p><b>Which makes the whole-text floor a floor over WHO IS ASKING, since
 * 21.09.2026.</b> {@code TeamApiTest.noMemberNumberLeavesTheServer} asked the answer
 * for every member number in the database and required it to carry none, over the
 * TEXT rather than over a name, because an omission guarded by a name lasts until
 * somebody answers the same fact under another one. It still asks exactly that of
 * everybody the paragraph above does not name - the visitor, the member, and a
 * signed in moderator who does not hold {@link #OVER_THE_TEAMS} - and of the
 * administration it asks the one thing that is now true instead: the numbers it may
 * read are the seats and no others, so every member number that is in no team's seat
 * is still absent from its answer. The roster is the door that stays shut in both.
 *
 * <p><b>AND THE MARK DOES LEAVE SINCE 21.09.2026, WHICH IS THIS PARAGRAPH
 * REVERSED RATHER THAN EXTENDED.</b> What stood here said the mark could not
 * leave, and said why: a picture is a row in {@code photo} (V8, V21) carrying a
 * media type, a byte size, a digest and the crop, „nothing that points at bytes -
 * and no route of this application serves one". The first half is still true of
 * the row and the second half stopped being true of the portal the day
 * {@link PhotoApi} was written, so the field is answered and the sentence is
 * rewritten in the same commit. Left standing, it would read as an instruction to
 * the next reader to take the field back out.
 *
 * <p><b>The address is the DIGEST and never {@code photo.id}</b>, and that is
 * {@link PhotoApi}'s decision arriving at its first publisher rather than a choice
 * made a second time here (ADL A60, 20.09.2026, and PDL:6165, „Oba slucaja dobijaju
 * isti ishod"). A key is countable, so an address built on one would let anybody
 * walk 1, 2, 3 and learn which rows the portal holds; sixty four hexadecimal
 * characters are not walked. The shape is READ OFF the route and not invented:
 * {@code GET /api/photos/} takes the digest as the whole of the name, with no
 * extension behind it, and {@code TeamApiTest} asks the dispatcher whether the
 * address answered here really reaches that route rather than comparing two
 * spellings. That is the arrangement {@code ApiSecurity} already keeps for the same
 * string, for the same reason.
 *
 * <p><b>And this is the first place in the portal that publishes a digest at
 * all</b>, so what it publishes is said out loud: a team's mark and nothing else.
 * ADL A60 makes exactly two holders public, {@code competitor.photo_id} and
 * {@code team.logo_id}, and only the second is a fact this resource holds. The one
 * boundary A60 leaves open - a member's portrait counts as public whatever
 * {@code profile_hidden} says - rests today on nobody publishing a portrait's
 * digest, and nothing here does. {@code noPartOfAnybodysProfilePictureLeavesWithATeam}
 * holds that over the whole text rather than over a field name.
 *
 * <p><b>The mark and its square are two halves of one fact and leave together.</b>
 * The square is three exact fractions on the picture's row and it is what the team
 * chose. Every column of {@code photo} is NOT NULL, so both are null exactly when no
 * picture joined: a team with no mark answers null to both, and never the empty path,
 * which {@code frontend/src/data/types.ts} refuses in as many words - „a team that has
 * none is not a team whose logo is the empty path". Null is also what the portal
 * already reads as „the whole picture" ({@code components/crop.ts}, {@code cropIn}).
 * Until today the answer could carry a square with no picture to cut, which is the
 * square of nothing; that is what {@code aTeamAnswersWithBothHalvesOfItsMarkOrNeither}
 * now refuses.
 *
 * <p><b>What this does NOT give a team, named rather than left to be found:</b> a way
 * to have a mark at all. {@code team_proposal.logo_id} is not carried over when a
 * moderator approves a proposal (ADL, 15.08.2026: „Nista od timske slike ne prezivljava
 * odobravanje predloga, do F5") and {@link TeamWriteApi} collects no picture, so the
 * only teams that answer with an address are the ones the league's own data gave one.
 * The field has a home here; filling it is F5 and somebody else's increment.
 *
 * <p><b>The three numbers are answered under the portal's names and not the
 * schema's, and that is a boundary rather than an oversight.</b> V21 renamed the
 * third column {@code crop_diameter}; the portal still calls it {@code size}
 * ({@code frontend/src/data/types.ts}), and the difference is a recorded open
 * item that this increment does not close. It matters which way round it is
 * answered: {@code cropIn} asks for the name {@code size} and quietly returns the
 * whole picture for a record without it, so answering {@code diameter} would lose
 * every crop on the portal without one error anywhere. The values are the same
 * fractions on both sides; only the word differs.
 *
 * <p><b>The town in the two shapes the schema allows</b>, the same as a member's
 * (V11, and {@code CompetitorApi} before it): one out of the codebook and one
 * typed in, and the country comes from whichever of the two the team used.
 *
 * <p><b>In name order, and the tie is broken by the key.</b> A team is spoken of
 * by its name and the table of teams is read down the names; the collation is the
 * column's own {@code sr_latn} (V11), so the order is the one a reader of the
 * portal's language expects. The name is not unique - only the address is - so
 * {@code id} ends the sentence, exactly as the season does for a league.
 */
@RestController
class TeamApi {

	/**
	 * WHERE A PICTURE IS ASKED FOR, and the name that follows is its digest.
	 *
	 * <p>The same text {@link PhotoApi} maps and {@code ApiSecurity} opens, which is two
	 * homes already and this is a third. Kept as a literal rather than reached for through
	 * either of them, because neither is a fact about a team and an import would tie this
	 * resource to a class it does not otherwise know - and because a constant copied is
	 * only ever as good as what proves it equal. What proves it is
	 * {@code theMarkIsTheAddressOfThatTeamsOwnPicture}, which hands the address this builds
	 * back to the dispatcher and requires it to arrive at {@link PhotoApi}; a rename that
	 * left this behind would be caught by the route and not by a comparison of two strings.
	 */
	private static final String A_PICTURE_IS_ASKED_FOR_AT = "/api/photos/";

	/**
	 * THE BOX THE SUPERADMIN TICKS FOR SOMEBODY HE TRUSTS WITH THE TEAMS, which is
	 * what PDL P13's „moderator sa pravom nad timovima" is in the matrix.
	 *
	 * <p><b>The code as {@code admin_right.code} generates it</b>, {@code scope:target}
	 * over the row V5 writes as {@code ('entity', 'teams')}. The scope is the half that
	 * has to be right rather than merely present: V5 writes a {@code ('queue', 'teams')}
	 * beside it, and {@code rights.ts} says in as many words why both exist - „Leagues
	 * and teams do, both of them, so &quot;teams&quot; on its own would mean either
	 * editing the league or approving one somebody proposed, which are not remotely the
	 * same permission". The screens that read this field are the ENTITY form
	 * ({@code AdminTeams.tsx}, {@code entityForms.ts} id {@code teams}); the queue is
	 * where a proposed team is approved, and a moderator trusted with that is not
	 * thereby trusted with the teams that exist.
	 *
	 * <p>It is a constant and not a {@link RightIsNeeded} annotation because this route
	 * is open to everybody and only one FIELD of the answer is guarded; an annotation
	 * would shut the list of teams to the league.
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
	static final String OVER_THE_TEAMS = "entity:teams";

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	private final WhatHeMayDo mayHe;

	TeamApi(JdbcClient db, MemberOfAccount memberOfAccount, WhatHeMayDo mayHe) {
		this.db = db;
		this.memberOfAccount = memberOfAccount;
		this.mayHe = mayHe;
	}

	/**
	 * Which circle of the mark is drawn, as three fractions between 0 and 1.
	 *
	 * @param size the diameter, as a fraction of the picture's shorter edge. The
	 *             column is {@code crop_diameter} since V21 and the portal's word
	 *             is {@code size}; see the note on this class for why the answer
	 *             carries the portal's.
	 */
	record Crop(BigDecimal x, BigDecimal y, BigDecimal size) {
	}

	/**
	 * @param logo        where the mark's picture is asked for, or NULL for a team that
	 *                    has none. Null and never the empty string: the portal reads the
	 *                    two as different things ({@code frontend/src/data/types.ts}), and
	 *                    the empty path is an address that would be asked for
	 * @param crop        the square of the mark, or null for a team that has no mark. The
	 *                    other half of {@code logo} and never answered without it
	 * @param foundedByMe whether the one asking is the member this team's seat names,
	 *                    and ABSENT - not null, and not false - from every answer
	 *                    nobody signed in asked for. False and absent are two
	 *                    different sentences: „you did not found this" and „I do not
	 *                    know who you are", and a visitor must be told the second
	 * @param organizerMemberNumber who sits in this team's seat, said in FOUR shapes
	 *                    because the seat has four states and no two of them may read
	 *                    alike. The Java {@code null} is the key ABSENT, which is
	 *                    „I am not telling you" and is what everybody but the
	 *                    administration is answered - a visitor's, a member's own team
	 *                    included, and a signed in moderator who does not hold
	 *                    {@link #OVER_THE_TEAMS}. {@code Optional.of("")} is
	 *                    <b>the EMPTY STRING, „nobody is named to this seat"</b>, and it
	 *                    is read off {@code t.admin_id is null} and off nothing else.
	 *                    {@code Optional.of(number)} is the member who holds it.
	 *                    {@code Optional.empty()} is <b>JSON null, „somebody holds it
	 *                    and he is not a member, so there is no number to give you"</b>;
	 *                    see the note on this class for why that is a state of its own
	 *                    and not a spelling of the empty one
	 */
	record Team(long id, String slug, String name, String city, String country, String bio,
			String logo, Crop crop,
			@JsonInclude(JsonInclude.Include.NON_NULL) Boolean foundedByMe,
			@JsonInclude(JsonInclude.Include.NON_NULL) Optional<String> organizerMemberNumber) {
	}

	/**
	 * @param member who the chain worked out is asking, or NULL when nobody is, for the
	 *               reason written on {@code CompetitorApi}: this route is open for
	 *               reading, so an anonymous GET arrives here rather than at a 401
	 */
	@GetMapping("/api/teams")
	List<Team> teams(@AuthenticationPrincipal WhoIsAsking.Member member) {
		/* The caller as a MEMBER, which an account that does not race does not have:
		   a signed in moderator founded no team, so nothing on the seat below is his.

		   THAT USED TO READ „and is answered exactly what a visitor is", AND SINCE THE
		   LINE BELOW IT IS NO LONGER TRUE OF EVERY MODERATOR. It is still true of one
		   who does not hold the right over the teams, which is what
		   `anAccountThatRacesForNobodyIsAnsweredWhatAVisitorIs` holds - and that case
		   now says out loud which of the two it is measuring. */
		Long me = member == null ? null : memberOfAccount.competitorId(member.account());

		/* AND WHETHER HE IS THE ADMINISTRATION, which is a second question and none of
		   the first. It is asked of the ACCOUNT and never of the member: a moderator who
		   does not race has no member at all (V23, owner 14.09.2026), so reading it off
		   `me` would refuse the ordinary case outright - the superadmin races for nobody.

		   `member != null` IS NOT A NICETY, and it is the whole of what stands between a
		   visitor and a 500. This route hands `member` straight to
		   `WhatHeMayDo.may(WhoIsAsking.Member, String)`, the overload written for exactly
		   this shape of caller - open to everybody, asking "may he" of whoever there is.
		   That overload's own safety note assumes a route that needs a right is one
		   `ApiSecurity` has already shut to anybody not signed in; this route stands on
		   READ_BY_ANYBODY, where that is false, so the assumption has to be made true by
		   hand. Taken away, a null `member` would reach `rightsOf` and fail on
		   `asking.role()` - a `NullPointerException` rather than the
		   `ClassCastException` the single-argument overload throws on the same visitor -
		   but he is answered 500 either way. What holds the guard is not this comment:
		   `nobodyHasToSignInToSeeTheTeams` asks for 200 without a cookie and
		   `theVisitorsAnswerHasNotMoved` compares the visitor's answer byte for byte, so
		   taking the guard away fails both. */
		boolean administration = member != null && mayHe.may(member, OVER_THE_TEAMS);

		return db.sql("select t.id, t.slug, t.name,"
						/* The town in the two shapes V11 allows, and the country off whichever
						   of them the team used. The same three columns and the same coalesce as
						   on a member, because it is the same fact about a different thing. */
						+ " coalesce(town.name, t.city) as city,"
						+ " coalesce(town_country.code, typed_country.code) as country,"
						+ " t.bio,"
						/* AND THE MARK AND ITS SQUARE, WHICH ARE ONE FACT AND ARE ASKED FOR IN
						   ONE BREATH. The digest is what the picture is asked for BY (PhotoApi,
						   ADL A60) and never `mark.id`, which is countable. `crop_diameter` and
						   not `crop_side`: V21 renamed it when the three became fractions. All
						   four come off the same joined row, so there is no arrangement of the
						   data in which one of them is there and the others are not. */
						+ " mark.digest, mark.crop_x, mark.crop_y, mark.crop_diameter,"
						/* AND WHETHER THE ONE ASKING IS THE MEMBER THIS SEAT NAMES.
						   Written as two questions and not one, because `t.admin_id = :me`
						   alone is NULL for two different reasons - nobody is asking, and
						   the seat is empty - and those are the two sentences this field
						   exists to keep apart. The outer `case` answers the visitor with
						   null, which `@JsonInclude` leaves out; the `coalesce` answers a
						   signed in member `false` for a team whose seat nobody holds.

						   `t.admin_id` and never the member number: the number is what must
						   not leave (see the note on this class), and comparing keys means
						   this query never reads one.

						   CAST ON THE FIRST ONE, and it is a requirement rather than a
						   flourish: the other mention sits beside `t.admin_id` and takes its
						   type from it, but `? is null` stands alone and PostgreSQL refuses
						   the statement outright - „could not determine data type of
						   parameter $1" - rather than guessing. */
						+ " case when cast(:me as bigint) is null then null"
						+ "      else coalesce(t.admin_id = :me, false) end as founded_by_me,"
						/* AND WHO SITS IN THE SEAT, WHICH IS A FACT ABOUT THE TEAM AND NOT
						   ABOUT THE CALLER - the whole difference between this field and the
						   one above it. That one is the caller's own fact; this is a fact about
						   everybody, answered to the few who may read it. Written as
						   `t.admin_id = :me` it would hand the administration its own team and
						   nothing else, which is the shape a copy of the line above produces
						   and `theAdministrationIsToldWhoSitsInEverySeat` refuses.

						   THE EMPTY STRING IS READ OFF `t.admin_id` AND OFF NOTHING ELSE, which
						   is the correction of 21.09.2026 and the reason there is a `case` here
						   at all rather than a `coalesce`. Written `coalesce(seat.member_number,
						   '')` the empty string answered TWO different facts - „nobody sits
						   here" and „somebody sits here who has no member number" - and
						   `member_number` has been nullable since V16, which names the trap in
						   as many words: „a row in `competitor` is a PERSON WHO REGISTERED. A
						   MEMBER is a row whose `member_number` is there." So the empty string
						   is the seat being empty, and a seat held by somebody with no number
						   comes out of here NULL, which is its own sentence one line down.

						   AND THE CALLER IS NOT ASKED ABOUT HERE, which is the other half of
						   the same correction. `:administration` used to wrap this case, and
						   then „not for you" and „no number to give you" were both SQL null and
						   the mapper could not tell them apart. One guard, in one place, and it
						   is the place that can say all four things; a second guard here would
						   be one no mutation can reach, because the mapper would go on hiding
						   the field after it was taken away. */
						+ " case when t.admin_id is null then ''"
						+ "      else seat.member_number end as organizer_member_number"
						+ " from team t"
						+ " left join place town on town.id = t.place_id"
						+ " left join country town_country on town_country.id = town.country_id"
						+ " left join country typed_country on typed_country.id = t.country_id"
						/* Left, because a team with no mark is an ordinary team and not a team
						   missing from the list. */
						+ " left join photo mark on mark.id = t.logo_id"
						/* AND THE MEMBER IN THE SEAT, LEFT FOR THE SAME REASON: V11 made
						   `admin_id` nullable on purpose - „It EMPTIES rather than blocking
						   anything" - so a team with nobody in the seat is an ordinary team.
						   `competitor.id` is the primary key, so this joins at most one row and
						   a team still comes back once, which is what
						   `aTeamComesBackOnceHoweverManyMembersItHas` measures.

						   THIS IS THE ONE JOIN IN THIS QUERY THAT REACHES A MEMBER, and nothing
						   but `member_number` is read off it. The roster is still not joined;
						   who is IN a team remains /api/competitors' one answer. */
						+ " left join competitor seat on seat.id = t.admin_id"
						/* NOTHING IS JOINED TO `team_membership` HERE, and that is the decision
						   above rather than an omission: who is in which team is answered by
						   /api/competitors. A join would also give a team as many rows as it has
						   members. */
						+ " order by t.name, t.id")
				.param("me", me)
				.query((row, one) -> {
					/* Exact decimal all the way out, never a double. V21 chose `numeric(9, 8)`
					   for this and said why: the rule is about the exact boundaries 0 and 1, and
					   a binary fraction cannot be trusted at one. Reading it as a double here
					   would undo that on the way to the answer. */
					/* Every column of `photo` is NOT NULL, so each of these two is null
					   exactly when no picture joined, which is a team with no mark. They are
					   read side by side rather than one from the other so that the answer says
					   what the row says: a mark and its square go out together or neither
					   does, which is what `aTeamAnswersWithBothHalvesOfItsMarkOrNeither`
					   requires of every record. */
					String mark = row.getString(7);
					BigDecimal across = row.getBigDecimal(8);

					/* THE ONE GUARD OVER THE SEAT, AND THE ONLY PLACE THAT CAN SAY ALL FOUR
					   THINGS. `null` is the key gone, which is „I am not telling you";
					   `Optional.empty()` is the key carrying JSON null, which is „somebody
					   holds this seat and he is not a member". The query cannot tell those two
					   apart - both are SQL null - so the question „may he read this" is asked
					   HERE and nowhere else, off the boolean that already answered it.

					   `@JsonInclude(NON_NULL)` on an `Optional` is what makes the two spellings
					   two shapes, and it is MEASURED rather than trusted:
					   `theFourStatesOfTheSeatAreFourDifferentShapes` reads them off the wire.
					   Jackson 3 carries the Optional itself (3.1.4; the jdk8 types stopped
					   being a module of their own), so there is nothing to register. */
					Optional<String> inTheSeat =
							administration ? Optional.ofNullable(row.getString(12)) : null;

					return new Team(row.getLong(1), row.getString(2), row.getString(3),
							row.getString(4), row.getString(5), row.getString(6),
							/* The digest and never the key, and never the empty path for a team
							   that has none: an empty path is an address a browser would ask
							   for. */
							mark == null ? null : A_PICTURE_IS_ASKED_FOR_AT + mark,
							across == null ? null
									: new Crop(across, row.getBigDecimal(9), row.getBigDecimal(10)),
							row.getObject(11, Boolean.class), inTheSeat);
				})
				.list();
	}
}
