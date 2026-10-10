package com.btl.portal.web;

import com.btl.portal.domain.event.WhatARaceCarries;
import com.btl.portal.domain.event.WhatARaceCarries.Figures;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;

/**
 * THE RUNS THE ASKER HAS SENT IN AND NOBODY HAS COUNTED: the ones still waiting for a
 * moderator, and the ones a moderator sent back with a reason. His own and nobody else's.
 *
 * <p><b>Why it exists.</b> PDL P9, in the record's wording: „Rezultat ulazi u rang liste tek
 * posle odobrenja. Javno se ne prikazuje pre verifikacije: član svoj rezultat na čekanju vidi u
 * „Moji rezultati" sa oznakom „Čeka proveru", a moderator u redu za proveru." The moderator's
 * half has been on the server since {@link VerificationApi} began to read the results tab; the
 * member's half had no route at all. {@code result_submission} was read by the moderator's
 * queue and by nothing else, so the screen drew a member's waiting runs out of the browser's own
 * session, and a run he had really sent was gone from his list the moment he reloaded the page.
 *
 * <p><b>A REFUSED RUN IS HERE TOO, WITH ITS REASON, BECAUSE THE ROW STAYS.</b> ADL A36, O11, the
 * owner's choice of 06.09.2026 among outcomes offered, in the record's wording: „odbijena prijava
 * rezultata: red ostaje sa stanjem i razlogom, slika se briše odmah." The reason reaches his inbox
 * the moment a moderator gives it; this is where he can read it again, beside the run it was
 * about.
 *
 * <p><b>AN APPROVED RUN IS NOT HERE.</b> It is a result, and {@link ResultApi} is where a result
 * is read; serving it here as well would put one counted run on the screen twice. That is also
 * why nothing below depends on what an approval writes back into the submission it decided.
 *
 * <p><b>A class and an address of its own, not a fifth list on {@link MyApplicationsApi}.</b>
 * This repository keeps one class per resource, and that class's own note gives the reason for
 * not widening an answer every caller pays for: the screens that read
 * {@code /api/me/applications} have no use for anybody's runs.
 *
 * <p><b>NOTHING HERE IS PUBLIC</b>, the same closedness {@link MyApplicationsApi} has and for
 * the same reason: ADL P-javno, the owner, 13.09.2026, „javno je ono sto Clan 73 nabraja, i
 * nista vise. Sve ostalo ceka resurs koji zna ko pita." The route is absent from
 * {@link ApiSecurity#READ_BY_ANYBODY}, so a visitor is answered 401 by the chain before this
 * class runs, and it carries no {@link RightIsNeeded}, because reading one's own runs is what
 * every member does and not a box anybody ticks. That is why it stands in
 * {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT}.
 *
 * <p><b>WHOSE IT IS STANDS IN THE {@code where}, AND NOTHING IN THE REQUEST NAMES A MEMBER.</b>
 * The asker is read off the session through {@link MemberOfAccount}, the one lookup every route
 * of a member's own uses, so „mine" is the only thing this address can express.
 *
 * <p><b>AN ACCOUNT THAT NAMES NO MEMBER GETS AN EMPTY LIST, NOT A REFUSAL</b>, which is
 * {@link MyApplicationsApi}'s answer to the identical account and its reason: V23 lets a
 * moderator who does not race have no {@code competitor} row, nothing can have been sent in his
 * name, and an empty list says exactly that.
 *
 * <p><b>THE RACE AS IT IS CALLED NOW, AND THE FOUR FIGURES AS AN APPROVAL WOULD COUNT THEM
 * NOW</b>, which is how {@link VerificationApi} shows the moderator the same run, so the two
 * sides of one run cannot come to show two different runs. The name is the race's and never the
 * event's (PDL P9, the owner's decision of 23.08.2026, in the record's wording: „Naziv trke se
 * prikazuje umesto naziva događaja na tri mesta: javni profil takmičara, „Moji rezultati" i red
 * za proveru rezultata kod moderatora"), read off {@code race} and not off the copy
 * {@link ResultWriteApi} wrote into {@code verification.subject} on the day the run was sent: a
 * race renamed since is the race the run will be counted on. Which figure a race fixes is
 * {@link WhatARaceCarries#figuresOf}'s answer, asked of the race as it stands today, the one home
 * of that question; a race the calendar does not hold has nothing to ask, and what was sent is
 * all there is.
 *
 * <p><b>THE DAY IS THE DAY IT WAS RUN</b>, {@code race_date}, and never the day it was sent. The
 * day it was sent is what the moderator is shown (PDL P9, the owner, 18.09.2026: „Odnosno
 * verifikator vidi kad je rezultat poslat"), and nothing on the member's side reads it.
 *
 * <p><b>THE KIND AND THE TOWN TRAVEL WITH EVERY RUN, BECAUSE THE FORM THAT SENDS A REFUSED RUN
 * AGAIN ASKS FOR BOTH.</b> {@code unos-rezultata.form.json} makes the kind and the town required
 * on every road, and a refused run sent again is the form filled back in from this answer: left
 * empty there, the member is refused for not answering two questions the form never put to him
 * again, a fault already measured once on that very road (30.08.2026, {@code NewResult.tsx},
 * {@code filledFrom}). A run on a race the calendar holds answers with the race's own kind and
 * its event's town, by the same {@code coalesce} {@link CalendarApi} serves an event's town with;
 * a described run answers with its own, out of the codebook or typed, by the same
 * {@code coalesce} the queue makes for a proposal. The country is the CODE, as everywhere else.
 *
 * <p><b>WHAT IS LEFT OUT, each for its reason rather than by omission.</b>
 * <ul>
 * <li><b>The points.</b> V10 keeps none on a submission and works them out at the approval,
 * and the moderator's queue works them out on the screen from the figures it is handed; this
 * answer hands the same figures.</li>
 * <li><b>Who decided, and when.</b> PDL, the owner's choice of 19.09.2026 among three outcomes:
 * when the portal writes to a member, the sender is the league and not the moderator, and the
 * reason the record gives is that a moderator's name „odalo bi ko je odbio uplatu ili koga
 * izbacio". The same reason keeps {@code decided_by_name} out of a list that exists to show a
 * refusal. That is my reading of that decision for this list, not a decision about it.</li>
 * <li><b>The day it was sent and the day it was decided</b>, which no screen of the member's
 * reads.</li>
 * <li><b>The picture.</b> Nothing can upload one yet, and a picture only a queue row holds is not
 * public (ADL A60).</li>
 * <li><b>Keys the portal never publishes</b>: the queue row's own id, the codebook row a town is
 * kept under. {@code id} is the SUBMISSION's, which is what a route about one of these runs will
 * take.</li>
 * </ul>
 *
 * <p><b>The member's comment is read off the submission.</b> The queue row's {@code body} holds
 * the same words, because {@link ResultWriteApi} writes both from one value; reading either
 * answers alike, and the submission is the run this list is about.
 *
 * <p><b>NEWEST FIRST, WITH THE KEY LAST SO THE ORDER IS TOTAL.</b> That is my choice and it is
 * the opposite of {@link MyApplicationsApi}'s oldest first, for a reason: a queue is worked from
 * the oldest end, while a member reading his own runs reads the latest first, which is the order
 * the screen has always drawn this list in (the session's store keeps every list newest first,
 * {@code session/SessionProvider.tsx}). The key breaks a tie between two runs sent in one
 * instant, so two readings of data nobody touched never reshuffle.
 */
@RestController
class MyResultSubmissionsApi {

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	MyResultSubmissionsApi(JdbcClient db, MemberOfAccount memberOfAccount) {
		this.db = db;
		this.memberOfAccount = memberOfAccount;
	}

	/**
	 * One run the asker sent in that has not been counted.
	 *
	 * @param id             {@code result_submission.id}
	 * @param state          {@code waiting} or {@code rejected}, V9's own two words
	 * @param raceId         the race in the calendar, or nothing for a race the calendar does
	 *                       not hold
	 * @param raceName       the race's name as it is now, or the name the member typed for a
	 *                       race the calendar does not hold
	 * @param raceDate       the day it was run
	 * @param raceKind       the calendar's kind of the race, or the member's for a described one
	 * @param city           the town: the event's for a race in the calendar, the member's for a
	 *                       described one
	 * @param country        that town's country, as its code
	 * @param distanceKm     the four figures as an approval would count them now
	 * @param link           the official results he pointed at, or empty
	 * @param comment        what he wrote beside it, or empty
	 * @param reason         why a moderator sent it back, and nothing while it waits
	 * @param amendsResultId the counted result this run corrects, or nothing for a fresh run
	 */
	record Sent(long id, String state, Long raceId, String raceName, LocalDate raceDate,
			String raceKind, String city, String country, BigDecimal distanceKm, Integer ascentM,
			Integer descentM, Integer seconds, String link, String comment, String reason,
			Long amendsResultId) {
	}

	/**
	 * @param member never null here: the chain answers 401 before this method runs, the same
	 *               guarantee {@link MyApplicationsApi} rests on
	 */
	@GetMapping("/api/me/result-submissions")
	List<Sent> resultSubmissions(@AuthenticationPrincipal WhoIsAsking.Member member) {
		Long me = memberOfAccount.competitorId(member.account());

		if (me == null) {
			return List.of();
		}

		return db.sql("select rs.id, v.state, rs.race_id,"
						/* THE RACE AS IT IS CALLED NOW, or the name he typed where the calendar does
						   not hold it. V10 keeps the two exclusive, so this never chooses between
						   two names that are both there. */
						+ " coalesce(ra.name, rs.race_name) as race_name,"
						+ " rs.race_date,"
						+ " coalesce(ra.kind, rs.race_kind) as race_kind,"
						/* THE TOWN, decided by whether the run is described and never by which row
						   happens to join: the event's town for a race in the calendar, the run's
						   own for a described one. */
						+ " case when rs.race_id is null then coalesce(town.name, rs.city, '')"
						+ "      else coalesce(event_town.name, ev.city, '') end as city,"
						+ " case when rs.race_id is null"
						+ "      then coalesce(town_country.code, typed_country.code, '')"
						+ "      else coalesce(event_town_country.code, event_typed_country.code, '')"
						+ " end as country,"
						/* The race's own figures beside the run's, and which of the two each served
						   figure is taken from is decided in Java by `figuresOf`, never by a `case`
						   here, which would be a second answer to „whose figure is this". */
						+ " ra.kind as the_races_kind, ra.distance_km as the_races_distance,"
						+ " ra.ascent_m as the_races_ascent, ra.descent_m as the_races_descent,"
						+ " ra.limit_seconds as the_races_limit,"
						+ " rs.distance_km, rs.ascent_m, rs.descent_m, rs.seconds,"
						+ " rs.link, rs.comment, v.reason, rs.amends_result_id"
						+ " from result_submission rs"
						/* BY THE POINTER, never by whose run it is: two runs of one member are two
						   items, and a join on the member would hand each the other's state. INNER,
						   because a run with no queue row is not a state the route that writes them
						   produces (V10, one verification per submission). */
						+ " join verification v on v.result_submission_id = rs.id"
						+ " left join race ra on ra.id = rs.race_id"
						+ " left join btl_event ev on ev.id = ra.event_id"
						+ " left join place event_town on event_town.id = ev.place_id"
						+ " left join country event_town_country on event_town_country.id = event_town.country_id"
						+ " left join country event_typed_country on event_typed_country.id = ev.country_id"
						+ " left join place town on town.id = rs.place_id"
						+ " left join country town_country on town_country.id = town.country_id"
						+ " left join country typed_country on typed_country.id = rs.country_id"
						+ " where rs.competitor_id = ?"
						/* Waiting and refused. An approved run is a result (see the class note). */
						+ " and v.state in ('waiting', 'rejected')"
						+ " order by v.raised_at desc, rs.id desc")
				.param(me)
				.query((row, one) -> {
					Figures counted = countedAt(row);

					return new Sent(row.getLong("id"), row.getString("state"),
							row.getObject("race_id", Long.class), row.getString("race_name"),
							row.getObject("race_date", LocalDate.class), row.getString("race_kind"),
							row.getString("city"), row.getString("country"), counted.distanceKm(),
							counted.ascentM(), counted.descentM(), counted.seconds(),
							row.getString("link"), row.getString("comment"), row.getString("reason"),
							row.getObject("amends_result_id", Long.class));
				})
				.list();
	}

	/**
	 * THE FOUR FIGURES OF ONE RUN AS AN APPROVAL WOULD COUNT THEM TODAY.
	 *
	 * <p>A run on a race the calendar holds asks {@link WhatARaceCarries#figuresOf} about the race
	 * as it stands now, which is what the approval asks; a described run has no race to ask, and
	 * what was sent is all there is. The same reading {@link VerificationApi} makes of the same
	 * run for the moderator, written again here over this query's own columns rather than shared
	 * across two queries through their column names.
	 */
	private static Figures countedAt(ResultSet row) throws SQLException {
		Figures sent = new Figures(row.getBigDecimal("distance_km"),
				row.getObject("ascent_m", Integer.class), row.getObject("descent_m", Integer.class),
				row.getObject("seconds", Integer.class));
		String theRacesKind = row.getString("the_races_kind");

		return theRacesKind == null ? sent
				: WhatARaceCarries.figuresOf(new WhatARaceCarries.ARace(theRacesKind,
						row.getBigDecimal("the_races_distance"), row.getInt("the_races_ascent"),
						row.getInt("the_races_descent"), row.getInt("the_races_limit")), sent);
	}
}
