package com.btl.portal.web;

import com.btl.portal.domain.event.EventAddress;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

/**
 * THE ADMINISTRATION CHANGING A TEAM DIRECTLY, WITH NO QUEUE BETWEEN THE PRESS AND THE TEAM.
 *
 * <p>PDL, the entry „Administracija pravi i menja tim direktno, bez reda za moderaciju"
 * (09.10.2026). The owner chose it between offered outcomes, on a recommendation, so the words
 * are the journal's and not his. So is the reason written beside it: the administration already
 * decides the proposals, so what it writes is in force at once, while a member's proposal and a
 * change the team's own administrator asks for still go to the queue ({@link TeamWriteApi}).
 * Until this class the administration's screen of teams ({@code admin/AdminTeams.tsx}) changed a
 * team in the browser's session alone and the server never heard of it, which is what the QA
 * review of 09.10.2026 found.
 *
 * <p><b>THIS IS THE CHANGE AND NOT THE MAKING, AND THE DIFFERENCE IS AN OPEN QUESTION RATHER
 * THAN AN OMISSION.</b> The same decision lets the administration make a team directly, but the
 * address that act goes to is the owner's to choose: {@code POST /api/teams} already carries a
 * member's proposal ({@link TeamWriteApi#propose}), and ADL, the entry „sme da napiše red u
 * tabelu koja nije taj resurs", says that one address carrying two meanings is the day its shape
 * changes rather than gets explained. Nothing here makes a team.
 *
 * <p><b>ONE ADDRESS FOR THE ADMINISTRATION AND NOT THE ONE THE TEAM'S OWN ADMINISTRATOR WILL
 * USE.</b> {@code DELETE /api/teams/{id}} serves both of them because PDL P13b (25.09.2026) makes
 * deleting one act with one consequence for both callers, which {@link TeamWriteApi#remove}
 * quotes. A change is the opposite case: the decision of 09.10.2026 gives the two callers two
 * different consequences, direct for one and queued for the other, so the two are two routes,
 * each with one meaning. The team administrator's road is a later increment.
 *
 * <p><b>WHO MAY: WHOEVER HOLDS {@link TeamApi#OVER_THE_TEAMS}.</b> Derived, and not a sentence
 * of the owner's: it is the right {@link TeamWriteApi#remove} asks of the same administration,
 * the right the screen of teams is opened by ({@code entityForms.ts}, {@code teams}), and the
 * one {@link TeamApi#OVER_THE_TEAMS} itself says is the moderator trusted with the teams that
 * PDL P13 speaks of. A moderator who holds only the queue of teams decides proposals and is not
 * thereby trusted with the teams that exist, which that same note says in as many words. The
 * team's own administrator who holds nothing is refused here too, and that is the decision rather
 * than a gap: his change goes through the queue. Everybody refused is answered 404 at the door
 * ({@link RightsAtTheDoor}, ADL A8), and somebody who is not signed in 401 by the chain.
 *
 * <p><b>WHAT IS CHANGED IS THE FOUR THINGS THE ADMINISTRATION'S FORM ASKS FOR, AND NOTHING
 * ELSE.</b> {@code admin-tim.form.json} asks for a name, a town, its country and the member who
 * sits in the seat, and {@link Changed} carries exactly those four
 * ({@code TeamAdministrationWriteApiTest} reads the form file and holds the two to each other).
 *
 * <ul>
 * <li><b>The name, and the address with it.</b> ADL, of a team's name: it is changed on a form
 * „gde se adresa prepisuje pri svakom čuvanju", so the address is written again on every change
 * and is {@link EventAddress#written}, the one rule the portal answers at. A name that makes no
 * address is refused (PDL, „naziv mora da sadrži bar jedno slovo naše abecede ili ćirilice ili
 * cifru"), and so is a name whose address another team answers at. <b>A name is never refused
 * for clashing with the team it is the name of</b>: a change that leaves the name alone, or only
 * moves its capitals, makes the address the team already has.
 * <li><b>The town, as typed, with its country.</b> The form's {@code city} is text and its
 * {@code country} a code, and it sends no mark out of the world codebook, so a town this writes
 * is always the typed one and a team that stood on a row of the codebook comes out with that
 * pointer emptied - the only shape {@code team_town_is_from_the_codebook_or_typed} lets a typed
 * town have.
 * <li><b>The seat.</b> PDL, the entries „Administratora tima postavlja superadmin ili moderator sa
 * pravom nad timovima" (31.07.2026) and „Moderator ili administrator sme da dodeli drugog kad
 * primeti da je mesto prazno" (04.09.2026). <b>Only to somebody standing in this team, which is
 * derived and not his sentence:</b> who runs a team is {@link TeamApi#WHO_ADMINISTERS_IT}, and
 * that reads the seat through {@link TeamApi#WHO_STANDS_IN_A_TEAM}, so a seat given to somebody
 * outside it would be a control that changes nothing anybody can see. <b>Left out, the seat is
 * not touched</b>: the list beside the form changes a town in its own cell (ADL, „mesto ostaje u
 * ćeliji, jer iza njega ne stoji ništa") without speaking for the seat, and the seat is served to
 * the administration in four shapes, one of which - somebody who holds it with no member number -
 * could not be sent back at all. Absent, empty and a run of spaces are one answer here, the same
 * three shapes every route on this server folds into one.
 * </ul>
 *
 * <p><b>WHAT IS NOT CHANGED, AND THIS PARAGRAPH IS MY REASONING OVER THE SCHEMA, NOT A DECISION
 * OF THE OWNER'S.</b> The team's description, its link, its mark, the season it collects from and
 * who is in it are not written: the form does not ask for any of them, so a change sent from it
 * must not quietly empty what it never offered to change. The mark is the sharp edge of that:
 * {@code team.logo_id} emptied would take its {@code photo} row with it at the end of the
 * transaction (V54).
 *
 * <p><b>NO TRANSFER WINDOW, WHICH IS DERIVED AND NOT ASKED.</b> PDL, the entry „drži sve što menja
 * sastav tima: ulazak u tim, izlazak, osnivanje i brisanje tima" (29.09.2026): a team's name, its
 * town and its seat are not who is in it. The window that does bind the administration (PDL,
 * „Prozor za osnivanje tima vezuje oba pozivaoca") is about founding a team, which is not this
 * route.
 *
 * <p><b>WHAT IS NOT HERE, EACH NAMED RATHER THAN DISCOVERED.</b>
 *
 * <ul>
 * <li><b>A change the team's administrator has sent and that still waits</b> is not touched. It
 * stays in the queue, and approved later it is the moderator's decision about what the team
 * becomes; nothing decided that a direct change withdraws it.
 * <li><b>Telling anybody.</b> Nothing here writes a {@code message}: nothing decided that a
 * change made by the administration is announced, and a sentence invented here would be the
 * server writing the portal's Serbian for a decision nobody took.
 * <li><b>Two changes racing to one address.</b> The address is judged inside the write itself
 * ({@code not exists} in the same statement), which is {@link LeagueWriteApi}'s shape and its own
 * note on what remains: two requests that commit inside each other's window still end with the
 * loser meeting {@code team_slug_unique} as a fault rather than a sentence.
 * <li><b>A team deleted between the first read and the write</b> is answered as a taken address,
 * which is the second way to write nothing and is {@link LeagueWriteApi#change}'s own named case.
 * Both answers refuse and neither writes.
 * </ul>
 */
@RestController
class TeamAdministrationWriteApi {

	/** A name, a town or a country nobody filled in. */
	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	/** A country code {@code /api/countries} does not serve. */
	static final String THE_COUNTRY_IS_NOT_KNOWN = "theCountryIsNotKnown";

	/** A name no page could be opened at, which is PDL P13's one rule about free text. */
	static final String THE_NAME_MAKES_NO_ADDRESS = "theNameMakesNoAddress";

	/**
	 * Another team already answers at the address this name makes.
	 *
	 * <p>Spelt the same as {@link TeamWriteApi}'s and {@link LeagueWriteApi}'s, because it is the
	 * same sentence about a different thing: what was asked for is taken.
	 */
	static final String THE_ADDRESS_IS_TAKEN = "theAddressIsTaken";

	/**
	 * THE MEMBER NAMED FOR THE SEAT DOES NOT STAND IN THIS TEAM.
	 *
	 * <p>One answer for a member of another team, a member of this one whose fee has lapsed, and a
	 * number nobody has: none of them is somebody {@link TeamApi#WHO_STANDS_IN_A_TEAM} counts in
	 * this team, and telling them apart would say nothing the administration can act on beyond
	 * what this already says.
	 */
	static final String HE_IS_NOT_IN_THE_TEAM = "heIsNotInTheTeam";

	private final JdbcClient db;

	/**
	 * Written by hand rather than left on the method, the same choice {@link LeagueWriteApi} made:
	 * whether the team is there, who stands in it and the write are one reading of one moment.
	 */
	private final TransactionTemplate inOneTransaction;

	TeamAdministrationWriteApi(JdbcClient db, TransactionTemplate inOneTransaction) {
		this.db = db;
		this.inOneTransaction = inOneTransaction;
	}

	/**
	 * WHAT ARRIVES, WHICH IS THE ADMINISTRATION'S FORM AND NOTHING BESIDES.
	 *
	 * @param name                  what the team is called, stripped on the way in
	 * @param city                  the town as typed, stripped on the way in
	 * @param country               the code of its country, {@code RS}, never its key - the same
	 *                              spelling {@link TeamApi} answers with
	 * @param organizerMemberNumber the member who is to sit in the seat, or nothing where the seat
	 *                              is to stay as it stands
	 */
	record Changed(String name, String city, String country, String organizerMemberNumber) {
	}

	/** Why a team could not be changed, in the shape every writing route on this server uses. */
	record Refused(String reason) {
	}

	/**
	 * THE TEAM AS IT NOW STANDS, READ BACK OFF ITS ROW.
	 *
	 * @param id   the team, which did not change
	 * @param slug the address it now answers at, which a renamed team does not share with its old
	 *             page
	 * @param name the name as it was written down, which is stripped on the way in and so is not
	 *             always what was sent
	 */
	record Saved(long id, String slug, String name) {
	}

	/**
	 * THE CHANGE ITSELF.
	 *
	 * <p><b>The key is a {@code long} and not an {@code AKey}, and that is the rule for a route the
	 * door decides</b> ({@code RightsAtTheDoorTest}, the floor under {@code AKey}): the door runs
	 * before any variable is bound, so somebody it refuses is told 404 whatever stands in the key,
	 * while somebody it lets through is told 400 for a word there and is entitled to know the route
	 * exists. The same reason {@link LeagueWriteApi#change} takes its key the same way.
	 */
	@PutMapping("/api/teams/{id}")
	@RightIsNeeded(TeamApi.OVER_THE_TEAMS)
	ResponseEntity<?> change(@PathVariable long id, @RequestBody Changed typed) {
		return inOneTransaction.execute(committing -> changing(id, typed));
	}

	/**
	 * THE CHANGE, IN THE ORDER THE ANSWERS ARE OWED.
	 *
	 * <p><b>A team that is not there first</b>, and it is the answer somebody without the right
	 * gets, which is ADL A8 applied to a row rather than to a route - the shape and the reason
	 * {@link LeagueWriteApi#change} has. Then what is wrong with the form, then who sits in the
	 * seat, and the write last, so that nothing is written by a request that is going to be
	 * refused.
	 */
	private ResponseEntity<?> changing(long id, Changed typed) {
		if (!thereIsSuchATeam(id)) {
			return no(HttpStatus.NOT_FOUND, null);
		}

		if (isNothing(typed.name()) || isNothing(typed.city()) || isNothing(typed.country())) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		/* THE ADDRESS THE NAME MAKES, worked out once and used twice: to refuse a name that makes
		   none, and to write it - so the address on the row is always the one the name makes. */
		String address = EventAddress.written(typed.name());

		if (address.isEmpty()) {
			return no(HttpStatus.BAD_REQUEST, THE_NAME_MAKES_NO_ADDRESS);
		}

		/* RESOLVED BEFORE ANYTHING IS WRITTEN, because a code nothing maps would otherwise be an
		   error inside the UPDATE rather than an answer to the person - {@link TeamWriteApi}'s own
		   arrangement for the same column. */
		Optional<Long> country = countryKey(typed.country());

		if (country.isEmpty()) {
			return no(HttpStatus.BAD_REQUEST, THE_COUNTRY_IS_NOT_KNOWN);
		}

		/* THE SEAT, WHERE ONE WAS NAMED, AND NOTHING WHERE IT WAS NOT. Null reaches the statement
		   below as "leave the seat as it stands", which is why the seat is written through a
		   coalesce rather than in a second statement that a request naming nobody would skip. */
		Long seat = null;

		if (!isNothing(typed.organizerMemberNumber())) {
			Optional<Long> standing = standingIn(id, typed.organizerMemberNumber().strip());

			if (standing.isEmpty()) {
				return no(HttpStatus.CONFLICT, HE_IS_NOT_IN_THE_TEAM);
			}

			seat = standing.get();
		}

		/* THE ADDRESS IS JUDGED BY THE WRITE ITSELF, and against every team but this one: a team
		   is never refused the address it already has. `place_id` is emptied because the town that
		   arrives is the typed one (see the note on this class), and nothing else the team carries
		   - its description, its link, its mark, its first season - is named here at all. */
		int written = db.sql("update team set slug = ?, name = ?, place_id = null, city = ?,"
						+ " country_id = ?, admin_id = coalesce(cast(? as bigint), admin_id)"
						+ " where id = ? and not exists(select 1 from team other"
						+ " where other.slug = ? and other.id <> ?)")
				.params(address, typed.name().strip(), typed.city().strip(), country.get(), seat,
						id, address, id)
				.update();

		if (written == 0) {
			return no(HttpStatus.CONFLICT, THE_ADDRESS_IS_TAKEN);
		}

		return ResponseEntity.ok(writtenDown(id));
	}

	private boolean thereIsSuchATeam(long id) {
		return db.sql("select exists(select 1 from team where id = ?)")
				.param(id)
				.query(Boolean.class)
				.single();
	}

	/**
	 * THE MEMBER WITH THIS NUMBER, WHILE HE STANDS IN THIS TEAM, AND NOBODY OTHERWISE.
	 *
	 * <p>Asked of {@link TeamApi#WHO_STANDS_IN_A_TEAM} and never written out here, because that is
	 * the portal's one answer to „who is a standing member of which team" and the seat is read
	 * through it. A copy here would be the third reader of three conditions, and the one that
	 * drifted would let the seat go to somebody the team's own page does not count.
	 */
	private Optional<Long> standingIn(long team, String memberNumber) {
		return db.sql("with standing as (" + TeamApi.WHO_STANDS_IN_A_TEAM + ")"
						+ " select s.id from standing s"
						+ " where s.team_id = ? and s.member_number = ?")
				.params(team, memberNumber)
				.query(Long.class)
				.optional();
	}

	private Optional<Long> countryKey(String code) {
		return db.sql("select id from country where code = ?").param(code.strip())
				.query(Long.class).optional();
	}

	/** The team as its row now holds it, which is the one thing this answer is a claim about. */
	private Saved writtenDown(long id) {
		return db.sql("select id, slug, name from team where id = ?")
				.param(id)
				.query((row, one) -> new Saved(row.getLong(1), row.getString(2), row.getString(3)))
				.single();
	}

	/**
	 * Whether a field was filled in at all: absent, empty and a run of spaces are one answer and
	 * not three, for the reason {@link TeamWriteApi} gives for the same shape.
	 */
	private static boolean isNothing(String value) {
		return value == null || value.isBlank();
	}

	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return reason == null ? ResponseEntity.status(status).build()
				: ResponseEntity.status(status).body(new Refused(reason));
	}
}
