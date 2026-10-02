package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.List;

/**
 * WHAT IS WAITING ON A TEAM: the applications addressed to it and the invitations it sent.
 *
 * <p><b>The read half of {@link TeamJoiningWriteApi}, on the same two paths.</b> That class
 * already holds both directions of getting into a team because they are one act with two
 * doors, and this one holds both readings for the same reason. The repository's own split is
 * a read class and a write class over ONE address ({@link InboxApi} beside
 * {@link InboxWriteApi}, {@link TeamApi} beside {@link TeamWriteApi}), so
 * {@code GET /api/teams/&#123;id&#125;/applications} stands where {@code POST} on that path
 * already stands and {@code GET /api/teams/&#123;id&#125;/invitations} where its {@code POST}
 * does. <b>Two routes rather than one answer with two lists</b>, and the reason is not taste:
 * a single new path would be a resource with no other verb on it, while these two are the
 * lists the three write verbs on each path already act upon, so the read and the write of one
 * row are one address apart and cannot drift into naming different sets.
 *
 * <p><b>WHY THE PORTAL NEEDS THIS AT ALL.</b> PDL, the owner's decision of 06.09.2026: „Ishod
 * poziva se vraća timu kao poruka onome ko vodi tim u trenutku odgovora... <b>Uz to strana
 * tima pokazuje i pozive koje je poslala, da tim ne zavisi od poruke.</b> Poruka je vest a ne
 * ovlašćenje, pa zastareo primalac gubi obaveštenje, ne odluku." A message is news; the list
 * is the record. Until this class existed the only row either table served was the one the
 * CALLER was waiting on ({@link MyApplicationsApi}, {@code where competitor_id = ?}), so a
 * team could be asked and had nowhere to read the question.
 *
 * <p><b>WHO MAY READ IT, AND IT IS THE SAME OBJECT THAT DECIDES THE WRITE.</b> Whoever leads
 * the team, and the administration. „Ko vodi ovaj tim" is
 * {@link TeamApi#WHO_ADMINISTERS_IT} over {@link TeamApi#WHO_STANDS_IN_A_TEAM} and nothing
 * written here - the identical pair {@link TeamJoiningWriteApi} asks before it lets anybody
 * decide an application or send an invitation - so the list a team is shown and the acts it
 * is allowed cannot come apart. PDL 05.09.2026: „Prijavu u tim odobrava administrator tog
 * tima", and 27.09.2026, overturning the owner's own earlier decision: „Poziv u tim salje
 * <b>samo administrator tog tima</b>." The administration is a second reader and a second
 * question, asked of the ACCOUNT through {@link WhatHeMayDo} and never of a member, because
 * a moderator who does not race has no member at all (V23) - the shape {@link TeamApi} uses
 * one file away.
 *
 * <p><b>AND EVERYBODY ELSE IS ANSWERED 404, WHICH IS ADL A8 AND NOT A ROUNDING OF 403.</b>
 * The owner, 13.09.2026: an address a member may not open „nije strana sa objašnjenjem nego
 * adresa koje za njega nema". A member standing in the team who does not lead it is answered
 * exactly what a member of another team is, and exactly what a caller naming a team that does
 * not exist is - so no answer here is an oracle for which teams exist, who is in them, or who
 * sits in the seat. A visitor never arrives: neither path is on
 * {@link ApiSecurity#READ_BY_ANYBODY}, so the chain answers 401 first.
 *
 * <p><b>THIS SERVES OTHER PEOPLE'S MEMBER NUMBERS, AND {@code profile_hidden} IS
 * DELIBERATELY NOT ASKED ABOUT.</b> That column hides a member from a VISITOR, and every
 * caller here is signed in by construction - the reason {@link TeamJoiningWriteApi}'s own
 * {@code memberShown} gives in as many words, and the condition {@link CompetitorApi} serves
 * its list by ({@code cast(:signedIn as boolean) or not c.profile_hidden}). A condition on it
 * here would hide an applicant from the one team that has to answer him, which is not what
 * hiding a profile means.
 *
 * <p><b>THE FEE IS ASKED ABOUT, AND THE TWO LISTS ANSWER IT DIFFERENTLY BECAUSE THEIR WRITE
 * ROUTES DO.</b> This is the one place the two halves are not symmetric, so it is written out
 * rather than left to be found:
 *
 * <ul>
 * <li><b>An application from a member whose fee has lapsed is not listed at all</b>, because
 * {@link TeamJoiningWriteApi}'s {@code applicationHeMayDecide} carries {@code c.active} and
 * the team therefore cannot answer it either way. Listed, the screen would offer „Primi u
 * tim" over a row the server refuses.
 * <li><b>An invitation to a member whose fee has lapsed IS listed, with no number on it.</b>
 * Its write route is the opposite: {@code thisTeamHasAskedHim} asks
 * {@code team_id and competitor_id} and nothing else, so the row goes on refusing a second
 * invitation to that man in every season. Dropped from this list, the team would be shown an
 * empty place, ask again, and be refused - the same broken button from the other side. What
 * is withheld is his NAME and not the row: „Nijedan javni odgovor ne sme da imenuje člana
 * kome je članarina istekla, NI POSREDNO" (PDL, 13.09.2026), carried out the way
 * {@link MyApplicationsApi}'s {@code pairInvites} carries it - {@code case when c.active then
 * c.member_number end} - because {@code /api/competitors} stops carrying him the day the fee
 * lapses and a number that is here and missing there is itself the answer.
 * </ul>
 *
 * <p><b>AN APPLICATION FROM SOMEBODY WHO HAS SINCE GOT A TEAM IS NOT LISTED, AND THIS IS THE
 * DOOR THAT DECISION WAS WRITTEN FOR.</b> PDL, 06.09.2026: „<b>Prijava člana koji je u
 * međuvremenu dobio tim se timu ne prikazuje.</b> Prikazana, „Primi u tim" bi ga izvukla iz
 * tog tima bez ijednog pitanja, a P13 to zabranjuje svuda drugde. Isto važi i za člana koga
 * je administracija obrisala." {@link MyApplicationsApi} names this class before it exists -
 * „a safeguard on the door the team's own future resource opens" - and goes on reporting the
 * row to the APPLICANT, because „<b>[IZVEDENO] Prijava u oba slučaja ostaje njegova da je
 * povuče</b>, pa i dalje ima kraj koji ne zavisi ni od koga drugog". Both halves are true at
 * once: hidden here, standing there.
 *
 * <p><b>IT IS ASKED IN JAVA AND NOT AS A {@code where} CLAUSE, ON PURPOSE.</b>
 * {@link ATeamHeIsAlreadyIn#standsInHisWay} is the one home of „a membership that ends at or
 * after the season he would join", and {@link TeamJoiningWriteApi#decide} asks that same
 * object one statement before it accepts. Spelt as SQL here it would be a second home, and
 * the two would answer differently the day either moved - which is exactly the state this
 * list exists to keep out. <b>It also carries no transfer window</b>, for the reason
 * {@link ATeamHeIsAlreadyIn} gives: the hiding holds on every day of the year, and a
 * condition with the window in it would make the stale row visible again for nine months.
 *
 * <p><b>THE DAY IS THE DAY IN BELGRADE</b>, read off each row's own timestamp the way
 * {@link MyApplicationsApi} reads {@code asked_at} and {@code sent_at}, never the machine's
 * zone and never {@code current_date}.
 *
 * <p><b>EVERY LIST IS OLDEST FIRST WITH THE KEY LAST, so the order is total</b> - the shape
 * {@link MyApplicationsApi}, {@link VerificationApi} and {@link AttendanceApi} already settle
 * their lists by, so two rows written in one instant come back in one order.
 *
 * <p><b>WHAT IS NOT ANSWERED, named rather than left to be guessed:</b> no name, no town, no
 * portrait. A member is answered by {@code member_number} and by nothing else, which is what
 * {@link MyApplicationsApi} does with the other side of a pair invitation and why - „the
 * caller resolves the rest against the already-public {@code /api/competitors} rather than
 * this class repeating it a second place". The team is not answered either: it is the path.
 */
@RestController
class TeamJoiningApi {

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	private final WhatHeMayDo mayHe;

	/**
	 * THE ONE PLACE THAT ANSWERS „HAS HE A TEAM ALREADY", asked here for the same rows
	 * {@link TeamJoiningWriteApi#decide} asks it for, so that a row this list hides is a row
	 * that route refuses and never the other way round.
	 */
	private final ATeamHeIsAlreadyIn alreadyInATeam;

	/**
	 * Which season an acceptance would be for is a question about a moment, and the moment
	 * comes from the bean rather than from {@code Instant.now()} for the reason
	 * {@code WhatTimeItIs} gives: both sides of 1 January are then one fixture and two
	 * assertions.
	 */
	private final Clock clock;

	TeamJoiningApi(JdbcClient db, MemberOfAccount memberOfAccount, WhatHeMayDo mayHe,
			ATeamHeIsAlreadyIn alreadyInATeam, Clock clock) {

		this.db = db;
		this.memberOfAccount = memberOfAccount;
		this.mayHe = mayHe;
		this.alreadyInATeam = alreadyInATeam;
		this.clock = clock;
	}

	/**
	 * Somebody asking this team to take him, waiting for the team to answer.
	 *
	 * @param memberNumber who is asking, never his {@code competitor.id}
	 */
	record Application(long id, String memberNumber, LocalDate date) {
	}

	/**
	 * Somebody this team has asked in, waiting for him to answer.
	 *
	 * @param memberNumber whom it asked, or NULL where his fee has since lapsed - see the
	 *                     class note for why the row stays and the name goes
	 */
	record Invitation(long id, String memberNumber, LocalDate date) {
	}

	/**
	 * @param asking never null here: neither path is open for reading, so the chain answers
	 *               401 before this method runs
	 */
	@GetMapping("/api/teams/{id}/applications")
	ResponseEntity<?> applications(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@PathVariable AKey id) {

		if (!heMayReadThisTeamsQueue(asking, id.value())) {
			return away();
		}

		ZonedDateTime now = ZonedDateTime.now(clock);

		return ResponseEntity.ok(waitingOn(id.value()).stream()
				/* THE DECISION OF 06.09.2026, asked of the record through the one object that
				   owns the rule rather than folded into the statement above. */
				.filter(one -> !alreadyInATeam.standsInHisWay(one.applicant(), now))
				.map(Awaited::asAnApplication)
				.toList());
	}

	/**
	 * @param asking never null here, for the reason given on {@link #applications}
	 */
	@GetMapping("/api/teams/{id}/invitations")
	ResponseEntity<?> invitations(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@PathVariable AKey id) {

		if (!heMayReadThisTeamsQueue(asking, id.value())) {
			return away();
		}

		return ResponseEntity.ok(sentBy(id.value()));
	}

	/**
	 * WHOEVER LEADS THIS TEAM, OR THE ADMINISTRATION, AND THE TEAM HAS TO EXIST.
	 *
	 * <p>The two questions are genuinely two and are asked of two different things. Whether
	 * he leads it is asked of his MEMBER, because a seat is held by a member; whether he is
	 * the administration is asked of his ACCOUNT, because the superadmin races for nobody
	 * (V23, owner 14.09.2026) and reading that off a member would refuse the ordinary case.
	 *
	 * <p><b>The administration still has to name a team that exists</b>, which is what
	 * {@link #thisTeamExists} is for. Without it a moderator would be answered an empty list
	 * for every number he tried, and „empty" and „no such team" would be one answer - the
	 * difference {@link TeamJoiningWriteApi} keeps by joining {@code team} from the path.
	 */
	private boolean heMayReadThisTeamsQueue(WhoIsAsking.Member asking, long team) {
		if (!thisTeamExists(team)) {
			return false;
		}

		if (mayHe.may(asking, TeamApi.OVER_THE_TEAMS)) {
			return true;
		}

		Long me = memberOfAccount.competitorId(asking.account());

		return me != null && heAdministersThisTeam(me, team);
	}

	private boolean thisTeamExists(long team) {
		return db.sql("select exists(select 1 from team where id = ?)").param(team)
				.query(Boolean.class)
				.single();
	}

	/**
	 * WHO LEADS IT, READ THROUGH THE ROSTER AND NOT OFF {@code team.admin_id} ALONE.
	 *
	 * <p>Spelt exactly as {@link TeamJoiningWriteApi}'s own {@code heAdministersThisTeam},
	 * out of the same two constants, so the three readers of that rule move together or one
	 * of them fails. A seat naming somebody who has left or whose fee has lapsed simply
	 * misses it and the title passes on, which is PDL P13's „Isto kao kad je otisao".
	 */
	private boolean heAdministersThisTeam(long me, long team) {
		return db.sql("with standing as (" + TeamApi.WHO_STANDS_IN_A_TEAM + ")"
						+ " select coalesce(" + TeamApi.WHO_ADMINISTERS_IT + " = ?, false)"
						+ " from team t where t.id = ?")
				.params(me, team)
				.query(Boolean.class)
				.optional()
				.orElse(false);
	}

	/**
	 * A row read before the rule of 06.09.2026 is asked of it, which is why the applicant's
	 * key is on it at all: {@link ATeamHeIsAlreadyIn} reads memberships by
	 * {@code competitor_id}, and nothing here lets that key leave.
	 */
	private record Awaited(long id, long applicant, String memberNumber, LocalDate date) {

		private Application asAnApplication() {
			return new Application(id, memberNumber, date);
		}
	}

	/**
	 * EVERY APPLICATION ADDRESSED TO THIS TEAM AND TO NO OTHER, from somebody who is still a
	 * member.
	 *
	 * <p>{@code c.active} is the condition {@code applicationHeMayDecide} carries, repeated
	 * here so that this list and that refusal name one set. The team is bound from the path
	 * and the row must agree with it, which is what makes the answer a claim about the table
	 * rather than an echo of the address.
	 */
	private List<Awaited> waitingOn(long team) {
		return db.sql("select a.id, a.competitor_id, c.member_number, a.asked_at"
						+ " from team_application a"
						+ " join competitor c on c.id = a.competitor_id"
						+ " where a.team_id = ? and c.active"
						+ " order by a.asked_at, a.id")
				.param(team)
				.query((row, n) -> new Awaited(row.getLong(1), row.getLong(2), row.getString(3),
						belgradeDayOf(row.getTimestamp(4))))
				.list();
	}

	/**
	 * EVERY INVITATION THIS TEAM HAS SENT AND THAT NOBODY HAS ANSWERED, WITH NO CONDITION ON
	 * WHOM IT NAMES.
	 *
	 * <p>PDL, „[IZVEDENO] Isti tim ne poziva istog čoveka dvaput": „Prijava se šalje jednom i
	 * dok čeka na njenom mestu stoji način da se povuče; poziv je isti zapis, pa <b>dok
	 * stoji, na njegovom mestu stoji da je poslat</b>. Bez toga jedan tim može da napuni tuđe
	 * sanduče istim pitanjem." The set this answers is therefore exactly the set
	 * {@code thisTeamHasAskedHim} refuses a second invitation over, which asks
	 * {@code team_id} and {@code competitor_id} and nothing else - no season, no fee, no
	 * squad. <b>Any condition added here would be a place the screen offers to invite
	 * somebody the server will refuse.</b>
	 *
	 * <p>There is no state column to filter on and there is not meant to be one (V12): an
	 * accepted, refused or withdrawn invitation is a row that has been DELETED, so a row that
	 * is here is a question that stands.
	 *
	 * <p>The {@code case} is the lapsed fee, and the class note has the whole of why the row
	 * stays while the name goes.
	 */
	private List<Invitation> sentBy(long team) {
		return db.sql("select i.id,"
						+ " case when c.active then c.member_number end,"
						+ " i.sent_at"
						+ " from team_invitation i"
						+ " join competitor c on c.id = i.competitor_id"
						+ " where i.team_id = ?"
						+ " order by i.sent_at, i.id")
				.param(team)
				.query((row, n) -> new Invitation(row.getLong(1), row.getString(2),
						belgradeDayOf(row.getTimestamp(3))))
				.list();
	}

	/**
	 * The calendar day a technical instant falls on in the league's own zone, the shape
	 * {@link MyApplicationsApi} reads both of these columns by, for the identical reason: a
	 * server kept in UTC is still living in yesterday for the first hours of a Belgrade day.
	 */
	private static LocalDate belgradeDayOf(Timestamp at) {
		return at.toInstant().atZone(SeasonClock.ZONE).toLocalDate();
	}

	/**
	 * THE ANSWER FOR SOMEBODY THIS ADDRESS IS NOT FOR, which carries nothing at all.
	 *
	 * <p>The owner's reason of 05.09.2026, quoted by {@link TeamJoiningWriteApi} for the
	 * write half of the same address: „adresa koju član ne sme da otvori nije strana sa
	 * objašnjenjem nego adresa koje za njega nema."
	 *
	 * <p><b>IT GOES DOWN THE ROAD AN ADDRESS THAT MAPS NOTHING GOES DOWN, AND IT IS THROWN
	 * RATHER THAN RETURNED.</b> A status written onto the response comes back with
	 * {@code Content-Length: 0}, while an address that maps nothing comes back as the container's
	 * error document, chunked: over a real socket that is 262 bytes against more than 380, and it
	 * is an oracle for whether a route lives at this address, one request per guess
	 * ({@link RightsAtTheDoor} measured it). {@link ResponseStatusException} is answered by
	 * {@code sendError}, one call into the machinery an unmapped address already uses and not an
	 * imitation of it, and it is thrown because this is asked from inside transaction callbacks,
	 * where there is no response to hand. Every refusal here is decided before the first write, so
	 * the rollback the exception causes undoes nothing. {@code AWordInAKeyOverRealHttpTest}
	 * compares the bytes with the twin's, for every kind of caller.
	 */
	private static ResponseEntity<?> away() {
		throw new ResponseStatusException(HttpStatus.NOT_FOUND);
	}
}
