package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * WHAT IS WAITING FOR A MODERATOR, AND ONLY IN THE QUEUES THIS ONE MAY WORK IN.
 *
 * <p>The fifteenth and last resource of this API to be read, and the first whose ANSWER
 * depends on which rights the asker holds rather than on whether he holds one.
 *
 * <p><b>„Red za proveru" is not a thing any more; Verifikacija is</b> ({@code
 * PDL P28a, „prestaje da postoji kao zasebna stavka"}): „prestaje da postoji kao zasebna stavka i
 * postaje deo veće celine Verifikacija, jer moderator odobrava mnogo više od rezultata". It has
 * six queues (PDL P28a, 24.08.2026, „Verifikacija ima šest redova", eight then seven then six)
 * and they are not written down here - V5 already carries them as the six {@code queue:} rows of
 * the rights matrix, and V9 generates {@code verification.right_code} out of the tab so that a
 * row cannot exist in a tab nobody has the right to moderate. This class reads that matrix and
 * never a list of its own.
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
 * ticks, and it is the whole question the door asks. Here there are SIX codes and the
 * question is not „may he" but „which of them may he": a moderator who holds
 * {@code queue:comments} and nothing else must be served the comments and must not learn
 * that a payments queue exists. A single code on the route could only be one of the six,
 * and it would either shut the route to five moderators out of six or open all six
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
 * The rights are read ONCE for the request ({@link WhatHeMayDo#whichOf}), so the six
 * answers cannot disagree with one another.
 *
 * <p><b>AN EMPTY QUEUE IS A ROW WITH AN EMPTY LIST, NOT A ROW THAT IS MISSING.</b> The
 * owner (PDL P28a, 29.08.2026, „Prazan red ostaje u navigaciji"): „Prazan red ostaje
 * u navigaciji i pokazuje nulu. Neka ipak ne nestaju stavke iz Verifikacije kad se odobre. Neka
 * ostane vidljiva i neka piše 0." That is the same shape {@link ModeratorApi} has for a moderator
 * with no ticks and says out loud - „An empty list is not a broken record" - and it is why the
 * queue is reached by an OUTER join from the rights matrix rather than by an inner join from the
 * rows: a tab whose every item has been decided is precisely the tab this decision is about, and
 * an inner join drops it without a word. For the same reason the state is tested in the JOIN and
 * not in the WHERE - moved there, a tab holding nothing but decided rows disappears again, by a
 * different spelling of the same mistake.
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
 * <p><b>The tab is on the ROW and not on the item, for that same rule.</b> A queue is
 * what the item is standing in; written on both it could disagree with itself.
 *
 * <p><b>A LAPSED MEMBERSHIP IS NOT FILTERED OUT HERE, AND THAT IS THE ONE PLACE THIS
 * RESOURCE PARTS COMPANY WITH {@link AttendanceApi} AND {@link CommentApi} ON PURPOSE.</b>
 * Those two drop a member who has not renewed, because a number that leaves a PUBLIC
 * answer and does not leave {@code /api/competitors} names, by the difference between two
 * answers, „sve u vezi sa članarinom" - which Article 74 puts beside the date of birth.
 * There is no such subtraction to make here: nothing in this answer is public, the only
 * reader is the one moderator holding that tab's tick, and the payments tab exists
 * precisely for people whose fee is not recorded (PDL P28a, 24.08.2026, „Verifikacija ima šest
 * redova", „Uplate i aktivacija članova"). Filtering on {@code competitor.active} would empty the
 * tab this queue was built for. This is written down because it is the fifth place the same
 * question has been asked and the first place the answer is the other way round.
 *
 * <p><b>WHAT THE SCHEMA HAS NOWHERE TO HOLD IS LEFT OUT AND NAMED, never invented.</b> V9
 * says what it is and is not: „What this table is NOT. It does not model what each tab is
 * about... What it holds is the part every tab shares: who it is about, what was
 * proposed, and what a moderator decided." The file the portal serves today carries
 * twelve fields more - the sort of item, the name of whoever sent it in beside the
 * subject, the id of what an approval writes about, the picture and its crop, the two
 * dates a reported change of term carries, the three marks of a comment, and the address,
 * town and country of a registration - and there is no column for any of them.
 * {@code VerificationApiTest.everyFieldThePortalReadsIsOneTheServerAnswersWith} names all
 * twelve with this reason, and {@code Answers} checks both halves of every name, so a
 * field that went missing for some other reason cannot hide behind the list.
 *
 * <p><b>And the two pointers V10 and V11 added are left out too, which is a decision
 * rather than an oversight.</b> {@code result_submission_id} and {@code team_proposal_id}
 * exist for what an APPROVAL writes, and this increment writes nothing: the layer of
 * 13.09.2026 „ne uvodi nijedan upis" (ADL A8), and the screen that will need them is not
 * switched to this endpoint (A50 - the portal changes files once, together, when every
 * resource exists). ADL P-javno's rule is to leave out rather than to serve „za svaki
 * slučaj", so they wait for the increment that has a use for them.
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
	 * One tab of the verification screen, as this moderator sees it.
	 *
	 * @param queue   the tab, as {@code admin_right.target} spells it and as
	 *                {@code verification.queue} holds it: {@code results},
	 *                {@code payments}, {@code teams}, {@code profiles},
	 *                {@code comments}, {@code schedule}
	 * @param waiting what is standing in it undecided, oldest first; EMPTY for a tab
	 *                where everything has been answered, which is a tab showing nought
	 *                and not a tab that has gone away (owner, 29.08.2026)
	 */
	record Queue(String queue, List<Waiting> waiting) {
	}

	/**
	 * One item nobody has answered yet.
	 *
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
	 * @param subject      what the decision is about, which V9 makes NOT NULL because it
	 *                     „carries the name in every case"
	 * @param body         what was written or proposed, blank for a tab that proposes
	 *                     nothing - the same shape {@code competitor.bio} has
	 * @param photoId      the picture while there still is one, and nothing where the tab
	 *                     carries none
	 */
	record Waiting(long id, LocalDate date, String memberNumber, String subject, String body,
			Long photoId) {
	}

	/**
	 * @param response asked for so that a refusal can go down the same road an address
	 *                 that is not there takes. It is the one thing this method does that
	 *                 is not answering.
	 */
	@GetMapping("/api/verification")
	List<Queue> verification(HttpServletResponse response) throws IOException {
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
	 * The six tabs, read off the rights matrix rather than written down.
	 *
	 * <p>V5 put them there and V9 pointed a foreign key at them, so „which tabs exist" and
	 * „which tabs can be moderated" are one list by construction. A seventh tab must first
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

	private List<Queue> waitingIn(List<String> his) {
		List<Line> lines = db.sql("select r.target, v.id, v.raised_at, c.member_number,"
						+ " v.subject, v.body, v.photo_id"
						/* DRIVEN BY THE RIGHTS AND NOT BY THE ROWS, which is the whole of
						   „Prazan red ostaje i piše 0" (owner, 29.08.2026). Read the other
						   way round - from `verification` outwards - a tab whose every item
						   has been answered has no row to drive anything and disappears. */
						+ " from admin_right r"
						/* LEFT, and the state tested HERE rather than in the where clause.
						   Either change loses the empty tab: an inner join loses it because
						   there is nothing to join to, and a `where v.state = 'waiting'`
						   loses it because the null the outer join produced is not equal to
						   anything. Two spellings of one mistake, and the case that catches
						   both is the same one.

						   The join is on `right_code`, which V9 GENERATES as `'queue:' ||
						   queue` and keys to `admin_right(code)`: the row itself carries the
						   exact privilege that opens it, and a row cannot exist in a tab that
						   has no right. Nothing here re-derives that. */
						+ " left join verification v"
						+ "   on v.right_code = r.code and v.state = 'waiting'"
						/* AND WHOSE IT IS, WHILE THERE IS A NUMBER TO GIVE. Left, twice over:
						   `competitor_id` is nullable by V9's decision, and since V16 a
						   competitor who has registered and not paid has no number. Neither is
						   filtered out - see the note on this class about the tab that exists
						   for exactly those people. */
						+ " left join competitor c on c.id = v.competitor_id"
						/* THE ONES HE MAY, decided by `WhatHeMayDo` and passed in. Written
						   here as a condition over the ticks it would be a second home for
						   „may he" and would answer the superadmin, who holds everything with
						   no tick anywhere, with nothing at all. */
						+ " where r.code in (:mine)"
						/* BY TAB, OLDEST FIRST (V9), and the key last so the order is total. */
						+ " order by r.target, v.raised_at, v.id")
				.param("mine", his)
				.query((row, one) -> new Line(row.getString(1), row.getObject(2, Long.class),
						row.getTimestamp(3), row.getString(4), row.getString(5), row.getString(6),
						row.getObject(7, Long.class)))
				.list();

		/* GROUPED OUT OF WHAT CAME BACK, and never out of `his`. Seeded from the list of
		   tabs he may, this fold would quietly DROP a row from a tab he may not - so
		   taking the condition out of the query above would change nothing anybody could
		   see, and the filter would be guarded by nothing. Built this way, a tab that
		   should not be in the answer arrives as a tab in the answer. */
		Map<String, List<Waiting>> byQueue = new LinkedHashMap<>();

		for (Line line : lines) {
			List<Waiting> waiting = byQueue.computeIfAbsent(line.queue(), any -> new ArrayList<>());

			/* The null of an outer join: a tab he may work in with nothing waiting in it.
			   The row for the tab is already there, which is the nought. */
			if (line.id() != null) {
				waiting.add(new Waiting(line.id(), line.raised().toInstant()
						.atZone(SeasonClock.ZONE).toLocalDate(), line.memberNumber(),
						line.subject(), line.body(), line.photoId()));
			}
		}

		return byQueue.entrySet().stream()
				.map(tab -> new Queue(tab.getKey(), List.copyOf(tab.getValue())))
				.toList();
	}

	/** One row of the join, before the tabs and their items are told apart. */
	private record Line(String queue, Long id, Timestamp raised, String memberNumber,
			String subject, String body, Long photoId) {
	}
}
