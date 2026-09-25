package com.btl.portal.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Optional;

/**
 * DELETING A MEMBER, WHICH IS THE ONE ADMINISTRATIVE ACT THE OWNER LEFT IN THE PORTAL AFTER
 * HE TOOK THE WHOLE DISCIPLINARY PROCEDURE OUT OF IT.
 *
 * <p>PDL P21, owner, 06.09.2026: „sve u vezi suspenzije se resava van portala, a
 * administrator / moderator nakon odluke samo obrisu clana ako je to odluceno." And PDL P23,
 * owner, 11.08.2026, on what deletion means: „Ne postoje arhivirani takmicari. Ili ce biti
 * skriven profil jer nema aktivno clanstvo, ili ce biti obrisan zauvek sa svim svojim
 * profilom i rezultatima, a na mestima gde se pominje bice anonimizovan."
 *
 * <p><b>ALMOST NONE OF THE DELETING IS IN THIS FILE, AND THAT IS THE DESIGN RATHER THAN AN
 * OMISSION.</b> The schema already sorts every row that points at a member into what is HIS
 * and goes with him ({@code on delete cascade}: his results, his submissions, his payments,
 * his memberships, his pairs, his invitations, his ducats, his messages) and what merely
 * NAMES him and keeps its own existence ({@code on delete set null}: the seat of a team or
 * a league, a comment he wrote, a frozen season's row). One statement here sets all of it
 * going. V23 wrote that sorting down at length and this class is what finally pulls the
 * lever.
 *
 * <p><b>THREE THINGS THE CASCADE CANNOT DO, AND THEY ARE THE WHOLE OF THIS CLASS.</b>
 *
 * <ul>
 * <li><b>The account has to be decided first.</b> {@code account_competitor_fk} is
 * {@code on delete restrict} (V23) - the only key in this schema that guards a person
 * rather than a codebook - and the owner put it there on 14.09.2026 so that anonymising
 * cannot be forgotten: „onaj ko za pola godine bude pisao brisanje morao bi da se SETI da
 * anonimizuje nalog, a da zaboravi, nista ne bi puklo i ime obrisanog coveka bi ostalo u
 * bazi. Ovako je nemoguce zaboraviti, jer baza odbija." So the request says what happens to
 * it, and the two happen in one transaction: „brisanje clana je od tog trenutka UVEK dva
 * koraka" is two DECISIONS, not two doors, and a member left half deleted between two
 * requests is the state the restrict exists to prevent.
 * <li><b>The other half of every racing pair has to be told.</b> The pair rows go by
 * cascade and say nothing to anybody, and PDL P13, 07.09.2026 says the opposite in as many
 * words: „„Raskini" obavestava drugu polovinu. Isto pravilo kao kod prihvatanja: promena
 * pogadja clana koji nista nije pritisnuo, pa se obavestava odmah. Bez toga je portal
 * javljao kroz jedna vrata a cutao kroz druga." Deleting a member is a third door onto the
 * same act.
 * <li><b>A team he was the last of has to go with him</b>, which is
 * {@link ATeamGoesWithItsLastMember} and the owner's decision of 25.09.2026.
 * </ul>
 *
 * <p><b>AND ONE THING THE CASCADE DOES BADLY, WHICH V33 FIXES RATHER THAN THIS CLASS.</b>
 * A key that empties a POINTER cannot empty the NAME beside it, so until 25.09.2026 a
 * deleted member's name went on standing in {@code message.from_name} and
 * {@code event_comment.who}. That is done by a trigger and not here, for the reason the
 * owner gave about the account: an obligation that depends on whoever writes the deletion
 * remembering is not an obligation the portal keeps.
 *
 * <p><b>THE KEY IS THE MEMBER NUMBER, WHICH IS THE KEY {@link CompetitorApi} HANDS OUT.</b>
 * ADL A55's rule, applied: a write at a resource carries the key its read answers with. It
 * costs one thing and it is named rather than discovered - {@code competitor.member_number}
 * is nullable since V16 („a row in {@code competitor} is a PERSON WHO REGISTERED. A MEMBER
 * is a row whose {@code member_number} is there"), so a row that registered and never
 * became a member cannot be reached through this address at all. Nothing has decided what
 * becomes of such a row and this route does not decide it either.
 *
 * <p><b>WHAT IS NOT ASKED HERE, AND ITS ABSENCE IS DELIBERATE: {@code competitor.active}.</b>
 * Almost every other resource reads it, because the owner's rule of 19.09.2026 refuses every
 * action to a member whose fee has lapsed. That rule is about what a MEMBER may do with his
 * own things; this is the administration acting on him, and a member whose fee lapsed is
 * exactly the one an administrator is most likely to be deleting. Read here, the route would
 * serve only members in good standing.
 */
@RestController
class CompetitorWriteApi {

	/**
	 * What the request must say about the account, and the only word it may say today.
	 *
	 * <p>PDL P23, 14.09.2026, names two: „Prvo se odluci sta sa nalogom (anonimizuje se ili
	 * se brise), pa tek onda clan moze da ode." Both are below; one of them is refused, and
	 * {@link #ANONYMISING_IS_NOT_WRITTEN_YET} says why in the place the caller meets it.
	 */
	static final String DELETE_THE_ACCOUNT = "delete";

	/** The other of the owner's two words, accepted by the parser and refused by the route. */
	static final String ANONYMISE_THE_ACCOUNT = "anonymise";

	/**
	 * Nothing was said about the account, or a word nobody decided was.
	 *
	 * <p>The parameter is optional as far as the dispatcher is concerned and required by
	 * this route, which is the difference between a 404 and a sentence: a parameter Spring
	 * itself demands is one of the four near misses {@link NothingIsHereRatherThanAlmost}
	 * turns into „no handler", and an administrator who forgot to say what happens to the
	 * account would be told the address does not exist.
	 */
	static final String THE_ACCOUNT_MUST_BE_DECIDED =
			"Odlučite šta biva sa nalogom pre nego što član ode.";

	/**
	 * The owner's other outcome, which this increment does not carry out.
	 *
	 * <p><b>Refused rather than approximated.</b> Anonymising an account means writing three
	 * columns nobody has decided the shape of: {@code account.email} is NOT NULL, carries a
	 * shape check and a unique index over {@code lower(email)}, and {@code first_name} and
	 * {@code last_name} refuse a blank. Whatever went into them would be a value this server
	 * invented for a person, which is the one thing a deletion must not produce.
	 *
	 * <p><b>And the case it exists for is the case below.</b> The reason the owner kept
	 * anonymising as an outcome at all is the moderator who also races and has one account
	 * for both (PDL P23, 14.09.2026) - and that member is refused by
	 * {@link #THE_ACCOUNT_ADMINISTERS} whatever this parameter says. So the two boundaries
	 * are one boundary seen from two sides, and they open together or not at all.
	 */
	static final String ANONYMISING_IS_NOT_WRITTEN_YET =
			"Anonimizacija naloga još nije napisana; nalog se za sada može samo obrisati.";

	/**
	 * His account administers the portal, so neither outcome fits and the portal says so.
	 *
	 * <p>This is the case that produced the {@code restrict} in the first place (PDL P23,
	 * 14.09.2026): „moderator koji i trci ima JEDAN nalog za oboje. Ako mu se obrise
	 * takmicarski zapis, on i dalje treba da administrira portal." Deleting the account takes
	 * his moderatorship with it; leaving it leaves his name on a row that no longer names
	 * anybody. What the portal should do with him is a question the owner has not answered,
	 * and a route that guessed would answer it by accident.
	 */
	static final String THE_ACCOUNT_ADMINISTERS =
			"Nalog ovog člana administrira portal, pa se član ne može obrisati odavde.";

	/**
	 * WHAT STANDS WHERE HIS NAME STOOD, and it is not invented here.
	 *
	 * <p>ADL A37, owner, 06.09.2026: „Zamenski tekst je <Obrisani clan>, odnosno <Obrisana
	 * clanica>, sa uglastim zagradama." His own words: „Moze da bude <Obrisani clan> ili
	 * clanica npr. Sa sve ovim znakovima okolo."
	 *
	 * <p><b>Why the man's word and never the woman's, in the one place this class writes
	 * it.</b> The message below is addressed to the other half of a racing pair, and a
	 * racing pair is one man and one woman ({@code racing_pair_man_fk},
	 * {@code racing_pair_woman_fk}, V12, both keyed on {@code (id, gender)}). So the half
	 * who is told is never of the same sex as the half who is gone, and which word to use is
	 * decided by the column the recipient is NOT read off. It is derived here rather than
	 * read, because after the deletion there is no row left to read a gender from and before
	 * it the message has not been written; {@link #partnersOf} answers the pairs and the
	 * schema answers the sex.
	 *
	 * <p><b>The same two words are also written by the trigger in V33</b>, which has
	 * {@code old.gender} in its hand and picks between them. Two homes for one pair of
	 * words, and they are named here so the next reader finds the other one.
	 */
	static final String A_DELETED_MAN = "<Obrisani član>";

	/** The other of the pair. See {@link #A_DELETED_MAN}. */
	static final String A_DELETED_WOMAN = "<Obrisana članica>";

	/** The letter {@code competitor.gender} carries for a man ({@code competitor_gender_known}). */
	private static final String A_MAN = "M";

	private final JdbcClient db;

	private final ATeamGoesWithItsLastMember emptyTeams;

	private final TransactionTemplate inOneTransaction;

	CompetitorWriteApi(JdbcClient db, ATeamGoesWithItsLastMember emptyTeams,
			TransactionTemplate inOneTransaction) {

		this.db = db;
		this.emptyTeams = emptyTeams;
		this.inOneTransaction = inOneTransaction;
	}

	record Refused(String reason) {
	}

	/**
	 * The other half of one pair, and the season that pair runs in.
	 *
	 * @param gender the gender of the half who is GOING, which is what decides which of the
	 *               two replacement words the message carries
	 */
	private record Partner(long member, int season, String gender) {
	}

	/**
	 * @param account what happens to his account, {@link #DELETE_THE_ACCOUNT}. Optional as
	 *                far as the dispatcher is concerned and required by the route; see
	 *                {@link #THE_ACCOUNT_MUST_BE_DECIDED}.
	 */
	@DeleteMapping("/api/competitors/{memberNumber}")
	@RightIsNeeded(CompetitorApi.OVER_THE_MEMBERS)
	ResponseEntity<?> remove(@PathVariable String memberNumber,
			@RequestParam(name = "account", required = false) String account) {

		return inOneTransaction.execute(committing -> deleting(memberNumber, account));
	}

	/**
	 * THE DELETING, IN ONE TRANSACTION, because the account going and the member going are
	 * the two halves of one act and the database refuses the second without the first.
	 *
	 * <p>Stopped between them, an administrator would have taken away somebody's login and
	 * left his profile standing, which is neither of the two outcomes PDL P23 allows and is
	 * not a state any screen can draw.
	 *
	 * <p><b>THE ORDER OF THE THREE REFUSALS IS NOT INTERCHANGEABLE.</b>
	 *
	 * <ol>
	 * <li><b>A member who is not there is answered first</b>, the shape
	 * {@link TeamWriteApi#leave} keeps: a key this address has nothing behind gets the same
	 * answer whatever else is wrong with the request.
	 * <li><b>Then what the request SAYS</b>, because a malformed request is answered before
	 * anything is read about its subject. Asked the other way round, an administrator who
	 * forgot the parameter would be told which members administer the portal.
	 * <li><b>And last what the member IS</b>, which is the only one of the three that needs
	 * a second table.
	 * </ol>
	 */
	private ResponseEntity<?> deleting(String memberNumber, String account) {
		Optional<Long> member = memberNumbered(memberNumber);

		if (member.isEmpty()) {
			return away();
		}

		if (ANONYMISE_THE_ACCOUNT.equals(account)) {
			return no(HttpStatus.CONFLICT, ANONYMISING_IS_NOT_WRITTEN_YET);
		}

		if (!DELETE_THE_ACCOUNT.equals(account)) {
			return no(HttpStatus.BAD_REQUEST, THE_ACCOUNT_MUST_BE_DECIDED);
		}

		long gone = member.orElseThrow();

		if (hisAccountAdministers(gone)) {
			return no(HttpStatus.CONFLICT, THE_ACCOUNT_ADMINISTERS);
		}

		/* READ BEFORE THE DELETE AND NEVER AFTER, both of them, and for one reason:
		   `racing_pair` and `team_membership` are `on delete cascade` (V12, V11), so the
		   moment the member goes there is nothing left to read either off. The same
		   sentence `PairWriteApi.end` writes beside its own reading. */
		List<Partner> partners = partnersOf(gone);
		List<Long> teams = emptyTeams.teamsOf(gone);

		/* TOLD BESIDE THE READING THAT FOUND THEM, which is `PairWriteApi.end`'s own
		   arrangement, and it does not matter whether it happens before or after the
		   delete: these rows carry `from_id` null, and V33's trigger rewrites the sender
		   of a message only `where from_id = old.id`. So the one worry this order invites
		   - that the deletion would reach back and rewrite the league's own name out of a
		   message the league has just written - cannot happen, and it is said here because
		   it is the first thing a reader of V33 will wonder about. */
		for (Partner each : partners) {
			tell(each.member(), PairWriteApi.THE_PAIR_IS_BROKEN,
					PairWriteApi.theBrokenPairReads(theNameThatIsGone(each.gender()),
							each.season()));
		}

		/* AND THE ACCOUNT, WHICH THE DATABASE DEMANDS GO FIRST. `account_competitor_fk` is
		   `on delete restrict`, so the statement below fails outright while this row
		   stands. Written the other way round the transaction would roll back and the
		   administrator would read a 500 where the schema was saying something exact. */
		db.sql("delete from account where competitor_id = ?").param(gone).update();

		db.sql("delete from competitor where id = ?").param(gone).update();

		emptyTeams.goIfEmpty(teams);

		return ResponseEntity.noContent().build();
	}

	/**
	 * The member this number belongs to, or nothing.
	 *
	 * <p>Answered as an id and not as a row, because everything below it keys on the id: the
	 * number is public and consecutive, the id is what every foreign key in the schema
	 * points at, and looking each statement up by the number again would be the same
	 * question asked five times and free to be answered differently by the fifth.
	 */
	private Optional<Long> memberNumbered(String memberNumber) {
		return db.sql("select id from competitor where member_number = ?")
				.param(memberNumber)
				.query(Long.class)
				.optional();
	}

	/**
	 * WHETHER HIS ACCOUNT IS ALSO SOMEBODY'S ADMINISTRATIVE STANDING, asked as one question
	 * over both of the things that can carry it.
	 *
	 * <p><b>A role that is not {@code competitor} OR a single ticked box, and the two are
	 * not the same question.</b> {@link ModeratorWriteApi} takes a moderatorship away in two
	 * statements because they can come apart: „The role alone leaves a set of ticks that
	 * come back to life the moment anybody is made a moderator at that key again; the ticks
	 * alone leave a man on the moderators' screen with an empty row." A moderator with every
	 * box removed is still a moderator, and a competitor with a box ticked is a row nobody
	 * meant to write - both are refused, and a condition over one of the two would let the
	 * other through.
	 *
	 * <p><b>The superadmin is inside the first half and needs no name of his own.</b> His
	 * role is not {@code competitor}, which is the whole of what this asks; comparing
	 * against the word {@code superadmin} would be a second home for
	 * {@link com.btl.portal.domain.rights.TheNamedSuperadmin}'s fact.
	 *
	 * <p><b>An account is not required to exist at all.</b> Nothing says a member has one -
	 * {@code account.competitor_id} is nullable and unique, so a member hangs off at most one
	 * account and may hang off none. A member with no account is refused nothing here and the
	 * delete below removes no row.
	 */
	private boolean hisAccountAdministers(long member) {
		return Boolean.TRUE.equals(db.sql("select exists(select 1 from account a"
						+ " join role r on r.id = a.role_id"
						+ " where a.competitor_id = ?"
						+ " and (r.code <> 'competitor'"
						+ "   or exists(select 1 from account_admin_right x"
						+ "      where x.account_id = a.id)))")
				.param(member)
				.query(Boolean.class)
				.single());
	}

	/**
	 * THE OTHER HALF OF EVERY PAIR HE IS IN, WHICH IS NEVER „HIS PAIR" IN THE SINGULAR.
	 *
	 * <p>PDL P13, 07.09.2026: „Od 1. januara clan sme da drzi dva: onaj u kom trci sezonu
	 * koja tece, i onaj napravljen za sledecu." Both go with him, so both halves are told,
	 * and a fixture with one pair cannot tell a route that tells everybody from one that
	 * tells the first.
	 *
	 * <p><b>Both columns, because either of them can be him.</b> {@code racing_pair} stores
	 * the man and the woman in two columns, and a query written off {@code man_id} alone
	 * passes every case whose fixture happens to delete a man. The same sentence
	 * {@link PairWriteApi} writes about its own two columns.
	 *
	 * <p><b>Every season and not only the one being run</b>, which is where this parts
	 * company with {@link PairWriteApi#end}. That route refuses a pair of a season that has
	 * ended, because „par iz sezone koja je prosla se NIKAD ne dira" is about a member
	 * reaching back into a finished season. Nothing here reaches: the rows go because
	 * {@code racing_pair} is {@code on delete cascade} on both halves, which V12 decided long
	 * before this route existed, and they go whatever season they are in. Frozen seasons are
	 * untouched by that, and they are untouched because a frozen season is its own tables
	 * (A37) and not one of them holds a pair.
	 */
	private List<Partner> partnersOf(long member) {
		return db.sql("select case when p.man_id = :me then p.woman_id else p.man_id end,"
						/* AND THE GENDER OF THE ONE WHO IS GOING, read off the column he is
						   NOT in: if he is the man then the woman is told and he is a man.
						   The schema keys each half on `(id, gender)`, so this is the
						   database's own answer and not a join back to a row that is about
						   to disappear. */
						+ " p.season, case when p.man_id = :me then 'M' else 'F' end"
						+ " from racing_pair p"
						+ " where p.man_id = :me or p.woman_id = :me"
						/* SEASON FIRST AND THE KEY LAST, so the order is total and two
						   messages to one member arrive the same way round every time. */
						+ " order by p.season, p.id")
				.param("me", member)
				.query((row, one) -> new Partner(row.getLong(1), row.getInt(2), row.getString(3)))
				.list();
	}

	/** Which of ADL A37's two words stands where his name stood. See {@link #A_DELETED_MAN}. */
	private static String theNameThatIsGone(String gender) {
		return A_MAN.equals(gender) ? A_DELETED_MAN : A_DELETED_WOMAN;
	}

	/**
	 * The portal writing to a member itself, which is {@link PairWriteApi#tell}'s shape and
	 * its constant.
	 *
	 * <p>PDL P13, 19.09.2026, the owner choosing between three offered answers: „Kad portal
	 * sam pise poruku clanu, posiljalac je NAZIV LIGE." So {@code from_id} is empty and
	 * {@code from_name} carries the league, which is the row V13 built for exactly this - „a
	 * message with a name and no pointer".
	 */
	private void tell(long member, String subject, String body) {
		db.sql("insert into message (to_id, from_id, from_name, subject, body)"
						+ " values (?, null, ?, ?, ?)")
				.params(member, PairWriteApi.THE_LEAGUE, subject, body)
				.update();
	}

	/**
	 * THE ANSWER FOR A KEY THIS ADDRESS HAS NOTHING BEHIND.
	 *
	 * <p>Empty, the shape {@link TeamWriteApi} and {@link ModeratorWriteApi} use. ADL A8,
	 * owner, 13.09.2026: a caller who may not do a thing and a caller asking about a thing
	 * that is not there get the same answer, „isti odgovor kao da adresa ne postoji". Here
	 * the right is read at the door by {@link RightIsNeeded}, so what reaches this line is
	 * somebody who MAY delete members asking about a number nobody has.
	 */
	private static ResponseEntity<?> away() {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
	}

	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return ResponseEntity.status(status).body(new Refused(reason));
	}
}
