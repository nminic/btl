package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.team.JoiningATeam;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;

/**
 * SOMEBODY GETTING INTO A TEAM THAT ALREADY EXISTS, WHICH GOES BOTH WAYS AND UNTIL NOW WENT
 * NEITHER.
 *
 * <p>Owner, PDL P13: „Učlanjenje ide u oba smera kroz portal: takmičar šalje administratoru
 * tima zahtev na odobrenje, ili administrator šalje takmičaru poziv." Measured on
 * 26.09.2026, before this class: the only statement on the whole server that ever wrote
 * {@code team_membership} was {@link VerificationWriteApi}'s approval of a PROPOSED team, so
 * a member could found a team and leave one and could do nothing else at all.
 *
 * <p><b>WHO DECIDES IS NOT THE SAME PERSON IN THE TWO DIRECTIONS, AND THE ASYMMETRY IS THE
 * WHOLE OF WHAT THIS CLASS HAD TO GET RIGHT.</b> Both halves are the owner's, taken on one
 * day, and reading one of them off the other is the mistake this paragraph exists to stop.
 *
 * <ul>
 * <li><b>An APPLICATION is decided by whoever leads that team.</b> PDL.md
 * ("Prijavu u tim odobrava administrator tog tima"):
 * „**[ODLUKA 05.09.2026] Prijavu u tim odobrava administrator tog tima.** Ne moderator: ko
 * je u čijem timu nije stvar lige nego tima."
 * <li><b>An INVITATION IS SENT BY WHOEVER LEADS THE TEAM, AND SO IS TAKING ONE BACK.</b>
 * PDL.md ("samo administrator tog tima"): „**[ODLUKA 27.09.2026, vlasnik]** Poziv u tim
 * salje **samo administrator tog tima**", and beside it PDL.md
 * ("Povlacenje poziva takodje sme samo administrator"): „**[IZVEDENO, ne pitano]
 * Povlacenje poziva takodje sme samo administrator.** Pravo da se poziv povuce prati pravo da
 * se posalje; da ga zadrzi bilo koji clan, tim bi mogao da ponisti odluku coveka koji je
 * jedini smeo da je donese."
 * <p><b>THIS OVERTURNS THE OWNER'S OWN DECISION OF 05.09.2026 AND THE WAY THIS CLASS WAS
 * FIRST WRITTEN, so what it replaced is named rather than quietly gone.</b> PDL.md
 * ("obara pretpostavku da poziv šalje administrator") used to say the button was seen by
 * „bilo koji clan tog tima, ne samo
 * administrator", with his parenthesis „(bilo koji clan)" recorded as explicitly overturning
 * the obvious reading; that line is struck through and dated in the journal.
 * <p><b>How the conflict was found is the part worth keeping.</b> Not by review and not by
 * searching: by reading the source text of the rulebook in order to translate it. <b>Article
 * 53</b> ({@code V24__static_pages.sql:811}) has said all along „Administrator tima odobrava
 * zahteve za uclanjenje i salje pozive. Uclanjenje ide u oba smera: takmicar salje zahtev, ili
 * administrator tima salje poziv", and the owner, shown both texts side by side, chose the
 * rulebook. <b>No guard here could have seen it:</b> the rulebook is prose in a database
 * column and this code is written from the journal, so the two can disagree for weeks and
 * every case stays green. That is a gap in the process rather than in this class, and
 * PDL.md ("nijedan cuvar to nije mogao da vidi") records it as one.
 * <li><b>And an INVITATION is answered by the one person it names.</b> PDL.md
 * ("Poziv u tim prihvata pozvani član"): „**[ODLUKA 05.09.2026] Poziv u tim prihvata
 * pozvani član.** Niko ne
 * sme da upiše promenu koja se tiče drugog čoveka bez njegove reči, pa ni član tima koji
 * poziva."
 * </ul>
 *
 * <p><b>Three older sentences of PDL said the administrator sends invitations too</b>
 * (PDL.md ("Administrator tima odobrava zahteve za učlanjenje"),
 * PDL.md ("takmičar šalje administratoru tima zahtev na odobrenje"),
 * PDL.md ("Tim ima svog administratora, i to je")) <b>and were struck through on
 * 27.09.2026</b>, the decision of 05.09.2026 having overturned that half of each of them
 * without anybody crossing them out at the time. Named here because a reader who finds one
 * of them uncrossed in an older copy of the journal would write this route the wrong way
 * round, and the wrong way round refuses exactly the members the owner meant to serve.
 *
 * <p><b>ONE CLASS FOR BOTH DIRECTIONS, WHICH IS {@link TeamWriteApi}'S OWN ARGUMENT AND NOT
 * A CONVENIENCE.</b> That class holds founding a team beside leaving one because „the owner
 * put leaving in the same transfer window joining is in, so the two belong beside each other
 * rather than in two files that would each have to hold half of one window". An application
 * and an invitation are two directions through that same window, share the season they
 * write, the fee they ask about and the membership they end in; split in two they would be
 * two files each holding half of one act. What they do NOT share is who decides, and that is
 * the paragraph above rather than a shared method.
 *
 * <p><b>WHY NOT IN {@link TeamWriteApi} ITSELF, WHICH IS A MEASUREMENT RATHER THAN A FEELING
 * ABOUT FILE LENGTH.</b> {@code frontend/src/pages/account/refusals.test.ts} pins that file
 * at exactly six declared constants and demands a screen sentence for every one of them; a
 * seventh declared there fails that gate on the number, and the screens of this increment
 * are a later branch's work. {@code Membership#LEFT_ON_HIS_OWN} carries the same measurement
 * from the other side - a constant was moved OUT of {@link TeamWriteApi} for this exact
 * reason. <b>And the boundary of that gate, measured on 27.09.2026 rather than assumed:</b>
 * its list of files is written by hand, seven of them, with no floor demanding that every
 * writing class be on it - so this file is deliberately absent from it, and the branch that
 * draws these screens is the one that adds it. Written down here because an absence nobody
 * named would read as an oversight.
 *
 * <p><b>IT CARRIES NO {@link RightIsNeeded}, AND THAT IS A REFUSAL RATHER THAN AN
 * OMISSION.</b> That annotation names a box the superadmin ticks for a moderator, and there
 * is no box anybody could tick that would let one member into another's team: what decides
 * is the session and the roster, inside the handler. The shape is {@link PairWriteApi}'s and
 * {@link MyApplicationsApi}'s. All five routes are named in
 * {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT}, whose snapshot is compared exactly in
 * both directions, so a route added here with no line there fails the build.
 *
 * <p><b>Nobody who is not signed in reaches this class.</b> {@link ApiSecurity} opens
 * {@code /api/teams} for {@code GET}, {@code HEAD} and {@code OPTIONS} alone and holds whole
 * addresses rather than prefixes, so none of the five paths below is on it and every one of
 * them falls through to {@code anyRequest().authenticated()} - 401 from the chain. There is
 * no condition in this class about whether anybody is signed in and there must not be one.
 *
 * <p><b>THE NUMBERS ARE 401 AND 404 AND NEVER 403</b> (ADL A8, owner, 13.09.2026), with 409
 * for a conflict with rows that are already there. Where the line between an empty 404 and a
 * 409 carrying a reason falls is decided per route below, by one question each time: what
 * would the answer give away that the portal does not say out loud anyway.
 *
 * <p><b>THE SEASON A MEMBERSHIP BEGINS IN IS {@link SeasonClock#transfersTakeEffect} READ ON
 * THE DAY OF THE ANSWER, AND THE COLUMN ON THE QUESTION IS NOT THE SOURCE OF IT.</b> This is
 * the owner's choice of 27.09.2026 between two named outcomes, and it is the one decision of
 * this increment that had to be taken before a line was written, because {@code season} is
 * {@code not null} on both tables and something has to go in it.
 *
 * <ul>
 * <li><b>What the schema's own note claims.</b> V12, over both tables: „which season is
 * being asked about is decided when the asking starts and <b>must not drift while it
 * waits</b>."
 * <li><b>Why that is false about this portal, measured on three readers.</b>
 * {@code frontend/src/session/context.ts:263} and {@code :315} give an application and an
 * invitation {@code id}, {@code teamId}, {@code memberNumber} and {@code date} and <b>no
 * season at all</b>; {@code TeamDetail.tsx:389} and {@code member/InvitationAnswer.tsx:142}
 * write {@code transfersTakeEffect(today)} at the moment of the ANSWER; and
 * {@link VerificationWriteApi} at line 519 reads that same method on the day the moderator
 * decides, with its own note at line 106 saying the portal has already made this exact
 * mistake once.
 * <li><b>And the drift is reachable rather than theoretical.</b> PDL.md
 * ("Poziv van roka čeka, ne propada"):
 * „**Poziv van roka čeka, ne propada.** Poruka ostaje i kaže da poziv čeka; 1. oktobra se
 * dugme vraća samo od sebe." An invitation sent in December 2027 carries 2028 and, answered
 * in October 2028, takes effect in 2029 - so the frozen column names a season that is by
 * then already being run, and a membership written from it would put a member in a team
 * mid-season, which PDL P13 forbids in as many words („stupa na snagu tek 1. januara
 * naredne sezone").
 * </ul>
 *
 * <p>So the column is written with the season that was being asked about when the question
 * was asked, it is never read back to decide anything, and its one live job is the unique key
 * that lets a refused member ask again next year. <b>V12's sentence is superseded and is
 * named here rather than edited, because a merged migration is immutable (ADL A2)</b> - the
 * shape {@link TeamWriteApi} and {@link PairWriteApi} both use for a paragraph of their own
 * that measurement reversed.
 *
 * <p><b>THE WINDOW BINDS THREE OF THE FIVE ACTS AND NOT ALL FIVE, and that is the owner's
 * reason rather than symmetry.</b> PDL.md ("traži prelazni rok"):
 * „**[ODLUKA 06.09.2026, izvedeno]
 * „Prihvati" traži prelazni rok, „Odbij" ne.** Prihvatanje upisuje klub na zapis i sezonu od
 * koje član trči za njega, dakle menja sastav... Odbijanje ne upisuje ništa o sastavu nego
 * samo završava pitanje. Vezan za rok i on, član pozvan 30. decembra ne bi mogao ni da
 * prihvati ni da se oslobodi pitanja do sledećeg oktobra." So asking, inviting and accepting
 * are inside 15 October to 31 December and refusing is not. <b>Taking a question back is not
 * bound either, and that is read off the same sentence</b>: it writes nothing about a squad
 * and it is the asker's own end to his own question, which PDL.md
 * ("ostaje njegova da je povuče") names for the
 * application in as many words - „Prijava u oba slučaja ostaje njegova da je povuče, pa i
 * dalje ima kraj koji ne zavisi ni od koga drugog." <b>That last step is my reasoning over
 * his sentence and is marked as such</b>, because a constraint reasoned out and written in
 * the same tone as one copied from the journal later reads as his.
 *
 * <p><b>The window is never spelt out here.</b> {@link SeasonClock#transferWindowOpen} is
 * where 15 October lives, it reads the moment in {@link SeasonClock#ZONE} before it looks at
 * a month (ADL A36 O2), and {@link TeamWriteApi} and {@link JoiningATeam} read the same
 * method. A month written in this file would be that window with a second home.
 *
 * <p><b>A MEMBER WHOSE FEE HAS LAPSED IS NOBODY TO ANY OF THE FIVE, ON EVERY SIDE.</b>
 * Owner, 19.09.2026 (PDL.md ("mesta clan kojem je istekla clanarina moze da pristupa samo
 * strani za obnovu clanarine")): „Želim da od svih mesta član kojem je istekla
 * članarina može da pristupa samo strani za obnovu članarine... jer se sve akcije za njega
 * brane." Getting into a team is such an action, and so is deciding about somebody's, so
 * {@code competitor.active} is asked of the caller, of the applicant and of the invitee.
 * {@link JoiningATeam} does NOT ask it and says so itself - „Whether a member has paid is
 * the service layer's question, and it is still open" - so this class is that layer and this
 * paragraph is the answer. {@link TeamApi#WHO_STANDS_IN_A_TEAM} already carries the same
 * condition for the roster, and a member named by number is resolved exactly as
 * {@link PairWriteApi}'s {@code halfNumbered} resolves one, for the reason written there:
 * told apart from a number nobody carries, a lapsed member would be named by the DIFFERENCE
 * between two answers over consecutive numbers.
 *
 * <p><b>ANSWERING A QUESTION DELETES ITS ROW, WHICH THE SCHEMA DECIDED AND THIS CLASS DOES
 * NOT REOPEN.</b> V12: „An answer is not a column here: accepting an application writes a
 * row in {@code team_membership} and removes this one, refusing removes it." So there is no
 * state anywhere and {@link MyApplicationsApi} reads these two tables by existence alone.
 *
 * <p><b>BUT THE MESSAGE IN THE INBOX IS A JOURNAL AND OUTLIVES THE QUESTION, AND THAT IS A
 * MEASUREMENT OF 27.09.2026 THAT CHANGED HOW THIS CLASS IS WRITTEN.</b>
 * {@code message_team_invitation_fk} is {@code on delete cascade} (V13), with its own note
 * saying why - „an invitation that has been answered or withdrawn leaves a message that is
 * no longer a question, and the row would offer a button that does nothing" - and
 * {@code InboxConstraintsTest.withdrawingTheInvitationTakesTheMessageThatAskedAboutIt}
 * asserts exactly that of the constraint. Left to it, deleting the row would take the
 * member's message with it, and the owner decided the opposite on 06.09.2026
 * (PDL.md ("Poruka sa pozivom ostaje u sandučetu, sa razlogom umesto dugmadi")):
 * „**Poruka sa pozivom ostaje u sandučetu, sa razlogom umesto
 * dugmadi.** Ne briše se: brisanje poruke iz tuđeg sandučeta je brisanje istorije, a pitanje
 * „šta se desilo sa onim pozivom" mora da ima odgovor."
 *
 * <p>Both are honoured by {@link #theInvitationIsOver}, which empties the pointer before it
 * deletes the row: the message stays where it was, and what goes is the thing that made it a
 * question, which is the whole of what V13's note asks for. <b>Neither the constraint nor its
 * case is touched</b> - that case deletes the row in SQL with no route in it and goes on
 * measuring the constraint's own action.
 *
 * <p><b>AND THAT IS NOT THE ONLY ROAD ONTO THAT CASCADE, WHICH IS A HOLE THE REVIEW OF THIS
 * BRANCH MEASURED RATHER THAN A SECOND SENTENCE ABOUT THE SAME ONE.</b> V12 makes
 * {@code team_invitation_team_fk} cascade too, so <b>deleting a TEAM</b> reaches
 * {@code message} down a chain this class never touches - and three routes delete teams
 * ({@code DELETE /api/teams/{id}}, a member walking out of his last team, the administration
 * deleting a member). The owner's sentence above is about a message in an inbox and says
 * nothing about which road takes it, so all four roads owe it the same thing. The other three
 * are answered where they already meet - {@link ATeamGoesWithItsLastMember}, the one method in
 * the portal that runs {@code delete from team} - and that class carries the reasoning for why
 * it is there and not at the call sites. Named here because this class was the first code on
 * the server ever to write {@code message.team_invitation_id}, and a reader who found the
 * emptying only in this file would think the decision was fully served by it.
 *
 * <p><b>What this does not give, said out loud:</b> the reason
 * sentence. With no pointer the screen cannot tell an invitation that was answered from one
 * that was taken back, so {@code teams.inviteClosed} („Ovaj poziv više ne stoji") has
 * nothing to key off. That sentence is drawable in the mock because the mock has no foreign
 * key, and under this schema a message pointing at a row that is gone cannot exist at all;
 * carrying it would need a column that is a number and not a key, which is a migration and a
 * decision nobody has taken.
 *
 * <p><b>AND A QUESTION SOMEBODY ELSE'S TEAM ASKED IS LEFT EXACTLY WHERE IT IS.</b>
 * PDL.md ("Poziv se ne pamti kao odgovoren"): „**[ODLUKA 06.09.2026] Poziv se ne pamti
 * kao odgovoren nego se pravo
 * na odgovor računa u trenutku iscrtavanja.** Čim član ima tim, nijedan drugi poziv ne nudi
 * „Prihvati"." So entering a team deletes nothing of any other team's, and their messages
 * stand with it; what changes is that the answer is no longer possible, which
 * {@link MyApplicationsApi} computes when it is asked rather than remembering.
 * {@link PairWriteApi#settle} takes the same care in the same words („AND ONLY THIS ONE").
 * What those teams DO get is a line in the inbox, below.
 *
 * <p><b>EVERY SERBIAN SENTENCE THIS CLASS WRITES IS THE PORTAL'S OWN, READ OUT OF ITS
 * DICTIONARY AND TIED TO IT BY A CASE.</b> The eight of them are {@code teams.joinDone*},
 * {@code teams.joinNo*}, {@code teams.invite*} and {@code teams.inviteMissed*} in
 * {@code frontend/src/i18n/sr.json}, and
 * {@code TeamJoiningWriteApiTest.theSentencesAreThePortalsOwnWords} reads that file,
 * substitutes the same values into each template and requires this class to answer the same
 * string. Two homes for one Serbian sentence with nothing tying them together is how the
 * server and the screen drift apart, which is {@link PairWriteApi#theBrokenPairReads}'s own
 * reason for being a method rather than a concatenation.
 *
 * <p><b>WHAT IS NOT HERE, EACH NAMED RATHER THAN DISCOVERED.</b>
 *
 * <ul>
 * <li><b>ANY MESSAGE TO A TEAM ABOUT THE ANSWER TO ITS OWN INVITATION, AND IT IS A HOLE
 * RATHER THAN A DECISION.</b> PDL.md ("Ishod poziva se vraća timu kao poruka onome ko vodi
 * tim") asks for one: „**[ODLUKA 06.09.2026]
 * Ishod poziva se vraća timu kao poruka onome ko vodi tim u trenutku odgovora**, računato iz
 * rostera tada, ne zapamćeno." No sentence for it exists - the dictionary has words for the
 * invitation, for an application's two outcomes and for an invitation overtaken by another
 * team, and none at all for „he accepted yours" or „he refused yours". A sentence invented
 * here would be the server writing the portal's Serbian for a decision nobody took, which is
 * the line {@link TeamWriteApi#leave} draws („NOBODY IS TOLD, AND THAT IS THE ABSENCE OF A
 * SENTENCE"). The team is not left blind in the meantime and PDL.md ("strana tima pokazuje
 * i pozive") says why:
 * „strana tima pokazuje i pozive koje je poslala, da tim ne zavisi od poruke" - the row
 * leaving the team's own list IS the answer.
 * <li><b>Any message to the invited member when a team takes its invitation back.</b> Same
 * shape and same reason: no sentence exists anywhere for it. His inbox keeps the invitation
 * he was sent, by {@link #closed} above.
 * <li><b>A message to a team when somebody applies to it.</b> Not an omission: the owner
 * moved the application OFF the inbox entirely on 06.09.2026 („Prijava je zapis o timu i
 * stoji na strani tog tima; sanduče članu samo javlja ishod"), because an application is
 * decided by a ROLE that may change hands between the question and the answer and a letter
 * addressed to a person would freeze it. Five rounds of review and ten findings had one
 * cause, which that entry records.
 * <li><b>A moderator.</b> PDL.md ("moderatorski red za verifikaciju"):
 * „**[ODLUKA 05.09.2026] Ni prijava ni poziv ne
 * idu u moderatorski red za verifikaciju.**" Nothing here writes {@code verification}.
 * <li><b>A migration.</b> {@code team_application} and {@code team_invitation} are V12's and
 * carry every column this class writes. <b>That {@code team_invitation} records no sender is
 * right rather than missing, and the reason is {@link #takeBack}'s in full:</b> under the
 * decision of 27.09.2026 the one who sends an invitation and the one who takes it back are
 * the same SEAT, and a seat is not always the same PERSON, because the title passes when
 * somebody leaves. So both acts ask {@link #heAdministersThisTeam} at the moment they happen,
 * and a {@code sent_by} column would be a memory of who typed that no condition here may
 * read. <b>The argument that used to stand here read the other way round</b> - that anybody
 * in the team could have sent it, so recording a sender was pointless - and it rested on
 * exactly the half of PDL.md ("obara pretpostavku da poziv šalje administrator") the
 * owner overturned on 27.09.2026.
 * <li><b>Any length for anything.</b> Nothing in either request is free text.
 * </ul>
 */
@RestController
class TeamJoiningWriteApi {

	/** A required field nobody filled in, and the only 400 in this class. */
	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	/**
	 * AN ACT THAT CHANGES A SQUAD, ASKED ON A DAY THE TRANSFER WINDOW IS SHUT.
	 *
	 * <p>Spelt exactly as {@link TeamWriteApi#THE_WINDOW_IS_SHUT} and
	 * {@link JoiningATeam.Answer#THE_WINDOW_IS_SHUT}, because it is one window read by three
	 * files. It carries a reason rather than an empty 404 for the line that class draws: the
	 * only caller who reaches it is somebody the portal has already agreed belongs here, and
	 * the one fact it gives away - that the window is shut today - the portal says out loud
	 * on the membership page to anybody who opens it ({@code membership.transferShut}).
	 */
	static final String THE_WINDOW_IS_SHUT = "theWindowIsShut";

	/**
	 * THE MEMBER THIS IS ABOUT ALREADY HAS A TEAM FOR THE SEASON IN QUESTION.
	 *
	 * <p><b>It names somebody and is still safe, which is measured rather than assumed.</b>
	 * Which teams a member stands in is public - {@code GET /api/teams} answers the roster
	 * to a visitor and Article 73 names it - and the condition behind this reason reads the
	 * same rows ({@link TeamApi#WHO_STANDS_IN_A_TEAM} via {@link ATeamHeIsAlreadyIn}), so
	 * naming it reveals nothing the portal does not already answer. That is the line
	 * {@link PairWriteApi}'s {@code A_PAIR_ALREADY_HOLDS} draws for the same reason. A member
	 * whose fee has lapsed never reaches it: he is 404 one statement earlier, so the
	 * difference between these answers over consecutive numbers says nothing about who has
	 * paid.
	 */
	static final String HE_IS_ALREADY_IN_A_TEAM = "heIsAlreadyInATeam";

	/**
	 * HE HAS A QUESTION STANDING ALREADY, AND FOR AN APPLICATION THAT IS ACROSS EVERY TEAM.
	 *
	 * <p>PDL.md ("Prijava ne može da se umnoži"): „**Prijava ne može da se umnoži.**
	 * „Prijavi se u tim" se crta
	 * samo kad član nema nijednu prijavu u letu, **traženo po broju člana kroz sve timove**,
	 * pa ih nikad nema dve." <b>That is stricter than the schema and deliberately so:</b>
	 * {@code team_application_asked_once} is over {@code (competitor_id, team_id, season)}, so
	 * the database would happily store one member's applications to three teams at once. The
	 * argument for why stricter is allowed is {@link PairWriteApi}'s {@code DERIVED 3} word
	 * for word - every row this refuses is one the screen would never have sent and one no
	 * recorded decision asks for - and <b>the cost is named rather than discovered: that
	 * unique key is never reached through this route at all.</b>
	 *
	 * <p>He can see his own standing question on {@code /api/me/applications}, so the reason
	 * tells him nothing new.
	 */
	static final String A_QUESTION_ALREADY_STANDS = "aQuestionAlreadyStands";

	/**
	 * THIS TEAM HAS ALREADY ASKED THIS MEMBER, IN ANY SEASON.
	 *
	 * <p>PDL.md ("Isti tim ne poziva istog čoveka dvaput"): „**[IZVEDENO] Isti tim ne
	 * poziva istog čoveka dvaput.** Prijava
	 * se šalje jednom i dok čeka na njenom mestu stoji način da se povuče; poziv je isti
	 * zapis, pa dok stoji, na njegovom mestu stoji da je poslat. Bez toga jedan tim može da
	 * napuni tuđe sanduče istim pitanjem." <b>Stricter than the schema again, and along a
	 * different axis:</b> {@code team_invitation_sent_once} is per SEASON, so a team could
	 * ask the same man once for 2028 and again for 2029 while the first still stands. The
	 * condition here carries no season, and the cost is the same one named above - that key
	 * is not reached through this route.
	 *
	 * <p><b>And the other side of it is the reason the owner asked for a withdrawal at
	 * all:</b> once the question is taken back there is nothing standing, and the next
	 * invitation to the same man passes.
	 */
	static final String HE_HAS_ALREADY_BEEN_ASKED = "heHasAlreadyBeenAsked";

	/**
	 * WHAT A TEAM READS WHEN THE MAN IT ASKED HAS GONE SOMEWHERE ELSE.
	 *
	 * <p>{@code teams.inviteMissedSubject} in {@code frontend/src/i18n/sr.json}, which takes no
	 * value at all - so it is a constant here while the other seven are methods.
	 */
	static final String THE_INVITATION_WAS_MISSED = "Poziv u tim je ostao bez odgovora";

	/**
	 * WHO THE PORTAL IS WHEN IT WRITES TO A MEMBER ITSELF, ASKED OF THE ONE PLACE THAT
	 * ALREADY ANSWERS IT.
	 *
	 * <p>PDL P13, 19.09.2026, the owner choosing between three offered answers: the sender is
	 * the name of the league. It is read off {@link PairWriteApi#THE_LEAGUE} rather than
	 * spelt again, because that field's own note already records that this fact has two homes
	 * on this server - {@link VerificationWriteApi} signs with „Verifikacija" - and a third
	 * would make the drift harder to see rather than easier.
	 *
	 * <p><b>The team is named in the sentence and not in the sender</b>, which is the
	 * dictionary's own arrangement: {@code teams.inviteBody} is „Tim „{team}" te poziva...",
	 * so who is asking is inside what the member reads, and the message is still one the
	 * portal wrote.
	 */
	private static final String THE_LEAGUE = PairWriteApi.THE_LEAGUE;

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	private final ATeamHeIsAlreadyIn alreadyInATeam;

	private final Clock clock;

	/**
	 * Written by hand rather than left on the methods, the same choice every writing route on
	 * this server made: an answer is a membership, a question that goes and up to two
	 * messages, and a request that stopped between them would leave a member in a team
	 * nobody told him about, or a question answered twice.
	 */
	private final TransactionTemplate inOneTransaction;

	TeamJoiningWriteApi(JdbcClient db, MemberOfAccount memberOfAccount,
			ATeamHeIsAlreadyIn alreadyInATeam, Clock clock, TransactionTemplate inOneTransaction) {

		this.db = db;
		this.memberOfAccount = memberOfAccount;
		this.alreadyInATeam = alreadyInATeam;
		this.clock = clock;
		this.inOneTransaction = inOneTransaction;
	}

	/**
	 * WHOM TO ASK IN, named by the number printed on his card.
	 *
	 * <p>The number and not a key, which is the spelling every other answer about a member
	 * uses ({@link PairApi}, {@link MyApplicationsApi}) and the one the screen has in its
	 * hand, since „Pozovi u tim" is drawn on his profile and a profile answers at
	 * {@code /sr/takmicar/000127-...}.
	 *
	 * <p>There is no {@code season}: which season a membership begins in is decided on the
	 * day of the ANSWER, and a field on the question would be a second answer to it.
	 */
	record Asked(String memberNumber) {
	}

	/**
	 * „Prihvati" or „Odbij", which are the two buttons PDL P13 puts under both questions.
	 *
	 * @param accepted boxed on purpose: a body that names no answer at all is a form that was
	 *                 not filled in, and a primitive would read it as „Odbij" and close
	 *                 somebody's question for him
	 */
	record Answered(Boolean accepted) {
	}

	/** Why a question could not be asked, answered or taken back. */
	record Refused(String reason) {
	}

	/**
	 * @param id     the application now standing, which the caller cannot know until it comes
	 *               back
	 * @param teamId which team it really asks, READ BACK OFF THE ROW rather than echoed from
	 *               the path: the answer is then a claim about the table instead of about the
	 *               request
	 */
	record AnApplication(long id, long teamId) {
	}

	/**
	 * @param memberNumber whom the stored question really reaches, read back off the row for
	 *                     the reason {@link PairWriteApi.Asking} gives: it was asked by
	 *                     number and is stored by key, so this is the one thing that says the
	 *                     two agree
	 */
	record AnInvitation(long id, String memberNumber) {
	}

	/**
	 * AN APPLICATION THE TEAM MAY REALLY DECIDE, seen from the side of whoever leads it.
	 *
	 * @param applicant     whose it is, needed for the membership and for the message
	 * @param applicantName his name as {@code teams.inviteMissedBody} names him, read in the
	 *                      same statement as everything else so that the name written into a
	 *                      message cannot be one from after the row was gone
	 */
	private record TheApplication(long id, long applicant, String applicantName, String teamName) {
	}

	/** An invitation the member it names may really answer. */
	private record TheInvitation(long id, String teamName, String hisName) {
	}

	/**
	 * A MEMBER ASKING A TEAM TO TAKE HIM, WHICH WRITES NO MEMBERSHIP AND TELLS NOBODY.
	 *
	 * <p>PDL.md ("„Prijavi se u tim" stoji na strani tima"):
	 * „**[ODLUKA 05.09.2026] „Prijavi se u tim" stoji na strani
	 * tima.**" and PDL.md ("Vidi ga član koji nema tim, i samo u prelaznom roku"):
	 * „**Vidi ga član koji nema tim, i samo u prelaznom roku**
	 * (1.10-31.12)."
	 *
	 * <p><b>Three refusals are one empty 404 and that is {@link TeamWriteApi#propose}'s
	 * decision arriving at the second door of one rule.</b> An account naming no member, a
	 * member who already has a team and a shut window are told the same nothing, because the
	 * owner deleted the sentence that used to explain the second of them on 05.09.2026 -
	 * „adresa koju član ne sme da otvori nije strana sa objašnjenjem nego adresa koje za njega
	 * nema" - and the portal's own screen treats the last two as „the same rule read twice".
	 * A member whose fee has lapsed is in the same bucket, by the decision of 19.09.2026.
	 *
	 * <p><b>A team with nobody to answer for it is in that bucket too, and it is the one
	 * refusal here that is about the team rather than the caller.</b> PDL.md
 * ("Tim koji nema nijednog člana ne dobija poruku"):
	 * „**[IZVEDENO] Tim koji nema nijednog člana ne dobija poruku, jer nema kome. Isti razlog
	 * iz kog se takvom timu ne nudi ni prijava.**" Left in, the application would stand for
	 * ever with nobody able to decide it, which is exactly the fault the owner's entry of
	 * 06.09.2026 describes: „prijava koju niko ne može da odgovori čekala je zauvek i držala
	 * člana van svih timova."
	 */
	@PostMapping("/api/teams/{id}/applications")
	ResponseEntity<?> apply(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@PathVariable long id) {

		Long me = memberOfAccount.competitorId(asking.account());

		if (me == null) {
			return away();
		}

		return inOneTransaction.execute(committing -> asking(me, id));
	}

	private ResponseEntity<?> asking(long me, long team) {
		ZonedDateTime now = ZonedDateTime.now(clock);

		/* THE FEE FIRST, because `JoiningATeam` does not ask it and says so: „Whether a
		   member has paid is the service layer's question, and it is still open." */
		if (!heIsStillAMember(me)) {
			return away();
		}

		/* AND THE TWO QUESTIONS `JoiningATeam` DOES ANSWER, asked of the one place that holds
		   them rather than as a month and a query written here. Which of the two refused him
		   is not told apart, for the reason written on this method. */
		if (JoiningATeam.mayJoin(alreadyInATeam.everyOneHeHasHad(me), now) != JoiningATeam.Answer.YES) {
			return away();
		}

		if (!somebodyCouldAnswerForThisTeam(team)) {
			return away();
		}

		if (aQuestionOfHisAlreadyStands(me)) {
			return no(HttpStatus.CONFLICT, A_QUESTION_ALREADY_STANDS);
		}

		long application = db.sql("insert into team_application (competitor_id, team_id, season)"
						+ " values (?, ?, ?) returning id")
				.params(me, team, SeasonClock.transfersTakeEffect(now))
				.query(Long.class)
				.single();

		/* NOBODY IS WRITTEN TO, and the class note says which decision that is: the
		   application stands on the team's own page, and the inbox only ever carries the
		   OUTCOME back to the member. */
		return ResponseEntity.status(HttpStatus.CREATED)
				.body(new AnApplication(application, teamOfApplication(application)));
	}

	/**
	 * THE TEAM'S ANSWER TO AN APPLICATION, WHICH ONLY WHOEVER LEADS IT MAY GIVE.
	 *
	 * <p>PDL.md ("Prijavu u tim odobrava administrator tog tima"), above. Who leads it is
	 * {@link TeamApi#WHO_ADMINISTERS_IT} - the
	 * founder while he is still standing in it, otherwise whoever has been in it longest, the
	 * tie broken by the smaller member number - asked of that constant and never written out
	 * here, because {@code GET /api/teams} answers the same question to the team's own page as
	 * {@code administeredByMe} and two answers to it is the fault the journal calls „dva doma
	 * jedne činjenice".
	 *
	 * <p><b>404 for five callers at once</b> (ADL A8): an application that is not there, one
	 * belonging to another team, a caller who is in the team but does not lead it, a caller
	 * who has nothing to do with it, and an account naming no member. Told apart, the keys
	 * would answer which applications exist and who runs which team to anybody walking them.
	 *
	 * <p><b>AND A SIXTH, WHICH IS A DECISION RATHER THAN A CONSEQUENCE.</b>
	 * PDL.md ("Prijava člana koji je u međuvremenu dobio tim se timu ne prikazuje"):
	 * „**[ODLUKA 06.09.2026] Prijava člana koji je u međuvremenu dobio
	 * tim se timu ne prikazuje.** Prikazana, „Primi u tim" bi ga izvukla iz tog tima bez
	 * ijednog pitanja, a P13 to zabranjuje svuda drugde. **Isto važi i za člana koga je
	 * administracija obrisala.**" So an applicant who has since got a team, or whose fee has
	 * since lapsed, is not visible to this route at all - <b>for refusing as much as for
	 * accepting</b>, which is what „se timu ne prikazuje" says and is the safe direction: the
	 * row simply waits for him, and PDL.md ("ostaje njegova da je povuče") keeps that end
	 * in his hands - „Prijava
	 * u oba slučaja ostaje njegova da je povuče."
	 */
	@PutMapping(path = "/api/teams/{id}/applications/{application}",
			consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<?> decide(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@PathVariable long id, @PathVariable long application, @RequestBody Answered typed) {

		Long me = memberOfAccount.competitorId(asking.account());

		if (me == null) {
			return away();
		}

		if (typed.accepted() == null) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		return inOneTransaction.execute(committing -> deciding(me, id, application, typed.accepted()));
	}

	private ResponseEntity<?> deciding(long me, long team, long application, boolean accepted) {
		Optional<TheApplication> his = applicationHeMayDecide(me, team, application);

		if (his.isEmpty()) {
			return away();
		}

		ZonedDateTime now = ZonedDateTime.now(clock);

		/* THE APPLICANT MAY HAVE GOT A TEAM BETWEEN THE QUESTION AND THIS ANSWER, which is
		   the decision of 06.09.2026 on this method and is asked in Java so that
		   `Membership.standsInTheWayOfJoiningIn` stays the one home of the rule. */
		if (alreadyInATeam.standsInHisWay(his.get().applicant(), now)) {
			return away();
		}

		if (!accepted) {
			/* „Odbij", AND IT IS NOT BOUND BY THE WINDOW (PDL.md, "traži prelazni rok"): it
			   writes nothing
			   about a squad and only ends the question. */
			theApplicationIsOver(application);
			tell(his.get().applicant(), theApplicationWasRefusedReads(his.get().teamName()),
					theRefusalReads(his.get().teamName()));

			return ResponseEntity.noContent().build();
		}

		if (!SeasonClock.transferWindowOpen(now)) {
			return no(HttpStatus.CONFLICT, THE_WINDOW_IS_SHUT);
		}

		takeHimIn(his.get().applicant(), team, now);
		theApplicationIsOver(application);

		tell(his.get().applicant(), heIsInTheTeamReads(his.get().teamName()),
				theSeasonHeRunsFromReads(his.get().teamName()));

		theOtherTeamsThatAskedHim(his.get().applicant(), team, his.get().applicantName(),
				his.get().teamName());

		return ResponseEntity.noContent().build();
	}

	/**
	 * A MEMBER TAKING HIS OWN APPLICATION BACK, WHICH DEPENDS ON NOBODY.
	 *
	 * <p>PDL.md ("ostaje njegova da je povuče"): „**[IZVEDENO] Prijava u oba slučaja ostaje
	 * njegova da je
	 * povuče**, pa i dalje ima kraj koji ne zavisi ni od koga drugog." „Oba slučaja" are the
	 * two the decision above it names - an applicant who has since got a team and one the
	 * administration has deleted - so this is the one road that is open when the team's own is
	 * shut, and it carries no window for the same reason „Odbij" carries none.
	 *
	 * <p><b>404 for four callers:</b> an application that is not there, one that is not his,
	 * one belonging to another team, and an account naming no member.
	 */
	@DeleteMapping("/api/teams/{id}/applications/{application}")
	ResponseEntity<?> withdraw(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@PathVariable long id, @PathVariable long application) {

		Long me = memberOfAccount.competitorId(asking.account());

		if (me == null) {
			return away();
		}

		return inOneTransaction.execute(committing -> withdrawing(me, id, application));
	}

	private ResponseEntity<?> withdrawing(long me, long team, long application) {
		boolean his = db.sql("select exists(select 1 from team_application a"
						+ " join competitor c on c.id = a.competitor_id"
						+ " where a.id = ? and a.team_id = ? and a.competitor_id = ? and c.active)")
				.params(application, team, me)
				.query(Boolean.class)
				.single();

		if (!his) {
			return away();
		}

		theApplicationIsOver(application);

		return ResponseEntity.noContent().build();
	}

	/**
	 * A TEAM ASKING SOMEBODY IN, AND ONLY WHOEVER LEADS IT MAY ASK.
	 *
	 * <p>PDL.md ("samo administrator tog tima"), quoted in full on this class: „Poziv u tim
	 * salje **samo
	 * administrator tog tima**", the owner's decision of 27.09.2026 taken off Article 53 of the
	 * rulebook and overturning his own of 05.09.2026. <b>A member who merely stands in the team
	 * is answered 404 here</b>, and the same man is answered 404 by {@link #decide} - which is
	 * no longer a difference between the two directions but one rule read twice.
	 *
	 * <p>Who leads it is {@link #heAdministersThisTeam}, which is
	 * {@link TeamApi#WHO_ADMINISTERS_IT} over {@link TeamApi#WHO_STANDS_IN_A_TEAM} and nothing
	 * written here: the roster carries the fee and the member number as well as the open
	 * membership, so a lapsed administrator invites nobody and the title has already passed on
	 * to whoever has been in the team longest.
	 *
	 * <p><b>The order of the refusals is not interchangeable and it is
	 * {@link TeamWriteApi#leave}'s own reason.</b> Whether he leads this team is answered
	 * BEFORE the window, „because a caller this address is not for must be told the same thing
	 * on every day of the year: told „the window is shut" in June, an address he has no
	 * business at would have answered a question about somebody else's team." Swapped, the 409
	 * would be an oracle for which teams exist and who is in them.
	 *
	 * <p><b>And the window is answered before the member number is resolved</b>, which is the
	 * same rule pointing at the invitee: on a day nothing may be written, no request learns
	 * anything at all about who carries which number.
	 */
	@PostMapping(path = "/api/teams/{id}/invitations", consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<?> invite(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@PathVariable long id, @RequestBody Asked typed) {

		Long me = memberOfAccount.competitorId(asking.account());

		if (me == null) {
			return away();
		}

		if (isNothing(typed.memberNumber())) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		return inOneTransaction.execute(
				committing -> inviting(me, id, typed.memberNumber().strip()));
	}

	private ResponseEntity<?> inviting(long me, long team, String memberNumber) {
		if (!heAdministersThisTeam(me, team)) {
			return away();
		}

		ZonedDateTime now = ZonedDateTime.now(clock);

		if (!SeasonClock.transferWindowOpen(now)) {
			return no(HttpStatus.CONFLICT, THE_WINDOW_IS_SHUT);
		}

		Optional<Long> him = memberNumbered(memberNumber);

		/* THREE PEOPLE GET THIS ONE ANSWER: nobody of that number, a number whose member has
		   not renewed, and himself. None of them is a form filled in wrongly and the screen
		   offers none of them, so all three are one address that is not there for him. The
		   lapsed one is HERE and not below, which is PDL's rule of 13.09.2026 as
		   `PairWriteApi.halfNumbered` explains it: told apart, the difference between two
		   answers over consecutive numbers would be a list of who has not paid. */
		if (him.isEmpty() || him.get() == me) {
			return away();
		}

		if (alreadyInATeam.standsInHisWay(him.get(), now)) {
			return no(HttpStatus.CONFLICT, HE_IS_ALREADY_IN_A_TEAM);
		}

		if (thisTeamHasAskedHim(team, him.get())) {
			return no(HttpStatus.CONFLICT, HE_HAS_ALREADY_BEEN_ASKED);
		}

		long invitation = db.sql("insert into team_invitation (team_id, competitor_id, season)"
						+ " values (?, ?, ?) returning id")
				.params(team, him.get(), SeasonClock.transfersTakeEffect(now))
				.query(Long.class)
				.single();

		/* AND IT ARRIVES AS A QUESTION IN HIS INBOX, which is what `message.team_invitation_id`
		   was built for (V13: „the two things a message can ask a question about, which is
		   what puts two buttons under it instead of none") and what PDL asks for in as many
		   words: „Poziv stiže kao poruka u sanduče, sa „Prihvati" i „Odbij"." */
		String named = nameOfTeam(team);

		db.sql("insert into message (to_id, from_id, from_name, subject, body, team_invitation_id)"
						+ " values (?, null, ?, ?, ?, ?)")
				.params(him.get(), THE_LEAGUE, theInvitationReads(named),
						theInvitationBodyReads(named), invitation)
				.update();

		return ResponseEntity.status(HttpStatus.CREATED)
				.body(new AnInvitation(invitation, whoWasAsked(invitation)));
	}

	/**
	 * THE MEMBER'S ANSWER TO AN INVITATION, WHICH ONLY HE MAY GIVE.
	 *
	 * <p>PDL.md ("Poziv u tim prihvata pozvani član"): „Niko ne sme da upiše promenu koja se
	 * tiče drugog čoveka bez
	 * njegove reči, pa ni član tima koji poziva." One statement asks both halves of „is this
	 * invitation his", so there is no moment at which the row is in hand and the answer still
	 * depends on who is asking.
	 *
	 * <p><b>„Prihvati" needs the window and „Odbij" does not</b>
	 * (PDL.md ("traži prelazni rok")), and
	 * an invitation asked outside it is not lost: „**Poziv van roka čeka, ne propada.** Poruka
	 * ostaje i kaže da poziv čeka; 1. oktobra se dugme vraća samo od sebe."
	 *
	 * <p><b>Accepting is refused when he has meanwhile got a team</b>
	 * (PDL.md ("Poziv se ne pamti kao odgovoren")), and that refusal names it, because his
	 * own squad is public and
	 * the sentence is about himself.
	 */
	@PutMapping(path = "/api/teams/{id}/invitations/{invitation}",
			consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<?> answer(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@PathVariable long id, @PathVariable long invitation, @RequestBody Answered typed) {

		Long me = memberOfAccount.competitorId(asking.account());

		if (me == null) {
			return away();
		}

		if (typed.accepted() == null) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		return inOneTransaction.execute(
				committing -> answering(me, id, invitation, typed.accepted()));
	}

	private ResponseEntity<?> answering(long me, long team, long invitation, boolean accepted) {
		Optional<TheInvitation> his = invitationHeMayAnswer(me, team, invitation);

		if (his.isEmpty()) {
			return away();
		}

		if (!accepted) {
			/* „Odbij", and nothing else is remembered and nobody is told: the class note says
			   which sentence does not exist and why one is not invented here. */
			theInvitationIsOver(invitation);

			return ResponseEntity.noContent().build();
		}

		ZonedDateTime now = ZonedDateTime.now(clock);

		if (!SeasonClock.transferWindowOpen(now)) {
			return no(HttpStatus.CONFLICT, THE_WINDOW_IS_SHUT);
		}

		if (alreadyInATeam.standsInHisWay(me, now)) {
			return no(HttpStatus.CONFLICT, HE_IS_ALREADY_IN_A_TEAM);
		}

		takeHimIn(me, team, now);
		theInvitationIsOver(invitation);

		theOtherTeamsThatAskedHim(me, team, his.get().hisName(), his.get().teamName());

		return ResponseEntity.noContent().build();
	}

	/**
	 * A TEAM TAKING ITS OWN INVITATION BACK, WHICH ONLY WHOEVER LEADS IT MAY DO.
	 *
	 * <p><b>Owner, 27.09.2026, in as many words: „Hoću da može da povuče poziv."</b> Until
	 * that day nothing was recorded either way, and the boundary was going to be written down
	 * as an absence.
	 *
	 * <p><b>And it is the administrator's alone, which is recorded rather than reasoned out
	 * here.</b> PDL.md ("Povlacenje poziva takodje sme samo administrator"):
	 * „**[IZVEDENO, ne pitano] Povlacenje poziva takodje sme
	 * samo administrator.** Pravo da se poziv povuce prati pravo da se posalje; da ga zadrzi
	 * bilo koji clan, tim bi mogao da ponisti odluku coveka koji je jedini smeo da je donese."
	 * The journal marks it as derived from the decision above rather than as a sentence of his,
	 * and it is asked of {@link #heAdministersThisTeam} - the same reading {@link #invite} and
	 * {@link #decide} use, so the three cannot drift.
	 *
	 * <p><b>Nothing here reads WHO SENT the invitation, and there is no column that could.</b>
	 * {@code team_invitation} records no sender on purpose: PDL.md
	 * ("Poruka ide onome ko vodi tim u trenutku slanja") sends the
	 * outcome „onome ko vodi tim u trenutku odgovora... ne onome ko je poziv poslao". Under the
	 * decision of 27.09.2026 the one who sends and the one who takes back are the same SEAT,
	 * but not always the same PERSON - the title passes when somebody leaves - so what is asked
	 * is the seat and never a memory of who typed.
	 *
	 * <p><b>No window</b>, for the reason „Odbij" has none: it writes nothing about a squad.
	 * A team that asked the wrong man must not wait until October to undo it, which is the
	 * whole of what the owner asked for.
	 *
	 * <p><b>The invited member is not told</b>, and that is an absence of a decision rather
	 * than a choice: no sentence for it exists in the dictionary or in PDL. <b>What he keeps
	 * is the message itself</b>, by {@link #closed} - see the class note for the constraint
	 * that would otherwise have taken it out of his inbox, and the owner's decision that it
	 * must not.
	 *
	 * <p><b>404 for five callers:</b> an invitation that is not there, one belonging to another
	 * team, a member of that team who does not lead it, a caller who has nothing to do with it -
	 * the invited member included, whose road out is „Odbij" and not this one - and an account
	 * naming no member.
	 */
	@DeleteMapping("/api/teams/{id}/invitations/{invitation}")
	ResponseEntity<?> takeBack(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@PathVariable long id, @PathVariable long invitation) {

		Long me = memberOfAccount.competitorId(asking.account());

		if (me == null) {
			return away();
		}

		return inOneTransaction.execute(committing -> takingBack(me, id, invitation));
	}

	private ResponseEntity<?> takingBack(long me, long team, long invitation) {
		if (!heAdministersThisTeam(me, team)) {
			return away();
		}

		boolean itIsTheirs = db.sql("select exists(select 1 from team_invitation"
						+ " where id = ? and team_id = ?)")
				.params(invitation, team)
				.query(Boolean.class)
				.single();

		if (!itIsTheirs) {
			return away();
		}

		theInvitationIsOver(invitation);

		return ResponseEntity.noContent().build();
	}

	/**
	 * THE MEMBERSHIP, AND THE SEASON IN IT IS THE ONE THING THIS INCREMENT HAD TO DECIDE.
	 *
	 * <p>{@link SeasonClock#transfersTakeEffect} read on the day of the answer, never the
	 * season standing on the question: see the class note for what that column claims, why it
	 * is false about this portal and where it was measured. It is the same method
	 * {@link VerificationWriteApi} reads when a moderator approves a team, so the two roads
	 * into {@code team_membership} write one number.
	 *
	 * <p>{@code season_to} and {@code left_reason} are left out rather than sent as nulls,
	 * which is what an open membership is ({@code Membership.open}), and the exclusion
	 * constraint {@code team_membership_one_team_at_a_time} is the last word behind every
	 * condition this class asks first.
	 */
	private void takeHimIn(long member, long team, ZonedDateTime now) {
		db.sql("insert into team_membership (competitor_id, team_id, season_from)"
						+ " values (?, ?, ?)")
				.params(member, team, SeasonClock.transfersTakeEffect(now))
				.update();
	}

	/**
	 * A QUESTION THAT IS OVER, AND THE MESSAGE THAT CARRIED IT STAYS WHERE IT IS.
	 *
	 * <p>The emptying is not tidiness and the class note has the measurement: V13 makes
	 * {@code message_team_invitation_fk} cascade, so deleting the row would delete the
	 * member's message with it, and the owner decided on 06.09.2026 that a message in
	 * somebody's inbox is not deleted - „brisanje poruke iz tuđeg sandučeta je brisanje
	 * istorije". Emptied first, the message stays and stops being a question, which is exactly
	 * what V13's own note asks for („the row would offer a button that does nothing").
	 *
	 */
	private void theInvitationIsOver(long invitation) {
		db.sql("update message set team_invitation_id = null where team_invitation_id = ?")
				.param(invitation)
				.update();

		db.sql("delete from team_invitation where id = ?").param(invitation).update();
	}

	/**
	 * AND AN APPLICATION THAT IS OVER, WHICH NEEDS NO SUCH CARE AND SAYS SO.
	 *
	 * <p>{@code message} has no column pointing at an application at all - V13 gave it two
	 * pointers and neither is this one - because an application was never a letter to anybody:
	 * the owner moved it off the inbox on 06.09.2026 precisely so that a role rather than a
	 * person would decide it. So there is nothing to empty first and no cascade to outrun.
	 */
	private void theApplicationIsOver(long application) {
		db.sql("delete from team_application where id = ?").param(application).update();
	}

	/**
	 * THE TEAMS WHOSE INVITATION HE HAS JUST MADE UNANSWERABLE, AND EACH IS TOLD ONCE.
	 *
	 * <p>PDL.md ("Tim čiji je poziv ostao neodgovoren dobija poruku u sandučetu"):
	 * „**[ODLUKA 06.09.2026] Tim čiji je poziv ostao neodgovoren
	 * dobija poruku u sandučetu portala.** Vlasnik: „Administratori timova dobijaju poruku u
	 * tome u inbox portala."" And three derivations the owner's own entry draws beside it,
	 * each of which is a condition here:
	 *
	 * <ul>
	 * <li><b>To whoever leads the team, not to whoever sent the invitation</b>
	 * (PDL.md ("Poruka ide onome ko vodi tim u trenutku slanja")), „računato iz rostera
	 * tada", which is
	 * {@link TeamApi#WHO_ADMINISTERS_IT} asked now.
	 * <li><b>Not to the team he joined</b> (PDL.md ("doneo odluku ili je njegov poziv
	 * prihvaćen")): „Taj je sam doneo odluku ili
	 * je njegov poziv prihvaćen, pa mu se ne javlja ono što već zna."
	 * <li><b>Not to a team with nobody in it</b>, „jer nema kome" - which is a null leader
	 * here, and the row is left out rather than written to nobody. V13 makes a message with
	 * no addressee a message to the WHOLE LEAGUE, so the guard is that nothing is written at
	 * all, exactly as {@link VerificationWriteApi} guards its own.
	 * </ul>
	 *
	 * <p><b>The rows themselves are not touched</b>
	 * (PDL.md ("Poziv se ne pamti kao odgovoren")), so what those
	 * teams keep is their question and what they get is the news. One row per TEAM and not per
	 * invitation: a team may hold one for 2028 and another for 2029, which the schema allows
	 * even though this class refuses to write the second, and two identical lines in one inbox
	 * would be the same news twice.
	 */
	private void theOtherTeamsThatAskedHim(long member, long joined, String hisName,
			String joinedTeam) {

		List<Long> leaders = db.sql("with standing as (" + TeamApi.WHO_STANDS_IN_A_TEAM + ")"
						+ " select leader from ("
						+ " select distinct " + TeamApi.WHO_ADMINISTERS_IT + " as leader"
						+ " from team t"
						+ " join team_invitation i on i.team_id = t.id"
						+ " where i.competitor_id = ? and t.id <> ?"
						+ " ) them where leader is not null")
				.params(member, joined)
				.query(Long.class)
				.list();

		for (long leader : leaders) {
			tell(leader, THE_INVITATION_WAS_MISSED, theMissedInvitationReads(hisName, joinedTeam));
		}
	}

	/**
	 * WHAT THE MEMBER READS WHEN A TEAM TAKES HIM IN.
	 *
	 * <p>{@code teams.joinDoneSubject}, sign for sign, with its one value filled in. The
	 * substitution is the dictionary's own convention - the portal writes {@code {team}} and
	 * its {@code t()} replaces it - and never a formatter, which would be a second convention
	 * for one sentence.
	 */
	static String heIsInTheTeamReads(String team) {
		return "Primljen si u tim „" + team + "\"";
	}

	/** {@code teams.joinDoneBody}. */
	static String theSeasonHeRunsFromReads(String team) {
		return "Od naredne sezone trčiš za tim „" + team + "\".";
	}

	/** {@code teams.joinNoSubject}. */
	static String theApplicationWasRefusedReads(String team) {
		return "Prijava u tim „" + team + "\" nije prihvaćena";
	}

	/** {@code teams.joinNoBody}. */
	static String theRefusalReads(String team) {
		return "Tim „" + team + "\" nije prihvatio tvoju prijavu.";
	}

	/** {@code teams.inviteSubject}. */
	static String theInvitationReads(String team) {
		return "Poziv u tim „" + team + "\"";
	}

	/** {@code teams.inviteBody}. */
	static String theInvitationBodyReads(String team) {
		return "Tim „" + team + "\" te poziva da od naredne sezone trčiš za njih.";
	}

	/**
	 * {@code teams.inviteMissedBody}, whose two values are the member who joined somewhere and
	 * the team he joined - never the team being written to, which is the reading that would
	 * make every one of these letters say the wrong thing.
	 */
	static String theMissedInvitationReads(String name, String team) {
		return name + " je u međuvremenu ušao/la u tim „" + team + "\", pa vaš poziv više ne stoji.";
	}

	/**
	 * THE PORTAL WRITING TO A MEMBER IN ITS OWN NAME, the shape {@link PairWriteApi#tell}
	 * already holds: {@code from_id} empty and {@code from_name} the league, which V13 built
	 * for „a message with a name and no pointer".
	 */
	private void tell(long member, String subject, String body) {
		db.sql("insert into message (to_id, from_id, from_name, subject, body)"
						+ " values (?, null, ?, ?, ?)")
				.params(member, THE_LEAGUE, subject, body)
				.update();
	}

	/**
	 * WHETHER ANYBODY COULD ANSWER FOR THIS TEAM AT ALL, which is false for two different
	 * teams on purpose: one that does not exist, and one nobody stands in.
	 */
	private boolean somebodyCouldAnswerForThisTeam(long team) {
		return db.sql("with standing as (" + TeamApi.WHO_STANDS_IN_A_TEAM + ")"
						+ " select exists(select 1 from team t"
						+ " where t.id = ? and " + TeamApi.WHO_ADMINISTERS_IT + " is not null)")
				.param(team)
				.query(Boolean.class)
				.single();
	}

	/**
	 * WHETHER HE IS THE ONE WHO LEADS THIS TEAM, asked of the portal's one answer to that
	 * question.
	 *
	 * <p><b>It asked whether he merely STOOD in the team until 27.09.2026</b>, which was the
	 * owner's decision of 05.09.2026 and is now his own reversal - see the note on
	 * {@link #invite}. What replaced it is not a new rule: it is
	 * {@link TeamApi#WHO_ADMINISTERS_IT} over {@link TeamApi#WHO_STANDS_IN_A_TEAM}, the same
	 * pair {@link #applicationHeMayDecide} already asks and the same pair
	 * {@code GET /api/teams} answers {@code administeredByMe} from. Three readers of one rule
	 * rather than a second rule, which is what {@link TeamWriteApi} says about being the
	 * second of them.
	 *
	 * <p>Both of its conditions matter and neither is spelt here: the seat is read THROUGH
	 * {@code standing}, so a seat naming somebody who has left or whose fee has lapsed simply
	 * misses it and the title passes on, and the {@code coalesce} makes a team nobody
	 * administers at all FALSE rather than null - the same value the list answers.
	 *
	 * <p><b>WHICH ARM OF THAT RULE THIS SUITE MEASURES, named rather than left to be found, and
	 * it was a mutation that exposed it.</b> Replacing {@link TeamApi#WHO_ADMINISTERS_IT} with
	 * {@code t.admin_id} alone turns ten cases red here - but only because no team in
	 * {@code TeamJoiningWriteApiTest} ever NAMES a seat, so every administrator in it is
	 * resolved by the other arm, „whoever has been in the team longest". The arm that reads a
	 * named {@code admin_id} is exercised where the rule lives: {@code TeamApiTest} sets that
	 * column (its own helper at line 568) and
	 * {@code TeamWriteApiTest.theDeleteRouteAndTheListAgreeOnWhoAdministersEachTeam} asks two
	 * readers of it over one fixture. <b>What keeps the third reader honest is the constant and
	 * not a case per reader:</b> all three read the same string, so a change to the rule moves
	 * them together or fails somewhere.
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
	 * AN APPLICATION THIS CALLER MAY REALLY DECIDE, read as ONE statement of ONE moment.
	 *
	 * <p>Who leads the team, whether the row is that team's, and whether the applicant is
	 * still a member are all in it, so there is no instant at which the row is in hand and the
	 * answer still depends on another reading. The applicant's NAME is read here for the same
	 * reason {@link PairWriteApi} reads a name before it deletes a pair: afterwards there is
	 * no row to read it off.
	 *
	 * <p>The {@code coalesce} is a team nobody administers at all, which is FALSE here rather
	 * than null - the shape {@link TeamWriteApi} uses for the identical comparison.
	 */
	private Optional<TheApplication> applicationHeMayDecide(long me, long team, long application) {
		return db.sql("with standing as (" + TeamApi.WHO_STANDS_IN_A_TEAM + ")"
						+ " select a.id, a.competitor_id, c.first_name || ' ' || c.last_name, t.name"
						+ " from team_application a"
						/* THE TEAM IS JOINED FROM THE PATH AND THE ROW MUST NAME IT, which is
						   the other way round from how this was first written - and a mutation
						   found the difference before any review did. Joined on `a.team_id`, the
						   right below is asked about whoever leads the team the ROW names, so
						   dropping the agreement between the two changed no answer at all: the
						   caller simply failed the right instead, and the case that exists for
						   this axis went on passing for the wrong reason. Anchored here, the
						   right is the PATH team's and the agreement is the only thing keeping
						   an application to somebody else's team from being accepted into
						   this one - which is what `takeHimIn` would write. */
						+ " join team t on t.id = ?"
						+ " join competitor c on c.id = a.competitor_id"
						+ " where a.id = ? and a.team_id = t.id and c.active"
						+ " and coalesce(" + TeamApi.WHO_ADMINISTERS_IT + " = ?, false)")
				.params(team, application, me)
				.query((row, one) -> new TheApplication(row.getLong(1), row.getLong(2),
						row.getString(3), row.getString(4)))
				.optional();
	}

	/**
	 * AN INVITATION THIS CALLER MAY REALLY ANSWER, which is one addressed to him by a team
	 * that still exists, while he is still a member.
	 *
	 * <p>His own name comes back with it because accepting writes to up to two other teams
	 * about him, and reading it afterwards would be reading it from after the row was gone.
	 */
	private Optional<TheInvitation> invitationHeMayAnswer(long me, long team, long invitation) {
		return db.sql("select i.id, t.name, c.first_name || ' ' || c.last_name"
						+ " from team_invitation i"
						+ " join team t on t.id = i.team_id"
						+ " join competitor c on c.id = i.competitor_id"
						+ " where i.id = ? and i.team_id = ? and i.competitor_id = ? and c.active")
				.params(invitation, team, me)
				.query((row, one) -> new TheInvitation(row.getLong(1), row.getString(2),
						row.getString(3)))
				.optional();
	}

	/** Whether he is still a member at all, which is {@link PairWriteApi}'s own condition. */
	private boolean heIsStillAMember(long me) {
		return db.sql("select exists(select 1 from competitor where id = ? and active)")
				.param(me)
				.query(Boolean.class)
				.single();
	}

	/**
	 * Somebody named by the number on his card, and a member whose fee has lapsed is nobody.
	 *
	 * <p>The shape {@link PairWriteApi}'s {@code halfNumbered} holds, for the rule it quotes
	 * at length: „Nijedan javni odgovor ne sme da imenuje člana kome je članarina istekla, NI
	 * POSREDNO" (PDL, 13.09.2026). The whole of what this route's answers carry about him is
	 * his member number, so there is no half answer to give.
	 */
	private Optional<Long> memberNumbered(String memberNumber) {
		return db.sql("select id from competitor where member_number = ? and active")
				.param(memberNumber)
				.query(Long.class)
				.optional();
	}


	/**
	 * Across every team, which is PDL.md ("Prijava ne može da se umnoži") and is stricter
	 * than the schema.
	 */
	private boolean aQuestionOfHisAlreadyStands(long me) {
		return db.sql("select exists(select 1 from team_application where competitor_id = ?)")
				.param(me)
				.query(Boolean.class)
				.single();
	}

	/**
	 * In any season, which is PDL.md ("Isti tim ne poziva istog čoveka dvaput") and is
	 * stricter than the schema.
	 */
	private boolean thisTeamHasAskedHim(long team, long him) {
		return db.sql("select exists(select 1 from team_invitation"
						+ " where team_id = ? and competitor_id = ?)")
				.params(team, him)
				.query(Boolean.class)
				.single();
	}

	/** The team the stored row really names, which is what makes the answer a claim. */
	private long teamOfApplication(long application) {
		return db.sql("select team_id from team_application where id = ?").param(application)
				.query(Long.class).single();
	}

	/** Whom the stored question really reaches, read back off the row. */
	private String whoWasAsked(long invitation) {
		return db.sql("select c.member_number from team_invitation i"
						+ " join competitor c on c.id = i.competitor_id where i.id = ?")
				.param(invitation)
				.query(String.class)
				.single();
	}

	/** The name as the row holds it, which is the one thing a message is a claim about. */
	private String nameOfTeam(long team) {
		return db.sql("select name from team where id = ?").param(team)
				.query(String.class).single();
	}

	/**
	 * Whether a field was filled in at all.
	 *
	 * <p>Absent, empty and a run of spaces are one answer and not three, the list of shapes
	 * {@link RegistrationApi} keeps for the same reason.
	 */
	private static boolean isNothing(String value) {
		return value == null || value.isBlank();
	}

	/**
	 * THE ANSWER FOR SOMEBODY THIS ADDRESS IS NOT FOR, which carries nothing at all.
	 *
	 * <p>The owner's reason of 05.09.2026: „adresa koju član ne sme da otvori nije strana sa
	 * objašnjenjem nego adresa koje za njega nema."
	 */
	private static ResponseEntity<?> away() {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
	}

	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return ResponseEntity.status(status).body(new Refused(reason));
	}
}
