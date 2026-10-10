package com.btl.portal.web;

import com.btl.portal.domain.event.WhatARaceCarries;
import com.btl.portal.domain.event.WhatARaceCarries.Figures;
import com.btl.portal.domain.season.SeasonClock;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;

/**
 * WHAT IS WAITING FOR A MODERATOR, AND ONLY IN THE QUEUES THIS ONE MAY WORK IN.
 *
 * <p>The fifteenth and last resource of this API to be read, and the first whose ANSWER
 * depends on which rights the asker holds rather than on whether he holds one.
 *
 * <p><b>„Red za proveru" is not a thing any more; Verifikacija is</b> ({@code
 * PDL P28a, „prestaje da postoji kao zasebna stavka"}): „prestaje da postoji kao zasebna stavka i
 * postaje deo veće celine Verifikacija, jer moderator odobrava mnogo više od rezultata". It has
 * five queues (PDL P28a, 22.09.2026, „Verifikacija ima pet redova", eight then seven then six
 * then five; PDL P10a, 22.09.2026, „Redova je pet, ne šest" - the schedule tab left rather than
 * a seventh arriving) and they are not written down here - V5 already carries them as the five {@code
 * queue:} rows of the rights matrix, and V9 generates {@code verification.right_code} out of the
 * tab so that a row cannot exist in a tab nobody has the right to moderate. This class reads
 * that matrix and never a list of its own.
 *
 * <p><b>THIS RESOURCE HAS LEAKED ONCE ALREADY, AND IT WAS THE WORST LEAK OF THE
 * PROJECT.</b> The owner (PDL P28a, 07.08.2026, „Javne strane ne smeju da preuzimaju
 * red"): „Javne strane ne smeju da preuzimaju red za verifikaciju. Strana događaja ga je čitala
 * da bi našla odobrene komentare, pa je svaki posetilac dobijao u pregledač adrese neaktiviranih
 * članova i tekstove neodobrenih komentara, uključujući i onaj sa reklamom za tuđi link." {@link
 * CommentApi} is the other half of that decision and names {@code verification} nowhere at all;
 * this is the half that DOES serve the queue, so everything below is about who gets it.
 *
 * <p><b>NOTHING HERE IS PUBLIC.</b> ADL P-javno, the owner on 13.09.2026: „javno je ono
 * što Član 73 nabraja, i ništa više", and it names verification among the seven
 * resources it covers. Article 73 lists nothing whatever about a queue, so this route is
 * absent from {@link ApiSecurity#READ_BY_ANYBODY} and somebody who is not signed in is
 * answered 401 by the chain before this class runs - the same closedness
 * {@link CommentApi} and {@link AttendanceApi} have, enforced by NOT being enforced
 * here. There is no condition in this class about whether anybody is signed in, and
 * there must not be one.
 *
 * <p><b>AND IT CARRIES NO {@link RightIsNeeded}, WHICH IS THE ONE THING THAT MAKES THIS
 * RESOURCE DIFFERENT FROM EVERY OTHER.</b> That annotation names ONE code the superadmin
 * ticks, and it is the whole question the door asks. Here there are FIVE codes and the
 * question is not „may he" but „which of them may he": a moderator who holds
 * {@code queue:comments} and nothing else must be served the comments and must not learn
 * that a payments queue exists. A single code on the route could only be one of the five,
 * and it would either shut the route to four moderators out of five or open all five
 * queues to any one of them. So the privilege is decided by the ROW and not by the
 * route, and the route is named in {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT}
 * with exactly that reason.
 *
 * <p><b>What that costs is that the floor there stops asserting anything about this
 * address, so this class owes two guards the floor would otherwise have given it</b>, and
 * both are in {@code VerificationApiTest} and {@code RightsOverRealHttpTest}: a signed in
 * competitor holding nothing is refused, and his refusal is compared BYTE FOR BYTE with
 * the answer to an address that does not exist.
 *
 * <p><b>SOMEBODY WITH NO QUEUE AT ALL IS TOLD 404, THE SAME AS AN ADDRESS THAT IS NOT
 * THERE.</b> The owner (ADL A8, 13.09.2026, „Server odbija moderatora bez privilegije
 * sa 404"): „Server odbija moderatora bez privilegije sa 404, ne sa 403", his reason being that
 * the administration draws no screen a moderator may not open, so the server must not be the one
 * place that says the address is there. PDL P28a, 30.07.2026, „Odeljci Verifikacija i Entiteti
 * nemaju sopstvenu" says the same about this section from the screen's side: „Odeljci
 * Verifikacija i Entiteti nemaju sopstvenu stranu. Njihove adrese otvaraju prvi red odnosno prvi
 * entitet koji ta osoba sme, a naslovnu kad ne sme nijedan." A plain competitor and a moderator
 * with no tick on any queue are the same case here and get the same answer - and so is a
 * moderator who holds entity rights only, because an entity is not a queue and this section is
 * queues.
 *
 * <p><b>The refusal is {@code sendError} and never a status written onto the
 * response</b>, and that is not a style: {@link RightsAtTheDoor} measured on 13.09.2026
 * that a status alone came back 262 bytes with {@code Content-Length: 0} while an address
 * that maps nothing came back 412 bytes and chunked, which is an oracle for whether an
 * address exists, one request per guess. {@code sendError} is the road an address that is
 * not there already takes, so the body, the headers and the length are written by the
 * same code rather than kept equal by hand. MockMvc cannot see this and never could - it
 * does not run the container's ERROR dispatch - so the case that holds it reads both
 * answers off a socket ({@code RightsOverRealHttpTest}).
 *
 * <p><b>WHICH QUEUES HE MAY IS ASKED OF {@link WhatHeMayDo} AND OF NOTHING ELSE</b>, ADL
 * A8's second requirement: „Odgovara jedno mesto". Written as a condition in the SQL -
 * {@code exists (select 1 from account_admin_right ...)} - this would be a second home for
 * „may he", and it would get the superadmin wrong in the direction that matters: he holds
 * every right with no tick anywhere (V5's {@code rights_mode = 'all'}), so a query over the
 * ticks alone would serve him nothing and a query over the ticks OR the role would be the
 * whole of {@link com.btl.portal.domain.rights.AdminRights} written a second time in SQL.
 * The rights are read ONCE for the request ({@link WhatHeMayDo#whichOf}), so the five
 * answers cannot disagree with one another.
 *
 * <p><b>THE ANSWER IS A FLAT LIST OF ITEMS, AND UNTIL 22.09.2026 IT WAS GROUPED BY TAB.
 * THAT SHAPE IS WHAT BROKE THE SCREEN ON QA.</b> The portal asks for this resource
 * through {@code useResource<PendingItem[]>} ({@code pages/admin/pending.ts}) like the
 * other thirteen, and {@code PendingItem} carries its own {@code queue}. Grouped, every
 * wrapper {@code {queue, waiting}} passed the screen's own filter - it has a
 * {@code queue} field, and {@code decisions[undefined]} is undefined - so a WRAPPER was
 * drawn as though it were an item and „Timovi" threw on {@code undefined.trim()}. The
 * mismatch was known: {@code servedShape.test.ts} named {@code verification} as the one
 * resource it did not measure, „its whole shape is a decision the owner has not taken".
 * It is taken now, and it is the shape every other resource already had.
 *
 * <p><b>WHICH MEANS AN EMPTY TAB IS NO LONGER A ROW, AND THE OWNER'S DECISION STILL
 * HOLDS.</b> PDL P28a, 29.08.2026, „Prazan red ostaje u navigaciji": „Prazan red ostaje u
 * navigaciji i pokazuje nulu... Neka ostane vidljiva i neka piše 0." That sentence is
 * about the NAVIGATION, and the navigation never read it off this answer: the screen
 * names the tabs a moderator may work in off his RIGHTS ({@code usePermittedQueues} in
 * {@code pages/admin/mayOpen.ts}) and puts the count beside each by counting the items it
 * was handed ({@code countFor} in {@code pages/admin/queues.ts}). A tab with nothing
 * waiting is therefore still drawn, and still shows nought, with nothing in this answer
 * saying so. What the old shape bought was a row nobody read; what it cost was the one
 * resource on the portal whose answer no screen could read.
 *
 * <p><b>So the join from the rights matrix is INNER, where it used to be OUTER.</b> The
 * outer join existed for exactly one reason - to produce a row for a tab that had nothing
 * to join to - and with no row per tab there is nothing for it to produce. The state is
 * still tested in the JOIN rather than the WHERE, which is now a matter of saying one
 * thing once rather than of keeping an empty tab alive.
 *
 * <p><b>AND ONLY WHAT IS WAITING COMES OUT.</b> PDL P28a, 06.08.2026, „Red pokazuje samo ono što
 * čeka": „Sekcija „Rešeno" se ukida. Red pokazuje samo ono što čeka; šta je rešeno nije posao
 * koji stoji pred moderatorom." So {@code state = 'waiting'}, and what was approved or refused is
 * not in this answer in any shape - not the decision, not who made it, not the reason, and not
 * the state itself. The state would be the string {@code waiting} in every record, which is a
 * field a constant could answer; {@code Answers.noFieldIsTheSameInEveryRecord} refuses exactly
 * that, so leaving it out is measured rather than remembered.
 *
 * <p><b>THE NUMBER BESIDE A QUEUE IS NOT A FIELD OF THIS ANSWER, AND THAT IS A DECISION
 * WITH TWO WRITTEN REASONS.</b> PDL P28a, 30.07.2026, „Uz svaki red verifikacije stoji broj" asks
 * for a number beside every queue and says how it must be arrived at: „Broji se kroz isto mesto
 * kroz koje broji i brojač u zaglavlju, pa se tri broja ne mogu razići", and „Broj se ne osvežava
 * dolaskom na neku stranu nego u istom trenutku u kom se odluka donese". PDL P28a, 30.07.2026,
 * „Nijedan broj na portalu ne stoji na dva mesta" is the rule behind it: „Nijedan broj na portalu
 * ne stoji na dva mesta." A count served beside the list would be a second place the same fact
 * lives - and a STALE one the instant a moderator decides something, because the portal subtracts
 * what this visit has answered before it counts ({@code pages/admin/pending.ts}, {@code
 * waitingIn}) and a number computed on the server knows nothing of that. So the row carries its
 * items and the count is the reader's arithmetic, which is the shape the portal already has
 * ({@code countFor} in {@code pages/admin/queues.ts}) and the same subtraction {@link CommentApi}
 * makes for the overall mark: „Ukupna ocena se ne čuva nego se računa gde god se prikaže" (PDL
 * P28a, 07.08.2026, „Ukupna ocena se ne čuva nego se računa").
 *
 * <p><b>The tab is on the ITEM since 22.09.2026, and it is written ONCE.</b> It used to be
 * on the wrapper, „for that same rule", and the rule is untouched: a queue is what the
 * item is standing in, and it is answered in one place. With the wrapper gone that place
 * is the item, which is where {@code PendingItem} always kept it.
 *
 * <p><b>A LAPSED MEMBERSHIP IS NOT FILTERED OUT HERE, AND THAT IS THE ONE PLACE THIS
 * RESOURCE PARTS COMPANY WITH {@link AttendanceApi} AND {@link CommentApi} ON PURPOSE.</b>
 * Those two drop a member who has not renewed, because a number that leaves a PUBLIC
 * answer and does not leave {@code /api/competitors} names, by the difference between two
 * answers, „sve u vezi sa članarinom" - which Article 74 puts beside the date of birth.
 * There is no such subtraction to make here: nothing in this answer is public, the only
 * reader is the one moderator holding that tab's tick, and the payments tab exists
 * precisely for people whose fee is not recorded (PDL P28a, 22.09.2026, „Verifikacija ima pet
 * redova", „Uplate i aktivacija članova"). Filtering on {@code competitor.active} would empty the
 * tab this queue was built for. This is written down because it is the fifth place the same
 * question has been asked and the first place the answer is the other way round.
 *
 * <p><b>WHAT THE SCHEMA HAS NOWHERE TO HOLD IS LEFT OUT AND NAMED, never invented.</b> V9
 * says what it is and is not: „What this table is NOT. It does not model what each tab is
 * about... What it holds is the part every tab shares: who it is about, what was
 * proposed, and what a moderator decided."
 *
 * <p><b>Twelve fields stood under that sentence until 22.09.2026 and NINE of them gained a
 * home, which is why the sentence was rewritten rather than extended - and TWO of those
 * nine left again on 22.09.2026, the day PDL P10a removed the tab they answered for.</b> V9
 * holds the part every tab shares, but V11 gave the teams tab a proposal of its own
 * ({@code team_proposal}), and a proposal carries the town, the country and the team a
 * change is about; {@code competitor} carries the sender's name; which SORT of thing a
 * row is can be read off the schema twice over; and V30 gave the comments tab a proposal of
 * its own too ({@code comment_submission}), closing the pointer this class had none of
 * before - see the paragraph below. V30 gave the schedule tab the same shape
 * ({@code schedule_proposal}), and this migration's own increment is what took it away
 * again, tab and table and the two fields it alone answered. Naming a field as „left out"
 * while a column for it exists is worse than answering it: the list reads as a reason, and
 * a reason that is not true teaches the next reader to stop looking.
 *
 * <p><b>The two that really have no home are still named, each with the reason that is
 * true today</b>, in {@code VerificationApiTest.everyFieldThePortalReadsIsOneTheServerAnswersWith}:
 * the address of a registration, and the picture - which is not a missing column at all but
 * ADL A60, 20.09.2026: „Slika koju drzi samo nesto sto ceka odluku moderatora nije javna...
 * Takva slika odgovara tacno isto kao slika koje nema", so a digest answered here would draw a
 * broken frame. {@code Answers} checks both halves of every name, so a field that went missing
 * for some other reason cannot hide behind the list. <b>The third name, the circle over the
 * picture ({@code crop}), left this list on 10.10.2026</b> and is answered for the rows that hold
 * a picture: the sentence above is about a digest, which can be asked for and refused, and three
 * fractions of the picture's own edges are not an address and say nothing about the person in it
 * (the same reasoning {@code servedAge.test.ts} gives for the portrait's). What it is answered
 * FOR is named below.
 *
 * <p><b>WHICH IS STILL TRUE OF A DIGEST AND IS NO LONGER TRUE OF THE PICTURE, since ADL
 * A60's dopuna of 27.09.2026.</b> The sentence above is kept because it is still exactly why
 * no DIGEST is answered here: {@code GET /api/photos/{name}} refuses a picture only a queue
 * row holds, so a digest in this answer really would draw a broken frame. What changed is
 * that the picture has an address of its own - {@code PhotoApi.waitingOn}, {@code GET
 * /api/verification/{id}/photo} - open to the moderator who may decide about that row and
 * answering 404 to everybody else. The owner's reason for it was that he approved a
 * photograph on QA WITHOUT SEEING IT, this queue never having drawn one. <b>This paragraph
 * exists because the one above it, left alone, reads as „the moderator cannot be shown the
 * picture"</b>, which is the fault that increment closed rather than a rule it kept. The
 * {@code photoId} this answer already carries is the key of the picture the row holds and
 * not an address (the address is the row's own, with this number after a question mark that
 * the route does not read). <b>Since 10.10.2026 the portal reads it as the picture the card
 * drew</b>: a decision about the row names it, and {@link VerificationWriteApi} refuses a
 * decision about any other (PDL: „Odobrava se samo slika koju je moderator video").
 *
 * <p><b>AND THE CIRCLE IS ANSWERED BESIDE IT, AS THE OTHER HALF OF THE SAME NAME.</b> A circle
 * moved over the same picture is not a new key ({@code MePhotoApi.send} moves it on the row that
 * is there, measured 10.10.2026: the key 1 before and 1 after, the circle 0.30/0.70/0.45 before
 * and 0.125/0.875/0.625 after), and a decision that named the key alone would approve a circle
 * its moderator never had in front of him. So {@code crop} carries the three fractions of the
 * picture the row holds, a decision names them with the key, and {@link VerificationWriteApi}
 * compares both and refuses a decision about any other with the owner's sentence. <b>That is all
 * they are for.</b> The card still draws the whole original and no circle; drawing it as the owner decided
 * on 27.09.2026 („Isecak sa zatamnjenim ostatkom") is a job of its own, and the day it is done it
 * reads the fractions from this answer and needs nothing added here. Until then a circle moved
 * under his hand refuses his decision and the card, read again, looks exactly as it did: that is
 * the price of the owner's sentence while the card cannot show the circle, and it is written
 * where he can find it.
 *
 * <p><b>WHAT USED TO COST AN ACTION AND NOT AN EMPTY BOX, until 22.09.2026 (ADL A64).</b>
 * That is measured rather than described, and it is kept here rather than deleted because
 * the shape of the fault is worth knowing even solved: a blank never arrived as a gap on a
 * card, it arrived as a decision that quietly did nothing. {@code subjectId} was blank on
 * the comments tab - the column that would fill it did not exist, and the portal turns an
 * approved comment into a record with {@code eventId: Number(item.subjectId)}
 * ({@code frontend/src/data/comment.ts}), where {@code Number("")} is NOUGHT, so a comment
 * a moderator approved was filed under an event that did not exist rather than the one it
 * was about. Named as a fixed fault rather than an open one in {@code PENDING.md} now, and
 * a case below rather than a boundary. The schedule tab had the identical fault for the
 * identical reason - {@code proposedDate} blank for the same missing pointer, so approving
 * a reported change of term moved nothing at all - and PDL P10a, the same day, is why that
 * sentence is past tense rather than a second case here: the tab it was about is gone.
 *
 * <p><b>TWO POINTERS OUT OF THIS ROW NOW, WHERE V9 GAVE IT NONE.</b> {@code team_proposal_id}
 * (V11) and {@code comment_submission_id} (V30) are keys of this side's own tables, and a
 * key is not a fact the portal has any use for: what each tab draws is what the pointed-at
 * row holds under the portal's own names, so the proposal is followed here and never
 * answered by its id alone. {@code schedule_proposal_id} stood beside them from V30 until
 * PDL P10a, 22.09.2026 took the tab it served away with it, and the paragraph after this
 * one no longer needs to speak of it as a third source. {@code result_submission_id} (V10)
 * is followed now as well. Until the results flows moved onto the server it was neither read
 * nor answered, because the results tab was fed from the browser's session; it waited for the
 * increment that had a use for it, ADL P-javno's rule of leaving out rather than serving „za
 * svaki slučaj", and this is that increment. What it answers is the next paragraph.
 *
 * <p><b>WHAT A RUN WAITING IN THE RESULTS TAB ANSWERS WITH, and every name below is empty
 * on the other four tabs</b> - the empty string for text and nothing for a number or a day,
 * the shape {@code subjectId} and {@code photoId} already have. The pointer is the only way
 * in: {@code verification_only_the_results_queue_carries_a_submission} (V10) keeps it off
 * every other tab, so no row of another tab can join a run, the same guarantee {@code tp} and
 * {@code cs} below rest on.
 *
 * <ul>
 * <li><b>The race, by its key and by its name AS IT IS CALLED NOW.</b> {@code subject} on
 * this tab is the race's own name read off {@code race}, and not the copy
 * {@code ResultWriteApi} wrote into {@code verification.subject} on the day the run was
 * sent: a race renamed since is the race the run will be counted on, under its new name.
 * A race the calendar does not hold yet has no key, and its name is the one the member
 * typed (V10's „one way or the other, never both").
 * <li><b>The day it was run, beside the day it was sent.</b> {@code date} stays the day the
 * item arrived in the queue, and {@code raceDate} is the race's. Two days and never one
 * field for both: the owner, 18.09.2026 (PDL P9), „Odnosno verifikator vidi kad je rezultat
 * poslat", and the day it was sent is that.
 * <li><b>The kind of race</b>, the calendar's where the race is in it, and the member's
 * hint where it is not.
 * <li><b>The four figures AS AN APPROVAL WOULD COUNT THEM NOW</b>, through the one place
 * that answers which of them a race fixes ({@code WhatARaceCarries.figuresOf}), asked of
 * the race as it stands today and not of the copy taken when the run was sent. A moderator
 * is shown the numbers his approval writes, and not numbers it would quietly replace.
 * <li><b>The link</b> to the official results. The member's own comment is {@code body},
 * as it always was.
 * <li><b>{@code kind} is {@code correction} for a run that corrects a counted result</b>
 * ({@code amends_result_id}, V32), which is the whole of what the owner asked the queue to
 * be told: „samo labela, ne šta je ispravljano" (PDL P9, 27.08.2026).
 * </ul>
 *
 * <p><b>{@code subjectId} NOW ANSWERS THE EVENT A COMMENT IS ABOUT, NEVER THE SAME COLUMN
 * OF A DIFFERENT TABLE BY ACCIDENT.</b> {@code comment_submission.event_id} on the comments
 * tab and {@code team_proposal.team_id} still on the teams tab as it always did - two
 * sources for one field, and the two cannot collide:
 * {@code verification_only_the_<queue>_queue_carries_a_<x>} (V11, and V30 after it) means
 * at most one of the two pointers a row carries is ever non-null. {@code PendingQueue.tsx}
 * finds the event this way already - {@code eventOf = (one) =>
 * allEvents.find((each) => String(each.id) === one.subjectId)} - for the comments tab
 * ({@code commentFrom}), so one column answers what that file already expected of it. It
 * read the schedule tab's {@code schedule_proposal.event_id} the identical way until PDL
 * P10a took the tab and {@code moveEvent} away together.
 *
 * <p><b>{@code rating} ANSWERS NOW TOO</b>, off {@code comment_submission} (V30). It is
 * nought on every tab but comments, the same {@code NO_RATING} the portal itself hands out
 * for a comment written before the marks existed - so a moderator reading a WAITING comment
 * sees exactly what he will see once it is published. {@code currentDate} and
 * {@code proposedDate} answered the identical way for the schedule tab, off
 * {@code schedule_proposal} (V30): the day the event stood on RIGHT NOW, read live off
 * {@code btl_event.date} and never off the report's own stale column, and the day the
 * report asked to move it to. Both left with the tab, on PDL P10a, 22.09.2026; what moves
 * an event from the day it actually stands on is {@code EventWriteApi} now, exactly as it
 * always was on its own road.
 *
 * <p><b>The picture is answered as the id of a row in {@code photo}</b>, which is a name
 * the portal does not read yet and is therefore declared as something answered on
 * purpose. V9 keeps the photograph on the queue row while there still is one, and
 * {@code verification_decided_keeps_no_photo} - „state = 'waiting' or photo_id is null" -
 * means a decided row cannot hold one at all. So even the mutation that lets decided rows
 * into this answer cannot carry a photograph out with them; that is the schema's guarantee
 * and not this class's, and the cases that fall if it is lost are the two violations
 * {@code VerificationConstraintsTest} already keeps against that constraint.
 *
 * <p><b>The shapes are the schema's and not the file's</b> - {@link CalendarApi}'s
 * decision of 12.09.2026, which {@link AttendanceApi} and {@link ModeratorApi} repeat:
 * {@code id} answers with {@code verification.id}, a {@code bigserial}, and not with the
 * text slugs ({@code ver-upl-1}) the prototype file used before there was a schema to
 * answer from.
 *
 * <p><b>THE DAY IS THE DAY IN BELGRADE.</b> V9 stores {@code raised_at} as a
 * {@code timestamptz} because arriving in a queue is a technical instant; the portal
 * draws a DAY. Which day that is in Belgrade is this side's arithmetic, done in the zone
 * {@link SeasonClock} owns and never with a zone written into the query - read as the
 * machine's day it would be right in Belgrade and wrong on a server kept in UTC, which is
 * every server this portal runs on. {@link CommentApi} does the identical thing to
 * {@code published_at} for the identical reason.
 *
 * <p><b>By tab, oldest first, which is the only way the queue is ever read</b> - V9 says
 * so and puts the index on {@code (queue, raised_at)} to match. The key breaks the tie so
 * the order is total: two items raised in the same instant would otherwise come back in
 * whatever order the rows were written, and a screen a moderator works down would
 * reshuffle between two readings of data nobody touched.
 */
@RestController
class VerificationApi {

	private final JdbcClient db;

	private final WhatHeMayDo mayHe;

	VerificationApi(JdbcClient db, WhatHeMayDo mayHe) {
		this.db = db;
		this.mayHe = mayHe;
	}

	/**
	 * One item nobody has answered yet.
	 *
	 * @param queue        the tab it is standing in, as {@code admin_right.target} spells
	 *                     it and as {@code verification.queue} holds it: {@code results},
	 *                     {@code payments}, {@code teams}, {@code profiles},
	 *                     {@code comments}
	 * @param id           {@code verification.id}
	 * @param date         the day it arrived in the queue, in the league's own zone
	 * @param memberNumber whose it is, or nothing at all. Two different states answer
	 *                     the same way and both are ordinary: a row about nobody in the
	 *                     record ({@code competitor_id} is nullable on purpose, „A
	 *                     payment waiting to be recognised may be about a person who is
	 *                     not one yet"), and a row about somebody who has registered and
	 *                     whose fee is not recorded, who since V16 is a {@code competitor}
	 *                     with no number - „A row in competitor is a PERSON WHO
	 *                     REGISTERED. A MEMBER is a row whose member_number is there."
	 * @param who          the name of whoever sent it in, or blank where no row in
	 *                     {@code competitor} is named. Read beside {@code subject} and
	 *                     never instead of it: on the payments tab the two are the same
	 *                     person and everywhere else they are not, which is why the screen
	 *                     draws „poslao" off this one and the heading off the other
	 * @param subject      what the decision is about, which V9 makes NOT NULL because it
	 *                     „carries the name in every case"
	 * @param subjectId    the same thing by its key, WHERE THERE IS ONE, and blank
	 *                     everywhere else. Two sources since V30 and never both on a row:
	 *                     the team a proposal asks to change ({@code team_proposal.team_id},
	 *                     blank for a proposal of a new team), and the event a waiting
	 *                     comment is about ({@code comment_submission.event_id}). Text and
	 *                     not a number, because the portal compares it against
	 *                     {@code String(team.id)} on the teams tab and against
	 *                     {@code String(each.id)} on the other one
	 *                     ({@code pages/admin/PendingQueue.tsx}, {@code eventOf})
	 * @param body         what was written or proposed, blank for a tab that proposes
	 *                     nothing - the same shape {@code competitor.bio} has
	 * @param kind         WHICH SORT OF THING IT IS, where one tab holds more than one,
	 *                     and blank on the tabs that hold a single sort. Worked out here
	 *                     rather than stored, because the schema already says it twice
	 *                     over and a third column could disagree with both: a teams row
	 *                     carrying a proposal that names a team is a change to that team
	 *                     ({@code teamEdit}), and a profiles row is a picture exactly when
	 *                     it still holds one and a biography otherwise. The two words are
	 *                     the portal's own ({@code ITEM_KINDS} in {@code data/types.ts})
	 * @param city         THE TOWN, ON THE TWO TABS THAT HAVE ONE, and blank on the other
	 *                     three. The portal says which two and why in as many words
	 *                     ({@code PendingItem.city} in {@code data/types.ts}): „On the
	 *                     payments, because how a member pays follows the country they live
	 *                     in (PDL P8)... On the new teams, because approving a proposal is
	 *                     what makes the team and these are two of the four things it is
	 *                     made from (PDL P13). Empty on the other five." So the two tabs
	 *                     read it from two different places and the SAME
	 *                     {@code coalesce} {@link TeamApi} and {@link CompetitorApi} already
	 *                     make is made twice: off {@code team_proposal} for a proposal, off
	 *                     {@code competitor} for a registration. Each of those tables holds
	 *                     a town the one way or the other and never both, by a constraint
	 *                     of the same shape
	 *                     ({@code team_proposal_town_is_from_the_codebook_or_typed},
	 *                     {@code competitor_town_is_from_the_codebook_or_typed}).
	 *
	 *                     <p>Which of the two is read is decided by the TAB and never by
	 *                     which row happens to join: written as one long {@code coalesce}
	 *                     falling through from the proposal to the sender, the three tabs the
	 *                     portal says carry no town would carry the sender's, and a
	 *                     moderator reading a comment would be shown where its author lives.
	 *                     Until 22.09.2026 it was read off {@code team_proposal} alone, so
	 *                     the payments tab drew its own „Mesto" column
	 *                     ({@code pages/admin/Payments.tsx}) empty on every row
	 * @param country      its country, AS THE CODE AND NEVER THE NAME, which is the shape
	 *                     both resources above answer with and the shape the portal reads
	 *                     ({@code countryName} turns it into words). Blank with the town,
	 *                     and off the same side of the same {@code case}: a row answering
	 *                     one tab's town beside another tab's country is the one shape that
	 *                     looks right and is not
	 * @param photoId      the picture while there still is one, and nothing where the tab
	 *                     carries none. It is what a decision about the row names, as the
	 *                     picture the moderator saw ({@code seenPhotoId} of {@code
	 *                     VerificationWriteApi.Answered}), so it must be the key of the
	 *                     picture the card draws and nothing else
	 * @param crop         the circle the member set over THAT picture, the one the row holds
	 *                     while it waits and not the one on his profile, and nothing where
	 *                     {@code photoId} is nothing. <b>It is the second half of what a
	 *                     decision about the row names</b> ({@code seenCrop} of {@code
	 *                     VerificationWriteApi.Answered}), and it is answered for that and for
	 *                     nothing else: the card still draws the whole original and no circle
	 *                     (the note on {@code PhotoApi.waitingOn}; drawing the crop is a job of
	 *                     its own). Needed because a circle moved over the same picture does not
	 *                     change its key ({@code MePhotoApi.send} moves it on the row that is
	 *                     there), so the key alone cannot say that what he saw has changed
	 * @param rating       what a member thought of the event, on the comments tab and
	 *                     {@code NO_RATING} - nought on all three marks - everywhere else,
	 *                     off {@code comment_submission} (V30). The portal's own default
	 *                     for a comment nobody has rated, so a moderator reading a WAITING
	 *                     one sees the same nought a published one with no marks would show
	 * @param raceId       the race a waiting run was run at, on the results tab, and nothing
	 *                     where the calendar does not hold it yet or the tab carries no run
	 * @param raceDate     the day that run was run, which is not {@code date}: that one is
	 *                     the day the run was SENT (see the class note)
	 * @param raceKind     the calendar's kind of that race, or the member's hint where the
	 *                     calendar does not hold it; empty on the other tabs
	 * @param distanceKm   the four figures as an approval would count them now, read through
	 *                     {@code WhatARaceCarries.figuresOf}; nothing on the other tabs
	 * @param link         the official results the member pointed at, and empty where he
	 *                     sent none or the tab carries no run
	 */
	record Waiting(String queue, long id, LocalDate date, String memberNumber, String who,
			String subject, String subjectId, String body, String kind, String city,
			String country, Long photoId, Crop crop, Rating rating, Long raceId, LocalDate raceDate,
			String raceKind, BigDecimal distanceKm, Integer ascentM, Integer descentM,
			Integer seconds, String link) {
	}

	/**
	 * Which circle of a picture, as three fractions between 0 and 1.
	 *
	 * <p>The same three numbers under the same names {@link CompetitorApi.Crop}, {@link TeamApi.Crop}
	 * and {@code MePhotoApi.Crop} answer with, and for the reason they give: the column has been
	 * {@code crop_diameter} since V21 and the portal's word is {@code size}. A copy of its own and not
	 * a shared record is what those three already do, and it holds here too - each resource owns the
	 * shape of its own answer. {@code VerificationWriteApi} takes the same record back, because a
	 * decision names the circle exactly as the queue served it.
	 */
	record Crop(BigDecimal x, BigDecimal y, BigDecimal size) {
	}

	/**
	 * The three marks PDL P6 fixes, off {@code comment_submission} on the comments tab and
	 * nought on the other five - the same shape and the same names {@link CommentApi.Rating}
	 * already answers with, once a comment is published rather than waiting.
	 */
	record Rating(int organisation, int value, int ambience) {
	}

	/**
	 * @param response asked for so that a refusal can go down the same road an address
	 *                 that is not there takes. It is the one thing this method does that
	 *                 is not answering.
	 */
	@GetMapping("/api/verification")
	List<Waiting> verification(HttpServletResponse response) throws IOException {
		List<String> his = mayHe.whichOf(everyQueueThereIs());

		/* NOTHING TO SHOW HIM IS THE SAME AS NOTHING BEING HERE (owner, 13.09.2026,
		   ADL A8, 13.09.2026, „Server odbija moderatora bez privilegije sa 404"; PDL P28a, 30.07.2026,
		   „Odeljci Verifikacija i Entiteti nemaju sopstvenu" says the section opens „naslovnu kad ne
		   sme nijedan"). This is a plain competitor, and it is equally a moderator who holds entity
		   rights and no queue.

		   Read off the SAME list the answer is built from, so „he may see no queue" and
		   „the answer would be empty" are one fact and cannot come apart. A second
		   condition asking the database again would be a second way of arriving at it,
		   which is how two answers about one thing start to disagree. */
		if (his.isEmpty()) {
			response.sendError(HttpStatus.NOT_FOUND.value());
			return null;
		}

		return waitingIn(his);
	}

	/**
	 * The five tabs, read off the rights matrix rather than written down.
	 *
	 * <p>V5 put them there and V9 pointed a foreign key at them, so „which tabs exist" and
	 * „which tabs can be moderated" are one list by construction. A sixth tab must first
	 * be a right somebody decided to grant, and it reaches this answer on the day it is
	 * inserted rather than on the day somebody remembers this file.
	 *
	 * <p>By {@code target} and not by {@code code}, so the order is the tab's own and does
	 * not depend on a prefix every one of them shares.
	 */
	private List<String> everyQueueThereIs() {
		return db.sql("select code from admin_right where scope = 'queue' order by target")
				.query(String.class).list();
	}

	private List<Waiting> waitingIn(List<String> his) {
		return db.sql("select r.target, v.id, v.raised_at, c.member_number,"
						/* WHO SENT IT IN. Blank and never null, because the portal's type
						   says so in as many words - „Who sent it in, or empty" - and reads
						   `one.who === ''` to decide whether to draw the line at all. */
						+ " coalesce(c.first_name || ' ' || c.last_name, '') as who,"
						/* WHAT IT IS ABOUT, and on the results tab that is the race AS IT IS
						   CALLED NOW (see the class note). The race and the name a member typed
						   are V10's two exclusive ways of naming one, so the coalesce never
						   chooses between two that are both there; on every other tab neither
						   is, because only the results tab carries a submission at all. */
						+ " coalesce(ra.name, rs.race_name, v.subject) as subject,"
						/* THE THING A DECISION IS ABOUT, BY ITS KEY, and blank everywhere else.
						   Two sources since V30 and never both at once on one row -
						   `verification_only_the_<queue>_queue_carries_a_<x>` (V11, V30) makes
						   that unreachable by construction, the same way `kind` below already
						   relies on it. Read off the proposal and never off `subject`: two
						   teams may carry one name, so a change matched by its name would be
						   filed against whichever was found first, and two events may carry one
						   too (PDL P6, an event copied into the next season keeps its name). */
						+ " coalesce(cast(tp.team_id as text), cast(cs.event_id as text), '')"
						+ "     as subject_id,"
						+ " v.body,"
						/* WHICH SORT OF THING IT IS, asked of the schema and not of a column
						   of its own. `tp.team_id` can only be there on the teams tab -
						   `verification_only_the_teams_queue_carries_a_proposal` says so and
						   this does not re-derive it - and a profiles row holds a photograph
						   exactly while the picture is what is being decided. */
						+ " case when tp.team_id is not null then 'teamEdit'"
						+ "      when v.queue = 'profiles' and v.photo_id is not null then 'photo'"
						+ "      when v.queue = 'profiles' then 'bio'"
						/* AND A RUN THAT CORRECTS A COUNTED RESULT, the third tab holding two
						   sorts of thing, read off V32's pointer the way `teamEdit` is read off
						   V11's: „samo labela" is what the owner asked the queue to be told. */
						+ "      when rs.amends_result_id is not null then 'correction'"
						+ "      else '' end as kind,"
						/* THE TOWN THE ONE WAY OR THE OTHER, which is the same coalesce
						   `TeamApi` and `CompetitorApi` already make over the identical three
						   columns. The country is the CODE, as it is in both of those: the
						   portal turns it into words itself.

						   AND OFF TWO DIFFERENT TABLES, BY THE TAB, since 22.09.2026. The
						   portal draws a town on the payments tab and on the teams tab and
						   on no other (`PendingItem.city`), and the two are two different
						   facts: the town a proposal asks for, and the town the person
						   registering lives in - which is what PDL P8 hangs the way he pays
						   on. Both tables hold one the same two ways, so the coalesce is the
						   same and only the columns differ.

						   BY THE TAB AND NOT BY WHICH ROW JOINS, and that is the whole of
						   this `case`. Written as one coalesce falling from the proposal
						   through to the sender, a comment would answer with its AUTHOR'S
						   town - three tabs the portal says carry none, showing a moderator
						   where a member lives beside a text he is deciding about. */
						+ " case when v.queue = 'payments'"
						+ "      then coalesce(his_town.name, c.city, '')"
						+ "      else coalesce(town.name, tp.city, '') end as city,"
						+ " case when v.queue = 'payments'"
						+ "      then coalesce(his_towns_country.code, his_typed_country.code, '')"
						+ "      else coalesce(town_country.code, typed_country.code, '') end"
						+ "      as country,"
						+ " v.photo_id,"
						/* WHAT A MEMBER THOUGHT OF THE EVENT, off `comment_submission` (V30),
						   and nought on the other four tabs - the portal's own word for a
						   comment nobody has rated (`NO_RATING`), so a moderator sees exactly
						   what a published comment with no marks would show him too. */
						+ " coalesce(cs.rating_organisation, 0) as rating_organisation,"
						+ " coalesce(cs.rating_value, 0) as rating_value,"
						+ " coalesce(cs.rating_ambience, 0) as rating_ambience,"
						/* A RUN WAITING IN THE RESULTS TAB, all of it nothing on every other
						   tab (see the class note). The race's own figures are read beside the
						   run's, and which of the two each served figure is taken from is
						   decided in Java by `WhatARaceCarries.figuresOf` and not by a `case`
						   here: written in SQL it would be a second answer to „whose figure is
						   this", free to disagree with the one the approval counts by. */
						+ " rs.race_id, rs.race_date,"
						+ " coalesce(ra.kind, rs.race_kind, '') as race_kind,"
						+ " ra.kind as the_races_kind, ra.distance_km as the_races_distance,"
						+ " ra.ascent_m as the_races_ascent, ra.descent_m as the_races_descent,"
						+ " ra.limit_seconds as the_races_limit,"
						+ " rs.distance_km as sent_distance, rs.ascent_m as sent_ascent,"
						+ " rs.descent_m as sent_descent, rs.seconds as sent_seconds,"
						+ " coalesce(rs.link, '') as link,"
						/* THE CIRCLE OF THE PICTURE THIS ROW HOLDS, named and last so that nothing
						   above it moves: the mapping reads the early columns by place. Off `shown`
						   below, which is joined by the ROW's pointer and never by the member's
						   portrait - while a picture waits the two are two different pictures with
						   two different circles (ADL A60: it is not on the profile yet), and a
						   circle read off the wrong one would let a decision about the one he saw
						   be compared with the circle of the other. */
						+ " shown.crop_x, shown.crop_y, shown.crop_diameter"
						/* THE TWO DAYS A REPORTED CHANGE OF TERM ONCE CARRIED STOOD HERE, off
						   `schedule_proposal` (V30), from the day that table arrived until PDL
						   P10a took its tab away the same day: „Redova je pet, ne šest." Neither
						   is answered nor stored any more - `schedule_proposal` itself is gone
						   (V31) - so there is nothing left to read live off `btl_event.date` or
						   to leave captured for history. */
						/* DRIVEN BY THE RIGHTS AND NOT BY THE ROWS, so the condition that
						   decides „may he" is the only thing that picks tabs. Read the other
						   way round - from `verification` outwards - the tabs a moderator
						   holds would be decided by which rows happen to exist. */
						+ " from admin_right r"
						/* The join is on `right_code`, which V9 GENERATES as `'queue:' ||
						   queue` and keys to `admin_right(code)`: the row itself carries the
						   exact privilege that opens it, and a row cannot exist in a tab that
						   has no right. Nothing here re-derives that.

						   INNER since 22.09.2026, and the paragraph this replaces argued for
						   an outer join: the answer used to carry a row per TAB, so a tab
						   worked to the bottom had to survive having nothing to join to. The
						   answer carries items now and an item is what a moderator works on,
						   so a tab with nothing waiting contributes nothing, which is what
						   „nothing is waiting" means. The nought the owner asked for
						   (29.08.2026) is drawn where it always was: the screen names its
						   tabs off the RIGHTS (`usePermittedQueues`) and counts the items it
						   was given (`countFor`), neither of which this answer decides. */
						+ " join verification v"
						+ "   on v.right_code = r.code and v.state = 'waiting'"
						/* AND WHOSE IT IS, WHILE THERE IS A NUMBER TO GIVE. Left, twice over:
						   `competitor_id` is nullable by V9's decision, and since V16 a
						   competitor who has registered and not paid has no number. Neither is
						   filtered out - see the note on this class about the tab that exists
						   for exactly those people. */
						+ " left join competitor c on c.id = v.competitor_id"
						/* AND THE PROPOSAL A TEAMS ROW POINTS AT, with the two ways V11 lets
						   it hold a town. All four are LEFT: every other tab has no proposal,
						   and a proposal has either a row in the codebook or a town somebody
						   typed, never both. */
						+ " left join team_proposal tp on tp.id = v.team_proposal_id"
						+ " left join place town on town.id = tp.place_id"
						+ " left join country town_country on town_country.id = town.country_id"
						+ " left join country typed_country on typed_country.id = tp.country_id"
						/* AND THE TOWN THE SENDER HIMSELF LIVES IN, which the payments tab
						   draws and the other four do not. The same three columns in the
						   same two ways, on `competitor` this time
						   (`competitor_town_is_from_the_codebook_or_typed`), and all three
						   LEFT for the same reason `competitor` itself is: a payment waiting
						   to be recognised may be about nobody in the record at all. */
						+ " left join place his_town on his_town.id = c.place_id"
						+ " left join country his_towns_country"
						+ "   on his_towns_country.id = his_town.country_id"
						+ " left join country his_typed_country"
						+ "   on his_typed_country.id = c.country_id"
						/* AND THE PROPOSAL V30 GAVE THE COMMENTS TAB, LEFT for the reason
						   every proposal join here is: only its own tab ever carries one, by
						   the same pair of constraints that already keeps `tp` off every row
						   but the teams tab's. The schedule tab had the identical join, off
						   `schedule_proposal`, until PDL P10a took the tab and the table both
						   away (V31). */
						+ " left join comment_submission cs on cs.id = v.comment_submission_id"
						/* AND THE RUN V10 GAVE THE RESULTS TAB, with the race it was run at.
						   LEFT twice over: every other tab carries no submission, and a run on a
						   race the calendar does not hold yet has no race to join. Joined by the
						   POINTER and never by whose run it is - a comment and a run by the same
						   member are two items, and a join on the member would hand his comment
						   the figures of his run. */
						+ " left join result_submission rs on rs.id = v.result_submission_id"
						+ " left join race ra on ra.id = rs.race_id"
						/* AND THE PICTURE THE ROW HOLDS, LEFT: only a profiles row holds one, and
						   only while it waits (`verification_decided_keeps_no_photo`, V9), so
						   every other row joins to nothing and answers no circle. */
						+ " left join photo shown on shown.id = v.photo_id"
						/* THE ONES HE MAY, decided by `WhatHeMayDo` and passed in. Written
						   here as a condition over the ticks it would be a second home for
						   „may he" and would answer the superadmin, who holds everything with
						   no tick anywhere, with nothing at all. */
						+ " where r.code in (:mine)"
						/* BY TAB, OLDEST FIRST (V9), and the key last so the order is total.
						   Kept although the answer is no longer grouped: the screen walks one
						   tab down the list it was given, so two items raised in the same
						   instant would otherwise reshuffle between two readings of data
						   nobody touched. */
						+ " order by r.target, v.raised_at, v.id")
				.param("mine", his)
				.query((row, one) -> {
					Figures counted = countedAt(row);

					return new Waiting(row.getString(1), row.getLong(2),
							row.getTimestamp(3).toInstant().atZone(SeasonClock.ZONE).toLocalDate(),
							row.getString(4), row.getString(5), row.getString(6), row.getString(7),
							row.getString(8), row.getString(9), row.getString(10), row.getString(11),
							row.getObject(12, Long.class),
							row.getObject("crop_x") == null ? null
									: new Crop(row.getBigDecimal("crop_x"), row.getBigDecimal("crop_y"),
											row.getBigDecimal("crop_diameter")),
							new Rating(row.getInt(13), row.getInt(14), row.getInt(15)),
							row.getObject("race_id", Long.class),
							row.getObject("race_date", LocalDate.class),
							row.getString("race_kind"), counted.distanceKm(), counted.ascentM(),
							counted.descentM(), counted.seconds(), row.getString("link"));
				})
				.list();
	}

	/**
	 * THE FOUR FIGURES OF A WAITING RUN AS AN APPROVAL WOULD COUNT THEM TODAY.
	 *
	 * <p>Where the run was sent from the calendar, the race is asked through
	 * {@link WhatARaceCarries#figuresOf}, as it stands now, which is exactly what
	 * {@link VerificationWriteApi} asks when the moderator approves it, so the screen and the
	 * standings cannot come to disagree about a figure the race fixes. Where it was not - a race
	 * the calendar does not hold yet, or a tab that carries no run at all - there is no race to
	 * ask, and what was sent is all there is: four figures for the first, nothing for the
	 * second.
	 */
	private static Figures countedAt(ResultSet row) throws SQLException {
		Figures sent = new Figures(row.getBigDecimal("sent_distance"),
				row.getObject("sent_ascent", Integer.class),
				row.getObject("sent_descent", Integer.class),
				row.getObject("sent_seconds", Integer.class));
		String theRacesKind = row.getString("the_races_kind");

		return theRacesKind == null ? sent
				: WhatARaceCarries.figuresOf(new WhatARaceCarries.ARace(theRacesKind,
						row.getBigDecimal("the_races_distance"), row.getInt("the_races_ascent"),
						row.getInt("the_races_descent"), row.getInt("the_races_limit")), sent);
	}
}
