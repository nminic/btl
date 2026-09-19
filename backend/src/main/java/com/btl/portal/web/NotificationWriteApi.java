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
import java.util.ArrayList;
import java.util.List;

/**
 * A MEMBER TURNING HIS OWN MAIL ON AND OFF, WHICH IS THE WRITING HALF OF THE SIX SWITCHES
 * {@link NotificationApi} ALREADY READS.
 *
 * <p>Owner, PDL P22: „Zvono uvek, mejl podrazumevano ISKLJUCEN, clan ga sam pali: sve
 * drustveno i sporedno (komentar, poziv u tim, zahtev za par, ponuda prevoza, osvojena
 * znacka, poruka u inboksu)", and PDL P22, 11.08.2026: „Sest mejlova iz spiska su obavezni i
 * clan ih ne moze iskljuciti. <b>Sve ostalo bira sam.</b>" This route is that last sentence
 * and nothing else. It sends no mail, rings no bell, and reaches nobody else's row.
 *
 * <p><b>„Pali" AND „gasi" ARE ONE SENTENCE AND NOT TWO.</b> P22 writes „clan ga sam pali"
 * because the column starts {@code false}; what settles that the other direction is his too
 * is „Sve ostalo bira sam", and the fact that {@code false} is the state V13 gives every
 * switch to begin with - a route that could only turn one on would make the portal's own
 * default a state a member could leave and never return to.
 *
 * <p><b>ITS OWN CLASS, WHICH IS THE SHAPE THIS REPOSITORY ALREADY HAS FOR EVERY RESOURCE
 * THAT IS BOTH READ AND WRITTEN.</b> {@link InboxApi} and {@code POST /api/inbox},
 * {@link PairApi} and {@link PairWriteApi}, {@link TeamApi} and {@link TeamWriteApi}. So
 * {@link NotificationApi} is not touched by this increment at all, and the reading half goes
 * on saying exactly what it said before.
 *
 * <p><b>AND THE ANSWER IS {@link NotificationApi.Settings}, THE READING HALF'S OWN RECORD,
 * ON PURPOSE.</b> Two verbs of ONE address must answer one shape; a second record here would
 * be a second home for „what the six switches are called", free to drift the day either was
 * edited, and {@code onlyTheSixSwitchesP22ActuallyDecidedAreAnswered} would go on holding for
 * the read while the write quietly grew a seventh name. What arrives is NOT that record, and
 * the reason is below.
 *
 * <p><b>NOTHING IS PUBLIC AND NOTHING IS CHECKED HERE ABOUT BEING SIGNED IN.</b> The path is
 * absent from {@link ApiSecurity#READ_BY_ANYBODY}, so {@code anyRequest().authenticated()}
 * answers 401 before this class runs, and there must be no branch here pretending to ask the
 * same question a second time. It carries no {@link RightIsNeeded} either: that annotation
 * names a box the superadmin ticks for a moderator, and there is no box anybody could tick
 * that would let one member choose another's mail. Minding his own settings is what every
 * member may do.
 *
 * <p><b>AND THE MAPPING SAYS WHAT IT CONSUMES</b>, for the reason {@link TeamWriteApi} and
 * {@link PairWriteApi} write out at length: without it, a {@code PUT} arriving with no
 * {@code Content-Type} reaches the argument resolver and is answered 415, a number that says
 * „this address is here and wants a different type", while an address mapping nothing goes on
 * saying 404. Declared on the mapping, the same request never matches, the dispatcher raises
 * it from {@code handleNoMatch}, and {@link NothingIsHereRatherThanAlmost} turns it into the
 * 404 every unmapped address answers.
 *
 * <p><b>WHICH MEMBER IS ASKED OF THE SESSION AND THERE IS NOTHING IN THE REQUEST TO ASK
 * INSTEAD.</b> {@link Switches} carries six booleans and no member at all, so „he changed
 * somebody else's settings" is not a refusal this class makes but a sentence that cannot be
 * written down. That is ADL A8's own rule about {@link WhatHeMayDo} („Ko pita se cita sa
 * sesije, nikad iz tela zahteva") applied to a lookup instead of a right, and it is the same
 * arrangement {@link MemberOfAccount} exists for.
 *
 * <p><b>AN ACCOUNT WITH NO MEMBER BEHIND IT HAS NO SWITCHES TO WRITE</b>, which is
 * {@link NotificationApi}'s own answer to the identical question on the identical path: V23
 * lets {@code account.competitor_id} be null for „a moderator who does not race, which is the
 * ordinary case and not a fault", {@code notification_setting.competitor_id} points at
 * {@code competitor} and never at {@code account}, and there is nobody to file a row under.
 *
 * <p><b>The refusal is {@code sendError} and not a {@link ResponseEntity}, and on this path
 * that is measured rather than stylistic.</b> {@link TeamWriteApi} builds its own 404 and its
 * note says why it may - {@code /api/teams} is open for reading and says through
 * {@code OPTIONS} that a write lives there, so „there is nothing left for the shape of this
 * 404 to hide". Here there is. {@link NotificationApi#notifications} answers the SAME
 * ACCOUNT on the SAME PATH with {@code sendError}, and {@code RightsOverRealHttpTest}
 * measured on 17.09.2026 what the difference costs over a real socket: a status set on the
 * response comes back with {@code Content-Length: 0} while an address mapping nothing comes
 * back longer and chunked, and that length is an oracle even when both say 404. Built any
 * other way, a member-less account could tell this verb from the one beside it and learn from
 * the difference that writing lives at an address the portal never offered him.
 *
 * <p><b>A MEMBER WHOSE FEE HAS LAPSED IS NOT REFUSED, AND THIS IS DERIVED RATHER THAN
 * DICTATED.</b> It is marked as derived for the reason {@link PairWriteApi} marks its own
 * three: a constraint somebody reasons out, written in the same tone as one copied from the
 * journal, later reads as the owner's own decision and quietly overturns it. No sentence of
 * his says anything about this resource and a lapsed fee. What it is derived from:
 *
 * <ul>
 * <li><b>The reading half does not ask it, and the two halves of one resource may not
 * disagree.</b> Neither {@link NotificationApi} nor {@link MemberOfAccount} looks at
 * {@code competitor.active}, so a member whose fee has lapsed is served his switches today.
 * A {@code PUT} that refused him would leave him a panel he can read and cannot save.
 * <li><b>PDL's rule of 13.09.2026 is about a PUBLIC answer naming him, and it demands the
 * check be answered for every new resource: „koji od ova tri oblika vazi ovde, i zasto bas
 * taj".</b> None of the three applies, and the reason is that the question does not arise:
 * this resource names NOBODY. Its whole answer is six booleans about whoever is asking - no
 * member number, no name, no row about a third person - and the path is off
 * {@link ApiSecurity#READ_BY_ANYBODY}, so the only person who can ever read it is the member
 * himself. There is no difference between two answers here out of which anybody could count
 * who has not paid.
 * <li><b>Every precedent that asks {@code active} about a SECOND person asks it of that
 * person, and there is no second person here.</b> {@link PairWriteApi} asks it on both
 * halves because „Par se raskida kad jedna strana ne produzi clanarinu" (owner,
 * 11.08.2026) and a pair made with a lapsed half is one {@link PairApi} refuses to serve
 * from the moment it is written. {@code POST /api/inbox} asks it of the ADDRESSEE and never
 * of the sender. This route has neither a counterpart nor an addressee.
 * <li><b>AND THE ONE ROUTE WHERE A MEMBER WRITES FOR HIMSELF ALONE, THE SAME SHAPE THIS
 * ROUTE IS, ASKS ABOUT {@code active} NOWHERE EITHER - THOUGH THAT IS AN OBSERVATION AND
 * NOT A FIFTH REASON.</b> {@code POST /api/teams} lets any member propose a team, and
 * neither it nor {@code JoiningATeam#mayJoin} - the class it asks whether he may join -
 * looks at whether he has paid. That class's own note says the question was taken OUT of
 * it on 12.09.2026 and calls where it now belongs „still open", so its silence is a gap
 * being carried, not a decision being repeated. What it does say is that the four reasons
 * above are not contradicted anywhere else a member writes for himself alone, which absence
 * from an unrelated file would not have shown.
 * <li><b>And P22's own reason points the same way.</b> „Mejl zamor ubija dostavljivost" is
 * why the default is off; a member whose fee has lapsed is exactly the person the portal
 * should still be able to stop mailing.
 * </ul>
 *
 * <p><b>THE BOUNDARY IN THE OTHER DIRECTION, said out loud because a route that refused
 * nobody would satisfy every sentence above:</b> the account with no member is still refused,
 * and it is refused by the paragraph above this one rather than by this one. Both sides have
 * a case.
 *
 * <p><b>WHAT IS NOT HERE, EACH NAMED RATHER THAN DISCOVERED.</b>
 *
 * <ul>
 * <li><b>THE MAIL. Nothing in this class sends anything, and nothing anywhere reads these
 * columns in order to decide whether to.</b> {@link NotificationApi} reads them for a screen
 * and that is the whole of their use today. ADL A4c divides what the portal sends into three
 * kinds and only the first may go at once; which kind each of these six belongs to is a
 * question for the increment that sends them, and answering it here would be a second home
 * for it. What is worth writing down now is the half that IS derivable: by A4c's own test -
 * „Podsetnik je jedini koji portal salje od svoje volje, pa je jedini koji sme da ceka" -
 * none of the six is a reminder, because a human act stands behind every one of them, so none
 * of the six may wait.
 * <li><b>The bell.</b> P22 gives it no switch at all („Zvono uvek"), so there is nothing
 * about it to write and no column that could hold it.
 * <li><b>The six mandatory mails.</b> They have no switch, which is V13's own sentence -
 * „a column for them would be a promise the portal must refuse to keep" - so they are absent
 * from what arrives because they are absent from the table. {@code NotificationWriteApiTest}
 * holds that the set this route writes is the table's own switch columns and nothing beside
 * them; what that floor can and cannot promise is written there.
 * <li><b>A migration.</b> {@code notification_setting} is V13's and holds every column this
 * class touches. Nothing here needs one that is not there.
 * <li><b>The screen.</b> {@code Settings.tsx} still binds to the prototype's own mock keys,
 * which {@link NotificationApi} names and explains; wiring it to these six is a front end
 * change and is not in this increment.
 * </ul>
 */
@RestController
class NotificationWriteApi {

	/**
	 * A switch the form did not send, which is the only refusal here that is not a 404.
	 *
	 * <p>ADL A54, 19.09.2026, owner, on three offered outcomes: „`PUT` koji ne posalje neko
	 * polje odbija se sa 400, i kaze se sta fali. Isto na svakoj upisnoj ruti portala, bez
	 * izuzetka." Spelt the same word {@link RaceWriteApi} and {@link TeamWriteApi} spell it,
	 * because it is one sentence about a different form.
	 */
	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	/**
	 * A BODY NOBODY COULD READ, TREATED AS ONE THAT NAMED NONE OF THE SIX.
	 *
	 * <p>Absent, empty and unreadable are one answer and not three, the same principle
	 * already kept on {@code POST /api/inbox} - because none of them carries a single switch
	 * this route could act on. Routing it through {@link #whatTheFormLeftOut(Switches)}
	 * rather than a branch of its own means a body nobody can parse is refused in exactly the
	 * words an empty JSON object already is.
	 */
	private static final Switches NOTHING_ARRIVED =
			new Switches(null, null, null, null, null, null);

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	/**
	 * The one the rest of this application reads bodies with, asked for rather than made.
	 *
	 * <p>A mapper built here would be a second set of rules about what a request may carry -
	 * unknown fields, dates, nulls - free to disagree with the one every other route uses,
	 * and the disagreement would show up as a field silently not arriving.
	 */
	private final ObjectMapper json;

	NotificationWriteApi(JdbcClient db, MemberOfAccount memberOfAccount, ObjectMapper json) {
		this.db = db;
		this.memberOfAccount = memberOfAccount;
		this.json = json;
	}

	/**
	 * WHAT ARRIVES: the six switches, BOXED, and the boxing is the whole of how A54 is kept.
	 *
	 * <p>A primitive {@code boolean} reads a field nobody sent as {@code false} and turns a
	 * half filled form into „turn this off", silently, with a 200 to say it worked. That is
	 * exactly the fault A54 was written about - „`PUT /api/races/{id}` sa izostavljenim
	 * `date` tiho pomera trku" - arriving on a resource where the wrong default is the
	 * portal's own default, so nothing downstream would ever look odd.
	 * {@link PairWriteApi.Answered} boxes its one field for the same reason in the same
	 * words.
	 *
	 * <p><b>It is NOT {@link NotificationApi.Settings}, although the two carry the same six
	 * names.</b> That record is an ANSWER and its fields are primitive because a row always
	 * has a value in every column; this is a FORM and its fields are boxed because a form
	 * may arrive with a box unfilled. One record for both would have to give up one of those
	 * two properties. What keeps the two sets of names equal is a case and not this
	 * paragraph: {@code NotificationWriteApiTest} compares the components of both against the
	 * columns of the table.
	 *
	 * <p>The names and their order are V13's column order, which is also P22's own order of
	 * the six things it names.
	 */
	record Switches(Boolean commentMail, Boolean teamMail, Boolean pairMail, Boolean liftMail,
			Boolean badgeMail, Boolean inboxMail) {
	}

	/**
	 * THE REFUSAL, SAYING WHICH SWITCHES WERE LEFT OUT.
	 *
	 * <p>A54 asks for both halves and not just the first, and the second half - „i kaze se
	 * sta fali" - existed on exactly one route when this was written. The shape is
	 * {@link RaceWriteApi.NotComplete}'s, field for field and in that order: {@code reason}
	 * first, carrying the same word a bare refusal would, so a caller that reads a refusal by
	 * its reason reads this one unchanged, and the list is what is added rather than what is
	 * swapped.
	 *
	 * <p>The names in it are the components of {@link Switches}, which are the names the JSON
	 * uses, so what comes back is the name of the field the caller failed to send rather than
	 * a translation of it.
	 */
	record NotComplete(String reason, List<String> missing) {
	}

	/**
	 * WHAT ARRIVES, READ AS BYTES AND ONLY AFTER „HAS HE A MEMBER" IS ANSWERED, AND THAT
	 * ORDER IS THE WHOLE OF WHY THIS SIGNATURE IS NOT {@code @RequestBody Switches}.
	 *
	 * <p><b>Measured, not foreseen.</b> Written the ordinary way, a signed in account with no
	 * member behind it sent {@code Content-Type: application/json} and a body Jackson
	 * refuses, and was answered <b>400</b>, while the identical request to an address that
	 * maps nothing answered <b>404</b>. The body is read while ARGUMENTS ARE RESOLVED, which
	 * is before the first line of this method, so the refusal below never ran. One request,
	 * and the difference says „a PUT with a body lives at this address" - the exact leak
	 * already measured on {@code POST /api/inbox}, and the one the note at the top of this
	 * class claims cannot happen.
	 *
	 * <p><b>Why it is not solved at the door, said out loud because that IS the portal's
	 * shape for this.</b> {@link RightsAtTheDoor} decides in {@code preHandle}, before any
	 * argument is resolved, which is why a route wearing {@link RightIsNeeded} answers 404
	 * to the same probes. But it knows exactly two kinds of guard - a box the superadmin
	 * ticks, and {@link OnlyTheSuperadmin} - and „does this account name a member" is
	 * neither: {@code RightsAtTheDoorTest} says in as many words that having an inbox, or
	 * switches of his own to write, is not a privilege a superadmin grants but a consequence
	 * of being a member. A third kind would wear {@link AskedAtTheDoor}, and that mark means
	 * „a right decides here" to every floor that counts guarded routes, so
	 * {@code everyRouteTheDoorDecidesIsShutToACompetitorAlthoughHeIsSignedIn} would then
	 * demand a plain member be REFUSED this route - the opposite of what it is for. So the
	 * door is not widened; the order inside this method is fixed instead.
	 *
	 * <p><b>AND IT IS NOT {@code @RequestBody(required = false)}, WHICH WAS MEASURED WRONG
	 * ON {@code POST /api/inbox} THE SAME HOUR IT WAS FIRST TRIED.</b> That annotation does
	 * two things and only one of them is wanted: it stops an absent body being an exception,
	 * and it also sets {@code ConsumesRequestCondition}'s own {@code bodyRequired} flag to
	 * false - after which that condition, which asks {@code hasBody(request)} for itself,
	 * stops applying to a request that carries no body at all. {@code consumes} would then
	 * stop guarding the very door it was declared for, and a {@code PUT} with no
	 * {@code Content-Type} would move from 404 to 400. Taking the request instead leaves
	 * that flag at its default of {@code true}, so {@code consumes} goes on refusing before
	 * anything is dispatched, and nothing is read from the body until this method asks for
	 * it.
	 *
	 * @param request  the request, whose body is not touched until „has he a member" is
	 *                 answered
	 * @param response asked for so a refusal can go down the same road an address that is not
	 *                 there takes, exactly as {@link NotificationApi#notifications} does on
	 *                 the other verb of this same path
	 */
	@PutMapping(path = "/api/me/notifications", consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<?> change(@AuthenticationPrincipal WhoIsAsking.Member asking,
			HttpServletRequest request, HttpServletResponse response) throws IOException {

		Long me = memberOfAccount.competitorId(asking.account());

		if (me == null) {
			return away(response);
		}

		Switches typed = read(request.getInputStream().readAllBytes());
		List<String> missing = whatTheFormLeftOut(typed == null ? NOTHING_ARRIVED : typed);

		if (!missing.isEmpty()) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST)
					.body(new NotComplete(THE_FORM_IS_NOT_COMPLETE, missing));
		}

		write(me, typed);

		return ResponseEntity.ok(switchesWrittenDown(me));
	}

	/**
	 * WHAT ARRIVED, TURNED INTO THE FORM, OR NOTHING AT ALL.
	 *
	 * <p>The application's own {@link ObjectMapper} and not one made here, so a body is read
	 * exactly as {@code @RequestBody} would have read it - unknown fields dropped and all -
	 * and the only thing this increment changed about reading it is WHEN.
	 */
	private Switches read(byte[] sent) {
		try {
			return json.readValue(sent, Switches.class);
		}
		catch (JacksonException cannot) {
			return null;
		}
	}

	/**
	 * THE WRITING, AND „HE HAS NO ROW" IS NOT A CASE THIS ROUTE BRANCHES ON.
	 *
	 * <p><b>A member who has never opened Settings has no row at all</b>, which
	 * {@link NotificationApi} calls the ordinary state for most members today and not a
	 * fault: {@code notification_setting} has {@code competitor_id} as its primary key and
	 * nothing writes the table - registration does not, and until this class nothing else
	 * did either. V13's {@code default false} is a rule about a COLUMN of a row that exists,
	 * so it says nothing whatever about a member who has none.
	 *
	 * <p><b>So the row is made by the same statement that changes one</b>, and the first
	 * thing a member ever does here is indistinguishable from the tenth. Written as „look,
	 * then insert or update" it would be two statements with a window between them in which
	 * two requests of his own could both find no row and both insert, and the second would
	 * meet {@code notification_setting_pk} as a server fault rather than as an answer. One
	 * statement has no such moment, which is {@code POST /api/inbox}'s own reason for holding
	 * no {@code TransactionTemplate}: there is nothing here that can be half done.
	 *
	 * <p><b>The boundary in both directions, because „create a row when there is none" is a
	 * sentence that must not grow.</b> It creates a row for the member whose session this is
	 * and for nobody else - {@code competitor_id} is the one parameter that does not come out
	 * of the form - and it creates one only where the form was complete, because the refusal
	 * above returns before this method is reached. A member who sends six {@code false} gets
	 * a row of six falses written for him, which reads back exactly as having no row did;
	 * that is not a wasted row but the only way „I have chosen silence" and „I have never
	 * been here" can be one answer, which is what {@link NotificationApi} already promises.
	 */
	private void write(long me, Switches typed) {
		db.sql("insert into notification_setting (competitor_id, comment_mail, team_mail,"
						+ " pair_mail, lift_mail, badge_mail, inbox_mail)"
						+ " values (?, ?, ?, ?, ?, ?, ?)"
						+ " on conflict (competitor_id) do update set"
						+ " comment_mail = excluded.comment_mail,"
						+ " team_mail = excluded.team_mail,"
						+ " pair_mail = excluded.pair_mail,"
						+ " lift_mail = excluded.lift_mail,"
						+ " badge_mail = excluded.badge_mail,"
						+ " inbox_mail = excluded.inbox_mail")
				.params(me, typed.commentMail(), typed.teamMail(), typed.pairMail(),
						typed.liftMail(), typed.badgeMail(), typed.inboxMail())
				.update();
	}

	/**
	 * AND THE ANSWER IS READ BACK OUT OF THE ROW, with the one thing that claim is NOT
	 * measured against written down beside it.
	 *
	 * <p>What it really holds is that the write LANDED: a statement that wrote somebody
	 * else's row, or an {@code on conflict do nothing} where an update belongs, both leave
	 * this reading the member's old values, and the case that compares them fails.
	 *
	 * <p><b>What it does not hold, named rather than left to be found.</b> Six booleans are
	 * stored exactly as they arrive - there is no {@code strip} here, no address worked out
	 * of a name, nothing the table changes on the way in - so an answer built out of the
	 * REQUEST instead of out of the row would be identical on every request that got this
	 * far. {@link TeamWriteApi} and {@code POST /api/inbox} can measure their own read-back
	 * because what they write is transformed; that reason does not carry over, and a case
	 * claiming it here would be a case about nothing. It is read off the row anyway, because
	 * the day a column gains a default, a trigger or a check that rewrites, this answer is
	 * right without anybody remembering it had to be changed.
	 */
	private NotificationApi.Settings switchesWrittenDown(long me) {
		return db.sql("select comment_mail, team_mail, pair_mail, lift_mail, badge_mail,"
						+ " inbox_mail from notification_setting where competitor_id = ?")
				.param(me)
				.query((row, one) -> new NotificationApi.Settings(row.getBoolean(1),
						row.getBoolean(2), row.getBoolean(3), row.getBoolean(4),
						row.getBoolean(5), row.getBoolean(6)))
				.single();
	}

	/**
	 * WHAT THE FORM LEFT OUT, in the order {@link Switches} carries the six.
	 *
	 * <p>Every one of them is required and there is no list of exceptions, which is the
	 * difference between this and {@link RaceWriteApi}'s own: there, three fields of the
	 * record are not part of the form. Here the record IS the form, all six columns are NOT
	 * NULL with no third state, and a switch left out is a switch whose value nobody named.
	 *
	 * <p><b>The list is written out by hand and it has a floor in the same commit.</b>
	 * {@code NotificationWriteApiTest} takes the switches off the CATALOGUE - every column of
	 * {@code notification_setting} that is not part of its primary key - and drives one case
	 * per switch, sending a complete body with exactly that key taken out. A seventh column
	 * arriving tomorrow is a case that fails the day it is added rather than a switch nobody
	 * remembered to require.
	 */
	private static List<String> whatTheFormLeftOut(Switches typed) {
		List<String> missing = new ArrayList<>();

		if (typed.commentMail() == null) {
			missing.add("commentMail");
		}
		if (typed.teamMail() == null) {
			missing.add("teamMail");
		}
		if (typed.pairMail() == null) {
			missing.add("pairMail");
		}
		if (typed.liftMail() == null) {
			missing.add("liftMail");
		}
		if (typed.badgeMail() == null) {
			missing.add("badgeMail");
		}
		if (typed.inboxMail() == null) {
			missing.add("inboxMail");
		}

		return missing;
	}

	/**
	 * THE ANSWER FOR SOMEBODY THIS ADDRESS IS NOT FOR, which carries nothing at all and goes
	 * down the same road an address that is not there takes.
	 *
	 * <p>The reason it is {@code sendError} rather than a status on a {@link ResponseEntity}
	 * is written at the top of this class, and it is a fact about THIS path rather than a
	 * habit: the {@code GET} beside it answers the identical account the identical way, and
	 * two verbs of one address that refused differently would be a difference somebody could
	 * count.
	 *
	 * <p>Returning {@code null} afterwards is how {@link NotificationApi} says the same
	 * thing: the error has been committed and there is no body left to write.
	 */
	private static ResponseEntity<?> away(HttpServletResponse response) throws IOException {
		response.sendError(HttpStatus.NOT_FOUND.value());
		return null;
	}
}
