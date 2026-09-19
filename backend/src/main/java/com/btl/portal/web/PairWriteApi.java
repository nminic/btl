package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.time.ZonedDateTime;
import java.util.Optional;

/**
 * TWO PEOPLE BECOMING A RACING PAIR: ONE ASKS, THE OTHER ANSWERS, AND ONLY THE ANSWER
 * MAKES A PAIR.
 *
 * <p>Owner, PDL P13: „Trkacki par se formira OBOSTRANOM POTVRDOM: svako sme da posalje
 * zahtev svakome, a par nastaje kad druga strana potvrdi." So {@code POST} writes a
 * question into {@code pair_invite} and nothing else, and {@code PUT} is the only thing on
 * this server that ever writes a row into {@code racing_pair}.
 *
 * <p><b>The pair is called a TRKACKI PAR and not a PAR</b> (owner, 03.08.2026, „Par svuda
 * promeniti u Trkacki par"), which this file honours the way the rest of the codebase does:
 * the English word is „racing pair" and the short form is never used on a screen.
 *
 * <p><b>IT IS WRITTEN BY A MEMBER, SO IT CARRIES NO {@link RightIsNeeded}.</b> That
 * annotation names a box the superadmin ticks for a moderator, and there is no box anybody
 * could tick that would let a member pair up: asking is what every member may do. The shape
 * is {@link MyApplicationsApi}'s and {@link CommentApi}'s - a route the portal's own people
 * use - and not {@link EventWriteApi}'s, which is the administration writing the calendar.
 * {@code /api/pairs} has been on {@link ApiSecurity#READ_BY_ANYBODY} since before this class
 * existed, and since 18.09.2026 that list is opened BY METHOD, for {@code GET}, {@code HEAD}
 * and {@code OPTIONS} and for nothing else - so a write arriving here falls through to
 * {@code anyRequest().authenticated()} and somebody who is not signed in is answered 401 by
 * the chain before this class runs. There is no condition in this class about whether
 * anybody is signed in, and there must not be one.
 *
 * <p><b>AND THE MAPPINGS SAY WHAT THEY CONSUME, WHICH IS A DECISION AND NOT A HABIT.</b>
 * Without {@code consumes}, a write arriving with no {@code Content-Type} reaches the
 * argument resolver and is answered 415 - a number that says „this address is here and wants
 * a different type", while an address mapping nothing goes on saying 404. That is the leak
 * {@link NothingIsHereRatherThanAlmost} was written for, arriving through the one door it
 * says it cannot close: a media type refused while a handler is already running is raised
 * far from {@code handleNoMatch}. Declared on the mapping, the same request never matches,
 * the dispatcher raises it FROM {@code handleNoMatch}, and the portal's existing rule turns
 * it into the 404 every unmapped address answers.
 *
 * <p><b>WHAT IS NOT HERE, EACH NAMED RATHER THAN DISCOVERED.</b>
 *
 * <ul>
 * <li><b>„RASKINI", AND THAT IS THE ONE OMISSION WORTH READING TWICE.</b> PDL P13,
 * 07.09.2026: a member's own profile carries „Raskini" beside every pair that still holds,
 * and pressing it „obavestava drugu polovinu". No {@code DELETE} is mapped here. What IS
 * here is the breaking that ACCEPTING causes, because that one is not a button of its own:
 * it is what „Prihvatanje novog poziva dok vec postoji par raskida stari" asks of this
 * route, and leaving it out would let a member hold two pairs in one season, which the
 * schema refuses outright.
 * <li><b>THE MESSAGE. NOBODY IS TOLD ANYTHING BY THIS CLASS, AND THAT IS A HOLE RATHER THAN
 * A DECISION.</b> Two sentences of the owner's are owed and neither is paid here:
 * <ul>
 *   <li>PDL P13: „Kad promena pogodi treceg clana, on se obavestava ODMAH po nastanku
 *   promene, ne na pocetku sezone", with his own example - „muskarac zatrazi novi par, nova
 *   zena prihvati, dotadasnja zena istog trenutka dobija poruku „Vas trkacki par ce u
 *   narednoj sezoni biti raskinut.""
 *   <li>PDL P13, 07.09.2026: „svaki ostavljeni partner dobija poruku imenom, u svoje
 *   sanduce, nikad ligi", and the invitation itself „stize kao poruka u sanduce, sa dva
 *   dugmeta".
 * </ul>
 * <b>Why it is not written:</b> NOTHING UNDER {@code backend/src/main} WRITES A ROW INTO
 * {@code message} AT ALL. V13 built the table and {@link InboxApi} reads it; the writing is
 * its own item of the September block (PDL, 18.09.2026, „Red unutar septembarskog bloka:
 * trke, pa uloge i prava, pa timovi, pa parovi, pa ostalo"), and inventing a second door
 * into that table here would be a home for the inbox that the increment which really owns it
 * would then have to fight. V13 already holds the shape this route will use when it arrives:
 * {@code message.pair_invite_id}, a question addressed to one person, with
 * {@code message_a_question_has_an_addressee} refusing a question sent to the league.
 * <b>What that costs today, said out loud:</b> the invitation shows on {@code
 * /api/me/applications} („Sopstveni profil nosi i pozive koji cekaju, poslate i primljene",
 * PDL, 07.09.2026) and NOWHERE ELSE, and a member whose pair is broken by somebody else's
 * acceptance is told NOTHING. A sentence here claiming otherwise would be worse than the
 * missing feature.
 * <li><b>A pair that is over.</b> Nothing here reads or writes a row of a season other than
 * the one being formed, which is PDL P13, 07.09.2026 in one condition: „par iz sezone koja je
 * prosla se NIKAD ne dira (P13, zamrznuti podaci). Oba se citaju za sezonu koja se formira,
 * pa se do zamrznutog ne stize."
 * <li><b>The day the pair was made.</b> {@code racing_pair.made_at} is written - by V12's own
 * {@code now()}, never by a value from this server - and is in no answer this class gives.
 * Owner, 13.09.2026: „Dan kad je par nastao se ne prikazuje NIKOME. Server ga ne vraca."
 * {@link PairApi} leaves it out of the public list for the same sentence; a write route
 * handing it back would be the same field leaving through a second door.
 * <li><b>A migration.</b> {@code racing_pair} and {@code pair_invite} are V12's, and V12
 * holds every rule this class leans on. Nothing here needs a column that is not there.
 * </ul>
 *
 * <p><b>THE PAIR IS MIXED AND THIS CLASS DOES NOT SAY SO A SECOND TIME.</b> „Trkacki par
 * mora biti mesovit, jedan muskarac i jedna zena" (PDL P13), and V12 holds it in the database
 * rather than in a service, by the trick V7 uses to tie a result to the day of its race:
 * {@code man_gender} and {@code woman_gender} are CONSTANTS, generated rather than written,
 * and the foreign keys point at {@code competitor (id, gender)} - so there is no row
 * {@code man_id} could hold that is not a man. What this class decides is therefore not
 * WHETHER the two may pair but WHICH COLUMN each of them goes in, and that is a placement
 * rather than a rule: written the wrong way round, the foreign key refuses the row. The one
 * placement that cannot be made - two people of one gender - is answered as a SENTENCE here
 * rather than left to arrive as a constraint violation, which is the fault
 * {@link EventWriteApi} turns into an answer for a town and a country.
 *
 * <p><b>THE SEASON IS WORKED OUT ON THE DAY OF THE ANSWER AND NEVER ON THE DAY OF THE
 * QUESTION.</b> Owner, 07.09.2026, on a review finding: „Rok od 31. decembra visi o POTVRDI,
 * ne o pozivu. PDL kaze „Formiranje mora biti ZAVRSENO do 31. decembra", a formiranje se
 * zavrsava obostranom potvrdom... Poziv poslat 31.12.2026 i prihvacen 02.01.2027 pravi par
 * za 2028, ne za 2027, jer 2027 tada vec tece." That is why {@code pair_invite} carries no
 * season at all and {@code racing_pair} does (V12), and why {@link #answer} asks
 * {@link SeasonClock#transfersTakeEffect} while {@link #invite} writes no season anywhere.
 * The moment comes from the {@link Clock} bean rather than from {@code Instant.now()}, so
 * both sides of a New Year are one fixture and two assertions ({@code WhatTimeItIs} says why
 * that bean exists), and it is read in {@code Europe/Belgrade} inside {@link SeasonClock},
 * which is ADL A36 O2 and neither the server's zone nor the database's.
 *
 * <p><b>The deadline refuses NOTHING, and that is the owner's own correction.</b> PDL P13,
 * 07.09.2026: „„i pre je 31. decembra" NIJE uslov: svaki dan godine je pre njenog kraja, pa
 * se nista nikad ne bi odbilo. Rok odredjuje KOJU SEZONU par dobija." There is no condition
 * in this class comparing a day with 31 December and there must not be one.
 *
 * <p><b>ASKING AND ANSWERING DO NOT ASK THE SAME QUESTION ABOUT AN EXISTING PAIR, AND THAT
 * IS THE ONE PLACE TWO RECORDED DECISIONS MEET.</b> Both are written down and they are not in
 * conflict once the moment each of them speaks about is named:
 *
 * <ul>
 * <li><b>Asking is refused when either of them already holds a pair for the season being
 * formed.</b> PDL P13, 07.09.2026 lists the conditions under which the button is drawn at
 * all, and this is one of them: „nijedno od njih dvoje nema trkacki par za sezonu koja se
 * formira". {@code pages/profile/InviteToPair.tsx} is the portal's own half of it and refuses
 * on exactly this. <b>This refusal DOES carry a reason, unlike the ones above it, and the
 * line between them is what the answer would give away.</b> An empty 404 is for a caller who
 * must not learn that anything is there at all; here the conflict is a RACING PAIR, and a
 * racing pair is public - Article 73 names it, {@code GET /api/pairs} serves it to a visitor,
 * and since the condition now counts only pairs that still hold, the ones it can be about are
 * exactly the ones already on that list. Naming it reveals nothing the portal does not answer
 * anyway, and refusing without a word would leave a member pressing a button nothing explains.
 * <li><b>Answering is NOT refused for it; it BREAKS the old pair on both sides.</b> PDL P13,
 * 07.09.2026, on a review finding: „Prihvatanje raskida par na OBE strane, ne samo kod onoga
 * ko je pitao... prihvatanje izvodi OBA clana iz onoga u cemu su za tu sezonu." The two rules
 * are about two moments and a question outlives the state it was asked in:
 * {@code member/PairInviteAnswer.tsx} says the same thing in its own words, reading „whatever
 * the one who asked has paired into since".
 * </ul>
 *
 * <p><b>WHO LOSES A PAIR WHEN ONE IS ACCEPTED, counted rather than assumed.</b> At the moment
 * of the answer each of the two may hold a pair for the season being formed - the schema lets
 * him hold at most one, from either side ({@code racing_pair_one_man_a_season},
 * {@code racing_pair_one_woman_a_season}) - so at most TWO rows go, and with them a THIRD and
 * a FOURTH person lose theirs. Both of them are people who pressed nothing, which is exactly
 * the case PDL P13 says „se obavestava ODMAH po nastanku promene" about, and neither is told
 * anything today for the reason written above. The boundary in the other direction: a pair of
 * ANY other season is untouched, so a member who is running one season in a pair and has made
 * another for the next keeps both, which is PDL P13, 07.09.2026 („Od 1. januara clan sme da
 * drzi dva: onaj u kom trci sezonu koja tece, i onaj napravljen za sledecu").
 *
 * <p><b>THREE THINGS BELOW ARE DERIVED AND NOT DICTATED, AND EACH SAYS SO AND NAMES WHAT IT
 * IS DERIVED FROM.</b> The owner confirmed all three on 19.09.2026, and the reason they are
 * marked is a fault this repo has already paid for: a constraint somebody reasons out, written
 * in the same tone as one copied from the journal, later reads as the owner's own decision and
 * quietly overturns it. None of the three is in {@code PDL.md} or {@code ADL.md} as a sentence
 * of his.
 *
 * <p><b>DERIVED 1: A MEMBER WHOSE FEE HAS LAPSED IS NOBODY TO THIS ROUTE, IN BOTH ANSWERS AND
 * ON BOTH SIDES.</b> „Par se raskida kad jedna strana ne produzi clanarinu" (owner,
 * 11.08.2026, „Ne postoji par onda, raskida se"), and {@link PairApi} already serves no pair
 * whose half has lapsed. This route asks the same question, in three places:
 * {@link #halfNumbered} so that a lapsed member cannot be named, {@link #half} so that neither
 * side of a pair can be one, and {@link #eitherHoldsAPairIn} so that a pair that no longer
 * holds does not stand in anybody's way.
 *
 * <p><b>This paragraph said the OPPOSITE until 19.09.2026 and the reason it was wrong is worth
 * more than the rule it replaced.</b> It argued that the fee must not be asked here because
 * „a condition over either column would refuse EVERY pair agreed between January and
 * September". That is true of {@code membership (competitor_id, season, basis)}, which carries
 * a season and has no row for the one being formed until it goes on sale on 1 October. <b>It
 * is false of {@code competitor.active}</b>, and V22 says so in as many words: „`competitor.
 * active` (V7) is one boolean with no season in it. It answers „is he a member NOW"." Two
 * columns were read as one fact, the wrong half of the sentence was carried over to the other,
 * and a whole rule was derived from it. What the review then measured is what that cost: a
 * member whose partner stopped paying was refused a new pair FROM BOTH DIRECTIONS, over a pair
 * the portal itself no longer serves, with no way out because this increment has no
 * {@code DELETE}.
 *
 * <p><b>And the form of it is PDL's own, not a choice made here.</b> PDL, 13.09.2026: „Nijedan
 * javni odgovor ne sme da imenuje clana kome je clanarina istekla, NI POSREDNO", with the
 * check every new resource must answer - „koji od ova tri oblika vazi ovde, i zasto bas taj".
 * The first form applies and the rule NAMES this resource while describing it: „Ceo red izlazi
 * kad je clanski broj jedino sto red o coveku nosi. Tako rade PAROVI i najave dolaska." The
 * whole of what these answers carry about the other person is his member number, so there is
 * no half answer available; he is answered for, or he is not there. {@link #halfNumbered} has
 * the three answers this used to give instead, and why counting consecutive numbers turned the
 * difference between them into a list of who had not paid.
 *
 * <p><b>What is still NOT asked, and this half of the old paragraph stands.</b> Nothing here
 * reads {@code membership}, so nobody is refused for not having paid the season the pair is
 * being made FOR - which nobody can have done before 1 October. The day forming really depends
 * on the season's own membership rather than on „is he a member now", it is one decision in one
 * place and this paragraph is where it lands.
 *
 * <p><b>DERIVED 2: A MEMBER WITH NO NUMBER YET MAY ACCEPT, AND CANNOT BE ASKED.</b> Since V16
 * a row in {@code competitor} is a person who REGISTERED and a member is a row whose number is
 * there. Not being askable is not a rule anybody wrote: the question names its target BY THE
 * NUMBER ON HIS CARD, and a row without one matches no number at all, so it follows from the
 * address the screen has in its hand. <b>The source is that the question was left to this
 * increment by name:</b> {@code PairApiTest} says „Whether somebody without one may be in a
 * pair is a question for the flow that makes pairs and not for a reader", and this route is
 * that flow. It is answered by a case ({@code aMemberWithNoNumberYetMayStillAnswerAQuestion})
 * and not by the reasoning in this paragraph, which is the difference between a boundary and
 * an opinion.
 *
 * <p><b>DERIVED 3: A QUESTION STANDING IN THE OTHER DIRECTION REFUSES A NEW ONE, WHICH IS
 * STRICTER THAN THE SCHEMA.</b> V12 refuses only the same direction and names the other as a
 * decision somebody else makes: „the screen hides the button when a question stands either
 * way, but that is the screen deciding". {@code pages/profile/InviteToPair.tsx} is that
 * screen, and it compares a SET of the two of them. <b>Stricter is not the same as a different
 * answer, and that is the whole of why it is allowed:</b> every row this refuses is one the
 * database would have stored and one the screen would never have sent, so nothing that the
 * portal can produce is turned away, and no question that DOES stand is answered differently
 * from the way V12 describes. What it buys is that one pair cannot become two questions in two
 * inboxes with two answers. What it costs is named too: {@code pair_invite_asked_once} is
 * never reached through this route.
 *
 * <p><b>And one thing that is not derived at all, because a recorded sentence settles it.</b>
 * A member who joined during a running season is not refused: „Clan koji se prijavi tokom
 * aktivne sezone ne ulazi u plasmane te sezone... ni u parove" (owner, 31.07.2026) is a
 * sentence about STANDINGS in THAT season, and the pair this route makes is for a season that
 * has not begun.
 */
@RestController
class PairWriteApi {

	/**
	 * A required field nobody filled in, and the only 400 here.
	 *
	 * <p>The three below are 409, and the line between the two numbers is the one every
	 * writing route on this portal draws: 400 is
	 * about the SHAPE of what was sent, which the caller can correct by sending something
	 * else, while these three are conflicts with rows already in the database - two people's
	 * stored genders, a question already standing, a pair already held - and no rewriting of
	 * the request changes any of them.
	 */
	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	/** Two people of one gender, which is the one placement {@code racing_pair} has no room for. */
	static final String THE_PAIR_WOULD_NOT_BE_MIXED = "thePairWouldNotBeMixed";

	/** A question already stands between these two, in one direction or the other. */
	static final String A_QUESTION_ALREADY_STANDS = "aQuestionAlreadyStands";

	/** One of them already holds a racing pair for the season being formed. */
	static final String A_PAIR_ALREADY_HOLDS = "aPairAlreadyHolds";

	/**
	 * The letter {@code competitor.gender} carries for a man.
	 *
	 * <p>Not a second home for „a pair is mixed": that rule is V12's and is held by two
	 * foreign keys. This is the one value this class needs in order to put each of the two
	 * into the column the schema will accept him in, and it is the same letter
	 * {@code competitor_gender_known} allows.
	 */
	private static final String MAN = "M";

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	private final Clock clock;

	/**
	 * Written by hand rather than left on the method, the same choice {@link EventWriteApi}
	 * and every other writing route made, and for the same reason: accepting is three statements
	 * that must all happen or none of them. The old pairs are deleted BEFORE the new one is
	 * written, because the schema allows one pair per person per season and the insert would
	 * otherwise be refused; a transaction that stopped between the two would leave both of
	 * them in no pair at all, having taken a third and a fourth person out of theirs.
	 */
	private final TransactionTemplate inOneTransaction;

	PairWriteApi(JdbcClient db, MemberOfAccount memberOfAccount, Clock clock,
			TransactionTemplate inOneTransaction) {

		this.db = db;
		this.memberOfAccount = memberOfAccount;
		this.clock = clock;
		this.inOneTransaction = inOneTransaction;
	}

	/**
	 * WHOM TO ASK, named by the number printed on his card.
	 *
	 * <p>The number and not a key, which is the spelling every other answer about a member
	 * uses - {@link PairApi}'s {@code memberNumbers}, {@link MyApplicationsApi}'s
	 * {@code memberNumber} - and the one the screen has in its hand, since a profile answers
	 * at {@code /sr/takmicar/000127-...}.
	 *
	 * <p>There is no {@code season}: V12 gives {@code pair_invite} no such column, because
	 * „sezona se racuna na dan POTVRDE... pa polje na pozivu ne bi bilo izvor istine nego
	 * drugi odgovor" (PDL, 07.09.2026).
	 */
	record Asked(String memberNumber) {
	}

	/**
	 * „Prihvati" or „Odbij", which are the two buttons PDL P13 puts under the question and
	 * the whole of what may be answered.
	 *
	 * @param accepted boxed on purpose: a body that names no answer at all is a form that was
	 *                 not filled in, and a primitive would read it as „Odbij" and close
	 *                 somebody's question for him
	 */
	record Answered(Boolean accepted) {
	}

	/** Why a question could not be asked or answered. */
	record Refused(String reason) {
	}

	/**
	 * @param id           the question now standing, which the caller cannot know until it
	 *                     comes back
	 * @param memberNumber whom it really reached, READ BACK OFF THE ROW: the question is
	 *                     stored by key and was asked by number, so this is the one thing
	 *                     that says the two agree
	 */
	record Asking(long id, String memberNumber) {
	}

	/**
	 * @param season the season the pair holds for, read back out of the row rather than out
	 *               of the variable that computed it. There is no {@code since} and no
	 *               {@code madeAt}: owner, 13.09.2026, „Dan kad je par nastao se ne prikazuje
	 *               nikome. Server ga ne vraca."
	 */
	record Made(long id, int season) {
	}

	/** One half of a would-be pair: who he is, and which column he can stand in. */
	private record Half(long id, String gender) {
	}

	/** The two of them in the order {@code racing_pair} stores them. */
	private record Mixed(long man, long woman) {
	}

	/**
	 * SOMEBODY ASKS SOMEBODY ELSE, AND NO PAIR IS MADE BY IT.
	 *
	 * <p>„svako sme da posalje zahtev svakome, a par nastaje kad druga strana potvrdi" (PDL
	 * P13). What this writes is one row in {@code pair_invite} and nothing else - no pair, no
	 * season, no message - and every refusal below is one the screen already makes, so a
	 * member the portal would not have drawn the button for learns nothing by sending the
	 * request by hand.
	 */
	@PostMapping(path = "/api/pairs", consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<?> invite(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@RequestBody Asked typed) {

		Long me = memberOfAccount.competitorId(asking.account());

		/* AN ACCOUNT THAT NAMES NO MEMBER, which V23 calls the ordinary case for a moderator
		   who does not race. A pair is two members, and there is nobody here to be one of
		   them; the answer is the one InboxApi and NotificationApi already give him. */
		if (me == null) {
			return away();
		}

		if (isNothing(typed.memberNumber())) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		return inOneTransaction.execute(committing -> ask(me, typed.memberNumber().strip()));
	}

	private ResponseEntity<?> ask(long me, String memberNumber) {
		Optional<Half> mine = half(me);
		Optional<Half> other = halfNumbered(memberNumber);

		/* FOUR PEOPLE GET THIS ONE ANSWER, AND THAT IS THE POINT OF IT. Nobody of that
		   number; a number whose member has not renewed; himself; and himself after HIS OWN
		   fee has lapsed. None of them is a form filled in wrongly - V12 refuses one of them
		   outright („Nobody invites himself", `pair_invite_two_people`) and the screen offers
		   none of them - so all four are one address that is not there for him, which is the
		   shape every write on this portal answers a caller it turns away with.

		   THE LAPSED ONES ARE IN THIS LIST AND NOT BELOW IT, which is PDL's rule of
		   13.09.2026 read as `halfNumbered` explains: told apart from a number nobody carries,
		   they would answer 409 or 201 where this answers 404, and the difference between
		   those answers over consecutive numbers is a list of who has not paid. */
		if (mine.isEmpty() || other.isEmpty() || other.get().id() == me) {
			return away();
		}

		Optional<Mixed> mixed = mixed(mine.get(), other.get());

		if (mixed.isEmpty()) {
			return no(HttpStatus.CONFLICT, THE_PAIR_WOULD_NOT_BE_MIXED);
		}

		/* IN EITHER DIRECTION, WHICH IS STRICTER THAN THE SCHEMA AND DELIBERATELY SO. This is
		   DERIVED 3 at the top of this class: V12 refuses only the same question asked twice
		   and names the other direction as the screen's decision, and this is the server
		   making the screen's decision. The argument for why stricter is allowed, and what it
		   costs, is written there rather than twice. */
		if (aQuestionStandsBetween(me, other.get().id())) {
			return no(HttpStatus.CONFLICT, A_QUESTION_ALREADY_STANDS);
		}

		if (eitherHoldsAPairIn(seasonBeingFormed(), me, other.get().id())) {
			return no(HttpStatus.CONFLICT, A_PAIR_ALREADY_HOLDS);
		}

		long question = db.sql("insert into pair_invite (from_id, to_id) values (?, ?)"
						+ " returning id")
				.params(me, other.get().id())
				.query(Long.class)
				.single();

		return ResponseEntity.status(HttpStatus.CREATED)
				.body(new Asking(question, whoWasAsked(question)));
	}

	/**
	 * AND THE OTHER ONE ANSWERS, WHICH IS THE ONLY THING ON THIS SERVER THAT MAKES A PAIR.
	 *
	 * <p>„Poziv stize kao poruka u sanduce, sa dva dugmeta: „Prihvati" i „Odbij". Par nastaje
	 * na potvrdu" (PDL P13, 07.09.2026). Both answers close the question - V12: „Poziv postoji
	 * dok se ne odgovori; odgovor ga uklanja i, ako je potvrdan, pravi par" - and only one of
	 * them writes anything else.
	 *
	 * <p><b>ONLY THE PERSON IT WAS ADDRESSED TO MAY ANSWER, AND A QUESTION THAT IS NOT HIS
	 * ANSWERS EXACTLY WHAT A QUESTION THAT DOES NOT EXIST ANSWERS.</b> One statement asks both
	 * halves of that, so there is no moment at which the row is in hand and the answer still
	 * depends on who is asking. {@code pages/member/PairInviteAnswer.tsx} names this as the
	 * rule a server route would be written from (security review, 08.09.2026), having found
	 * that its own guard rested on a filter over one inbox.
	 *
	 * <p><b>What the 404 hides and what it does not.</b> It hides WHICH question is his -
	 * „refused" and „not there" are one number and one empty body, so a caller walking the
	 * keys learns nothing about anybody. It does not hide that the ADDRESS exists, and it does
	 * not need to: every member may answer his own question, so unlike the administrative
	 * addresses ADL A8's 404 was written for, there is nothing about this one to keep from
	 * him.
	 *
	 * <p><b>THE ID IS THE QUESTION'S AND NOT THE PAIR'S, AND THAT IS A DECISION OF 19.09.2026
	 * RATHER THAN A CURIOSITY.</b> {@code GET /api/pairs} answers {@code racing_pair.id} and
	 * this write takes a {@code pair_invite.id}, so two tables' keys meet at one address. The
	 * address stays as it is, for two reasons:
	 *
	 * <ul>
	 * <li><b>The portal already has this shape and it is fresh.</b> {@code POST /api/teams}
	 * makes no team either: it writes a {@code team_proposal}, which is what will BECOME a
	 * team if somebody approves it. A pair and a team are deliberately alike here, which is
	 * the owner's decision of 07.09.2026: „Kako se par pravi na ekranu: isto kao poziv u tim."
	 * <li><b>No address serves two meanings at once, because {@code GET /api/pairs/{id}} does
	 * not exist.</b> The collision is between one read of the COLLECTION and one write of a
	 * MEMBER of a different collection, and nothing dispatches on the two together.
	 * </ul>
	 *
	 * <p><b>THE BOUNDARY, WRITTEN AS PART OF THE DECISION: the day {@code GET /api/pairs/{id}}
	 * is wanted, this decision is reopened.</b> From that moment one address would carry a
	 * pair's key on the read and an invitation's key on the write, and no javadoc could keep a
	 * caller from putting one where the other belongs. It is not a thing to patch then; it is
	 * the question of what {@code /api/pairs/{id}} names, and it gets decided before that
	 * route is written.
	 */
	@PutMapping(path = "/api/pairs/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<?> answer(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@PathVariable long id, @RequestBody Answered typed) {

		Long me = memberOfAccount.competitorId(asking.account());

		if (me == null) {
			return away();
		}

		if (typed.accepted() == null) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		return inOneTransaction.execute(committing -> settle(me, id, typed.accepted()));
	}

	private ResponseEntity<?> settle(long me, long question, boolean accepted) {
		Optional<Long> whoAsked = db.sql("select from_id from pair_invite"
						+ " where id = ? and to_id = ?")
				.params(question, me)
				.query(Long.class)
				.optional();

		if (whoAsked.isEmpty()) {
			return away();
		}

		if (!accepted) {
			/* „Odbij", and nothing is remembered: `member/PairInviteAnswer.tsx` says why, in
			   the same words it uses for a team - „an accepted invitation is one whose pair the
			   member is now in, a refused one is one that is closed while they are in none", so
			   two people asking on one day need not know about each other and no message ever
			   says „you refused" about a question that ended some other way. */
			closed(question);
			return ResponseEntity.noContent().build();
		}

		Optional<Half> asker = half(whoAsked.get());
		Optional<Half> answerer = half(me);

		/* AND EITHER OF THEM MAY HAVE STOPPED PAYING BETWEEN THE QUESTION AND THE ANSWER,
		   which is the whole reason the two are read again here rather than trusted from the
		   row. „Ne postoji par onda, raskida se" (owner, 11.08.2026): a pair made now with a
		   half who is no longer a member is a pair `PairApi` refuses to serve from the moment
		   it is written, and this route would be the only thing that ever created one.

		   The answer is the one an unanswerable question gets, and it tells the member
		   nothing he could not already see: `/api/me/applications` stops naming a counterpart
		   whose fee has lapsed by the same rule (`case when ... active then member_number`),
		   so the question had already gone nameless on his own screen. */
		if (asker.isEmpty() || answerer.isEmpty()) {
			return away();
		}

		Optional<Mixed> mixed = mixed(asker.get(), answerer.get());

		/* ASKED AGAIN HERE AND NOT ONLY WHERE THE QUESTION WAS SENT, because the two are
		   different moments and V12 keeps no gender key on `pair_invite` on purpose: „a
		   question that turns out to be impossible is answered „no", it is not a row the
		   database refuses to store." The question stands afterwards: nothing decided that an
		   impossible answer closes it, and closing it here would be this route deciding for
		   the member. */
		if (mixed.isEmpty()) {
			return no(HttpStatus.CONFLICT, THE_PAIR_WOULD_NOT_BE_MIXED);
		}

		int season = seasonBeingFormed();

		/* BOTH SIDES, AND THE SEASON BEING FORMED IS THE WHOLE OF WHAT THIS REACHES. PDL,
		   07.09.2026: „prihvatanje izvodi OBA clana iz onoga u cemu su za tu sezonu", and the
		   boundary beside it, „par iz sezone koja je prosla se NIKAD ne dira". Written before
		   the insert rather than after it, because one person holds one pair a season and the
		   schema would refuse the new row while the old one stood.

		   AND THIS ONE COUNTS THE RAW ROW WHILE `eitherHoldsAPairIn` DOES NOT, WHICH IS AN
		   ASYMMETRY ON PURPOSE. They ask two different questions. That one asks whether a
		   pair still HOLDS, which is a fact about the league and is the reader's answer, so a
		   half who stopped paying makes it no. This one asks what rows stand in the way of an
		   INSERT, and `racing_pair_one_man_a_season` is an index: it sees every row there is
		   and does not read `competitor.active` at all. Filtered the same way, a stale row
		   whose other half had lapsed would survive the delete and then refuse the insert,
		   and the member would meet a server fault instead of a pair. */
		db.sql("delete from racing_pair where season = ?"
						+ " and (man_id in (?, ?) or woman_id in (?, ?))")
				.params(season, mixed.get().man(), mixed.get().woman(), mixed.get().man(),
						mixed.get().woman())
				.update();

		/* `made_at` IS NOT IN THIS LIST and no value for it is sent: V12 fills it with its own
		   `now()`, and a moment read off this server would be a second home for what time it
		   is. It is written and never served (owner, 13.09.2026). */
		Made made = db.sql("insert into racing_pair (season, man_id, woman_id) values (?, ?, ?)"
						+ " returning id, season")
				.params(season, mixed.get().man(), mixed.get().woman())
				.query((row, one) -> new Made(row.getLong(1), row.getInt(2)))
				.single();

		/* AND ONLY THIS ONE. Any other question standing between either of them and anybody
		   else is left where it is: nothing decided that pairing up answers questions the
		   member has not read, and `member/PairInviteAnswer.tsx` closes exactly the one that
		   was pressed. */
		closed(question);

		return ResponseEntity.ok(made);
	}

	private void closed(long question) {
		db.sql("delete from pair_invite where id = ?").param(question).update();
	}

	/**
	 * WHICH OF THE TWO THE SCHEMA WILL TAKE AS THE MAN, or empty when neither of them can be.
	 *
	 * <p>One home for both routes, because asking and answering are the same question about
	 * the same pair; two copies would be two answers the day one of them was edited. What it
	 * is NOT is a second statement of „a pair is mixed": that is V12's, held by two foreign
	 * keys into {@code competitor (id, gender)}, and if this method ever put the two of them
	 * the wrong way round the database would refuse the row rather than store a pair that is
	 * not one.
	 */
	private static Optional<Mixed> mixed(Half one, Half other) {
		if (one.gender().equals(other.gender())) {
			return Optional.empty();
		}

		return Optional.of(MAN.equals(one.gender()) ? new Mixed(one.id(), other.id())
				: new Mixed(other.id(), one.id()));
	}

	/**
	 * The season a pair agreed at this moment holds for.
	 *
	 * <p>{@link SeasonClock#transfersTakeEffect} and NOT {@code seasonBeingPaidFor}: what is
	 * on sale in September is the season being run, and the two answers differ for nine
	 * months of the year. The portal measured that confusion on its own side on 06.09.2026 and
	 * split them apart.
	 */
	private int seasonBeingFormed() {
		return SeasonClock.transfersTakeEffect(ZonedDateTime.now(clock));
	}

	/**
	 * SOMEBODY NAMED BY THE NUMBER ON HIS CARD, OR NOBODY - AND A MEMBER WHOSE FEE HAS LAPSED
	 * IS NOBODY.
	 *
	 * <p>This is PDL's rule of 13.09.2026 answered for this resource in the shape it demands
	 * of every new one: „Nijedan javni odgovor ne sme da imenuje clana kome je clanarina
	 * istekla, NI POSREDNO", with the check „koji od ova tri oblika vazi ovde, i zasto bas
	 * taj". <b>The first form applies, and the rule names this very resource when it describes
	 * it:</b> „Ceo red izlazi kad je clanski broj jedino sto red o coveku nosi. Tako rade
	 * PAROVI i najave dolaska: nema polovicnog odgovora, red ulazi ili ne ulazi." The only
	 * thing either answer of this route carries about the other person is his member number
	 * ({@link Asking}), so there is no half answer to give: he is answered for, or he is not
	 * there at all.
	 *
	 * <p><b>What it was before, and what that cost.</b> Read without {@code active}, this
	 * route told three different stories about three people: a number nobody carries answered
	 * 404 with an empty body, a lapsed member of the wrong gender answered 409 and named his
	 * gender, and a lapsed member of the right gender answered 201 and named HIM. Member
	 * numbers are consecutive, so walking them turned the difference between those answers
	 * into a countable list of who had not paid - which is the rule's own reason for existing:
	 * such a member „nije na spisku takmicara uopste", so any other answer that names him says
	 * it by the DIFFERENCE between two answers rather than by any field in either.
	 */
	private Optional<Half> halfNumbered(String memberNumber) {
		return db.sql("select id, gender from competitor where member_number = ? and active")
				.param(memberNumber)
				.query((row, one) -> new Half(row.getLong(1), row.getString(2)))
				.optional();
	}

	/**
	 * Somebody the portal has already resolved, by key, and only while he is still a member.
	 *
	 * <p>{@code optional()} rather than {@code single()}, and the empty case is not a broken
	 * database: the id itself always names a row - it came out of {@code account.competitor_id}
	 * or {@code pair_invite.from_id}, both foreign keys into this table - but the row stops
	 * matching the moment the fee lapses, and that is a state this route has to answer rather
	 * than throw on.
	 *
	 * <p><b>Both sides, because a pair has two and the rule is about the PAIR.</b> „Ne postoji
	 * par onda, raskida se" does not ask which of the two stopped paying, and a route that
	 * asked it of one of them would make a pair {@link PairApi} refuses to serve from the
	 * moment it was written.
	 */
	private Optional<Half> half(long who) {
		return db.sql("select id, gender from competitor where id = ? and active")
				.param(who)
				.query((row, one) -> new Half(row.getLong(1), row.getString(2)))
				.optional();
	}

	private boolean aQuestionStandsBetween(long one, long other) {
		return Boolean.TRUE.equals(db.sql("select exists(select 1 from pair_invite"
						+ " where (from_id = ? and to_id = ?) or (from_id = ? and to_id = ?))")
				.params(one, other, other, one)
				.query(Boolean.class)
				.single());
	}

	/**
	 * WHETHER EITHER OF THEM IS IN A PAIR THAT STILL HOLDS, WHICH IS NOT THE SAME AS A ROW
	 * IN {@code racing_pair}.
	 *
	 * <p>„Par se raskida kad jedna strana ne produzi clanarinu" (owner, 11.08.2026, „Ne
	 * postoji par onda, raskida se"), and nothing deletes the row when that happens: a fee
	 * that lapses lowers {@code competitor.active} and removes nobody. So the row outlives
	 * the pair, and {@link PairApi} is where the portal already turns one into the other,
	 * with {@code where man.active and woman.active}.
	 *
	 * <p><b>Counting the raw row instead was a measured fault and not a nicety.</b> A member
	 * whose partner stopped paying would be told {@code A_PAIR_ALREADY_HOLDS} from BOTH
	 * directions - when he asks and when he is asked - over a pair that the portal itself no
	 * longer serves, and with no {@code DELETE} in this increment he would have no way out
	 * except somebody else's payment.
	 *
	 * <p><b>THE SAME CONDITION LIVES IN TWO PLACES AND THAT IS WRITTEN DOWN RATHER THAN
	 * HIDDEN.</b> {@link PairApi} carries it inside one query that also joins for member
	 * numbers and orders the whole list; there is no form of it that can be called from here
	 * without rewriting that reader, which is a resource this increment does not touch.
	 * <b>What keeps the two from drifting is a case and not a promise:</b>
	 * {@code PairWriteApiTest.theReaderAndThisRouteAgreeOnWhichPairsStillHold} lapses one
	 * half and asserts that the pair leaves the public answer AND stops standing in the way
	 * here, so a change to either side alone turns it red.
	 */
	private boolean eitherHoldsAPairIn(int season, long one, long other) {
		return Boolean.TRUE.equals(db.sql("select exists(select 1 from racing_pair p"
						+ " join competitor man on man.id = p.man_id"
						+ " join competitor woman on woman.id = p.woman_id"
						+ " where p.season = ? and man.active and woman.active"
						+ " and (p.man_id in (?, ?) or p.woman_id in (?, ?)))")
				.params(season, one, other, one, other)
				.query(Boolean.class)
				.single());
	}

	/** Whom the stored question really reaches, which is what makes the answer a claim. */
	private String whoWasAsked(long question) {
		return db.sql("select c.member_number from pair_invite i"
						+ " join competitor c on c.id = i.to_id where i.id = ?")
				.param(question)
				.query(String.class)
				.single();
	}

	/**
	 * Whether a field was filled in at all.
	 *
	 * <p>Absent, empty and a run of spaces are one answer and not three, which is the list of
	 * shapes {@link RegistrationApi} keeps for the same reason: JSON has a null, a
	 * form has an empty box and a person has a space bar.
	 */
	private static boolean isNothing(String value) {
		return value == null || value.isBlank();
	}

	/**
	 * THE ANSWER FOR SOMEBODY THIS ADDRESS IS NOT FOR, which carries nothing at all.
	 *
	 * <p>The shape {@link EventWriteApi} answers a caller it refuses
	 * with, and the reason for the empty body is the owner's of 05.09.2026: „adresa koju clan
	 * ne sme da otvori nije strana sa objasnjenjem nego adresa koje za njega nema."
	 */
	private static ResponseEntity<?> away() {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
	}

	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return ResponseEntity.status(status).body(new Refused(reason));
	}
}
