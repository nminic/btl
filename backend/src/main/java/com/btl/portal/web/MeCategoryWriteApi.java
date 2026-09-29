package com.btl.portal.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.List;

/**
 * A MEMBER SAYS WHICH CATEGORY HE WANTS TO RUN THE COMING SEASON IN.
 *
 * <p>The writing half of {@link MeCategoryApi}, which carries what the resource is and what
 * this increment deliberately leaves out. The pair of classes on one path is
 * {@link MyMembershipApi} and {@link MyMembershipWriteApi}, and everything below that is not
 * about categories is theirs: the member off the session, the body read only after „has he a
 * member" is answered, the 404 through {@code sendError}, and the answer read back off the
 * database rather than echoed from the request.
 *
 * <p><b>THE MEMBER MAY CHANGE IT AS OFTEN AS HE LIKES UNTIL THE DEADLINE.</b> Owner,
 * 26.09.2026 (PDL P7 §9): „Clan moze da stiklira dakle od ove dve opcije sta god hoce sve do
 * zamrzavanja sezone 1.1. u 10 ujutru", and the journal draws out: „Do tog roka se izbor menja
 * koliko god puta." So there is no „already chosen" state to refuse and no once-only rule here;
 * the only refusal about time is the deadline itself.
 *
 * <p><b>AND A WISH HE HAS NO RIGHT TO IS ACCEPTED, WHICH IS A DECISION AND NOT AN OVERSIGHT.</b>
 * A member over twelve points may send {@code firstSeason: true} and is answered 200, with a
 * {@code category} that is his age band. The reason is the owner's own shape (26.09.2026): what
 * is kept is the WISH, the category is derived from the wish AND the right, and the journal
 * concludes „stanje 'sacuvan izbor na koji clan nema pravo' ne moze ni da nastane" - there is
 * nothing to refuse because nothing wrong can be stored. Refusing instead would put a guard on
 * a state no reachable screen produces, since the box offers the beginners' option only to
 * somebody it is open to, and a guard over an unreachable state is the dead branch this
 * codebase has been bitten by three times in a week. The cost, said plainly: this route accepts
 * a wish no screen of the portal can send it.
 *
 * <p><b>WHERE IT IS STORED, AND THE DEBT THAT COMES WITH IT.</b>
 * {@code competitor.first_season_2027} - one boolean per member, with a season in its own name.
 * {@link TheChoiceAsItStands} carries the measurement, the owner's decision of 27.09.2026 to
 * keep it and record the debt, and the month it becomes live. Nothing here writes a season,
 * because there is no column to write one into.
 *
 * <p><b>What an omitted field means here, which ADL A54 requires every write route to say:</b>
 * it is REFUSED. The form has one field, so „leave it alone" would make the whole request a
 * request to do nothing, answered 200 - and A54's own sentence (owner, 19.09.2026) is that an
 * omitted field must never quietly change a value; a route whose only field may be left out
 * cannot honour that by doing nothing, because doing nothing IS what a caller who meant
 * {@code false} would get. {@link RaceWriteApi} and {@link MeWriteApi} pick refusal
 * for the same reason.
 */
@RestController
class MeCategoryWriteApi {

	/**
	 * The one field, not sent.
	 *
	 * <p>Spelt the word {@link RaceWriteApi} and {@link MeWriteApi} spell it, because
	 * it is one sentence about a different form.
	 */
	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	/**
	 * THE DEADLINE HAS PASSED, WHICH IS A 409 AND NOT A 404.
	 *
	 * <p>The shape and the status are {@link TeamWriteApi#THE_WINDOW_IS_SHUT}'s, because it is
	 * the same kind of sentence about a different window: the address exists, the member is
	 * allowed to be at it, and the portal is refusing on the state of the world rather than on
	 * who is asking. ADL A8's 401 and 404 are about WHO, and neither is true of a member whose
	 * own deadline has passed - answering 404 would tell him the choice never existed, on a
	 * screen that showed it to him in December.
	 */
	static final String THE_CHOICE_IS_SHUT = "theChoiceIsShut";

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	private final TheChoiceAsItStands theChoice;

	/** The one the rest of this application reads bodies with, asked for rather than made. */
	private final ObjectMapper json;

	MeCategoryWriteApi(JdbcClient db, MemberOfAccount memberOfAccount,
			TheChoiceAsItStands theChoice, ObjectMapper json) {

		this.db = db;
		this.memberOfAccount = memberOfAccount;
		this.theChoice = theChoice;
		this.json = json;
	}

	/**
	 * WHAT ARRIVES: the one wish, BOXED.
	 *
	 * <p>A primitive {@code boolean} reads a field nobody sent as {@code false}, which here is
	 * a complete and plausible answer - „I want my age category" - written down for a member
	 * who said nothing, and answered 200 to say it worked. That is exactly the fault ADL A54
	 * was written about, arriving on a field whose wrong default is also its ordinary value, so
	 * nothing downstream would ever look odd. {@link PairWriteApi.Answered} boxes its one field
	 * for the same reason in the same words.
	 *
	 * @param firstSeason true for the beginners' category, false for his age band. A boolean
	 *                    and not a code, because the two options ARE two
	 *                    ({@code Pocetnicka} and {@code Starosna}, PDL P7) and because a code
	 *                    would be the OUTCOME: the band depends on a year of birth and a
	 *                    season, both of which the server has and the member may not send.
	 *                    {@code Category.codeFor}'s last parameter is already this boolean
	 */
	record Wish(Boolean firstSeason) {
	}

	/**
	 * THE REFUSAL, SAYING WHICH FIELD WAS LEFT OUT.
	 *
	 * <p>ADL A54 asks for both halves and not just the first. The shape is
	 * {@link RaceWriteApi.NotComplete}'s, field for field and in that order: {@code reason}
	 * first, carrying the same word a bare refusal would, so a caller that reads a refusal by
	 * its reason reads this one unchanged, and the list is what is added rather than what is
	 * swapped.
	 */
	record NotComplete(String reason, List<String> missing) {
	}

	/** A refusal that is about the world rather than about the form. */
	record Refused(String reason) {
	}

	/**
	 * <p><b>The body is read as BYTES and only after „has he a member" is answered</b>, and
	 * that order is the whole reason this signature is not {@code @RequestBody Wish}.
	 * {@link MeWriteApi} carries the measurement: written the ordinary way, a
	 * signed-in account with no member behind it sends a body Jackson refuses and is answered
	 * 400, while the identical request to an address that maps nothing answers 404 - and one
	 * request that tells the two apart says „a PUT with a body lives here", which is precisely
	 * what a 404 is for.
	 *
	 * <p><b>It is not {@code @RequestBody(required = false)} either</b>, for the reason written
	 * out in full there: that annotation also clears {@code ConsumesRequestCondition}'s
	 * {@code bodyRequired}, after which {@code consumes} stops guarding the door it was
	 * declared for.
	 *
	 * <p><b>The order of the two refusals, which is a choice.</b> An incomplete form is refused
	 * BEFORE the deadline is asked about, so a caller who sends nothing at all after the
	 * deadline is told his form was empty rather than that he is late. Both are true; the form
	 * is the one he can do something about, and it is the same order {@link MeWriteApi}
	 * uses between „not complete" and anything else.
	 *
	 * @param request  the request, whose body is not touched until „has he a member" is answered
	 * @param response asked for so a refusal can go down the same road an address that is not
	 *                 there takes, exactly as {@link MeCategoryApi} does on the other verb
	 */
	@PutMapping(path = "/api/me/category", consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<?> change(@AuthenticationPrincipal WhoIsAsking.Member asking,
			HttpServletRequest request, HttpServletResponse response) throws IOException {

		Long me = memberOfAccount.competitorId(asking.account());

		if (me == null) {
			return away(response);
		}

		Wish typed = read(request.getInputStream().readAllBytes());

		if (typed == null || typed.firstSeason() == null) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST)
					.body(new NotComplete(THE_FORM_IS_NOT_COMPLETE, List.of("firstSeason")));
		}

		/* THE DEADLINE, ASKED OF THE ONE PLACE THAT ANSWERS IT, and asked as a whole answer
		   rather than as a second reading of the clock. `TheChoiceAsItStands` works out which
		   season is being chosen and whether it is still open from ONE moment; spelt here as
		   two more SeasonClock calls, this route would be free to disagree with the GET beside
		   it about which season the member is even looking at. */
		if (!theChoice.of(me).open()) {
			return ResponseEntity.status(HttpStatus.CONFLICT).body(new Refused(THE_CHOICE_IS_SHUT));
		}

		write(me, typed.firstSeason());

		/* AND THE ANSWER IS WORKED OUT AGAIN RATHER THAN ECHOED, which is load-bearing here and
		   not a habit. Two of the five fields are DERIVED and neither is in the request:
		   `firstSeasonAllowed` is a sum over his results, and `category` is the wish AND that
		   right. An answer built from what arrived would tell a member over twelve points that
		   he is in the beginners' category, which is the one thing this whole resource exists
		   to get right. */
		return ResponseEntity.ok(theChoice.of(me));
	}

	/**
	 * WHAT ARRIVED, TURNED INTO THE FORM, OR NOTHING AT ALL.
	 *
	 * <p>Absent, empty and unreadable are one answer and not three, the same principle already
	 * kept on {@code POST /api/inbox} and {@code PUT /api/me}: none of them
	 * carries a wish this route could act on, so all three are refused in the words an empty
	 * JSON object already is.
	 *
	 * <p>The application's own {@link ObjectMapper} and not one made here, so a body is read
	 * exactly as {@code @RequestBody} would have read it, unknown fields dropped and all.
	 */
	private Wish read(byte[] sent) {
		try {
			return json.readValue(sent, Wish.class);
		}
		catch (JacksonException cannot) {
			return null;
		}
	}

	/**
	 * THE WRITING, WHICH TOUCHES ONE ROW AND ONE COLUMN.
	 *
	 * <p><b>{@code competitor_id} is the one parameter that does not come out of the form</b>,
	 * so this writes the row of the member whose session this is and of nobody else. There is
	 * no path variable on this route to carry somebody else's identifier, which is the whole
	 * reason the resource is under {@code /api/me} rather than at
	 * {@code /api/competitors/{number}/category}.
	 *
	 * <p><b>No {@code insert} and no {@code on conflict}</b>, unlike
	 * {@link MeWriteApi}'s own write: the column is on {@code competitor} and is
	 * {@code not null}, so every member has a value from the moment he registers. There is no
	 * „he has no row" case here, and the season the column is named for is not written because
	 * there is nowhere to write it - see {@link TheChoiceAsItStands} for the debt that is.
	 */
	private void write(long me, boolean firstSeason) {
		db.sql("update competitor set first_season_2027 = ? where id = ?")
				.params(firstSeason, me)
				.update();
	}

	/**
	 * THE ANSWER FOR SOMEBODY THIS ADDRESS IS NOT FOR, which carries nothing at all and goes
	 * down the same road an address that is not there takes.
	 *
	 * <p>{@code sendError} rather than a status on a {@link ResponseEntity} because the
	 * {@code GET} beside it answers the identical account the identical way, and two verbs of
	 * one address that refused differently would be a difference somebody could count.
	 */
	private static ResponseEntity<?> away(HttpServletResponse response) throws IOException {
		response.sendError(HttpStatus.NOT_FOUND.value());
		return null;
	}
}
