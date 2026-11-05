package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.ZonedDateTime;
import java.util.concurrent.TimeUnit;

/**
 * A PROFILE WHOSE KEEPING HAS RUN OUT IS DELETED BY ITSELF, AS THE PRIVACY POLICY SAYS IT IS.
 *
 * <p>The Privacy Policy, section 5, as it stands: „Prestanete da budete član | Pet godina od poslednje
 * sezone, pa se profil trajno briše", „Broj ličnog dokumenta i ime oca | Pet godina od poslednje
 * sezone, kao i ostatak profila", and „Nalog nikad nije aktiviran | 12 meseci od otvaranja naloga, ako u
 * međuvremenu nije aktiviran". PDL, 29.10.2026, „Poslovi koje tekst opisuje a portal ih još ne radi
 * sam": they are made in the code and the text stays.
 *
 * <p><b>WHO GOES, TWO WAYS, AND NOBODY ELSE.</b>
 * <ul>
 * <li><b>Five years from the end of his last season.</b> PDL P23, 31.07.2026: „Tih pet godina teče od
 * kraja poslednje sezone u kojoj je članarina bila plaćena", and 05.11.2026, chosen with my
 * recommendation: every season of membership counts, whatever its basis - a payment, an exemption from
 * the fee or the balance. A season counts too when it was cancelled: „Član kome je jedina sezona
 * stornirana briše se pet godina posle kraja te sezone" (PDL 05.11.2026), because a cancellation
 * leaves him his number and a trail of money ({@code membership_change}, V63). The owner decided the
 * case of the ONLY season; that a cancelled season counts the same way beside other seasons is
 * derived from his reason and is mine, and it is the later deletion of the two readings. The end of a
 * season is {@link SeasonClock#racesEnd}, midnight of 1 January in the league's zone.
 * <li><b>Twelve months from the opening of an account that never became a member.</b> PDL 05.11.2026:
 * „nalog koji nikad nije postao član (nema nijednu sezonu članstva ni članski broj) 12 meseci od
 * otvaranja", and in the same decision „Nalog bez potvrđene adrese se briše kao danas (7 do 14
 * dana)", which is {@link UnconfirmedAccountsAreSwept}. So this asks only of a CONFIRMED account, and
 * an unconfirmed one is that class's business whatever it decides about it. The opening is
 * {@code account.created_at} (V72) and, for an account that stood before V72 and has no moment,
 * {@code competitor.health_statement_at}: the registration writes it at the moment the form is sent
 * and the administration's entry at the moment of the entry, and nothing in the portal writes it
 * again, so it is the opening of every account a member stands behind. That is derived and not the
 * owner's words (05.11.2026).
 * <li><b>Never an account that administers the portal</b> (PDL 05.11.2026, „Moderator i administrator
 * portala se ne brišu automatski posle pet godina"), asked of {@link CompetitorWriteApi} as its own
 * deletion asks it.
 * </ul>
 *
 * <p><b>THE BOUNDARIES, NAMED.</b> A member who holds a number and neither a season nor a trail of one
 * is in neither of the two and stays; nothing in the portal writes that state. A member with no
 * account at all is not an account that never became a member, and stays as well.
 *
 * <p><b>WHAT GOES AND WHAT STAYS IS THE ADMINISTRATION'S DELETION</b> ({@link
 * CompetitorWriteApi#takeAwayWithoutAWord}): his account, his profile with his document and his
 * father's name, his results (PDL 05.11.2026, „rezultati odlaze sa profilom"), his ducats („Osvojeni
 * dukati ostaju u trajnom vlasništvu profila, osim u slučaju brisanja istog"), his pairs, a team he was
 * the last of, his picture; and the money stays without his name (V79). His name in a comment and in a
 * message becomes <Obrisani član> or <Obrisana članica>, as for a deletion he asked for (PDL
 * 05.11.2026). Nobody is sent a message, not he beforehand and not a partner of a pair (PDL 05.11.2026,
 * „Brisanje posle pet godina ne šalje poruku nikome").
 *
 * <p><b>AND ONE THING IS NOT THE SAME: HIS NAME STAYS IN THE FROZEN TABLES OF HIS SEASONS.</b> PDL P23
 * („Postoje dva različita slučaja uklanjanja, koja se ne smeju pomešati"): when the keeping runs out
 * „Ime i prezime kao običan tekst, bez linka", and 05.11.2026, only there. The trigger V79 left on
 * {@code competitor} empties {@code who} on every row of {@code season_competitor} and {@code
 * season_league_standing} that still points at him, which is right for a deletion he asked for and
 * stays as it is (ADL, „Posao od 1. januara: tri toka i jedan redosled"). So before the deletion every
 * row of the snapshot lets go of him first: its pointer empties and its name stays, and the trigger
 * then finds nothing that points at him.
 *
 * <p><b>THE TABLES ARE ASKED OF THE CATALOGUE, NEVER LISTED HERE</b> ({@link #LETTING_GO}), by the same
 * ADL decision: every key of a table whose name begins {@code season_} that points at {@code
 * competitor} and is {@code on delete set null}. The last of those three is the question that matters:
 * a key that may empty is a row that is meant to outlive him, and a key that cascades ({@code
 * season_points_at_freeze}, V83) is a row that goes with him and is left to go. A table the snapshot
 * adds tomorrow is covered the day it arrives, by its own declaration.
 *
 * <p><b>ONE MEMBER AT A TIME, EACH IN A TRANSACTION OF ITS OWN, HIS ACCOUNT HELD FIRST AND THEN HIS
 * ROW</b>, and whether he goes is asked again under both holds: {@link UnconfirmedAccountsAreSwept}'s
 * order. A season activated for him in the same instant either commits before the hold, and the
 * question finds it, or waits on the hold on his row - a new {@code membership} row takes a lock on the
 * row it names - and then finds him gone. The walk only says whom to ask.
 *
 * <p><b>Hourly, the first an hour after the process starts</b>, for the reasons {@link
 * ThePicturesFolderIsSwept} gives for its own; a deadline of years is not moved by an hour. Its own
 * trigger and not a step of {@link ASeasonFreezes}: what decides is a condition that is true from a
 * moment on, so the job is idempotent by construction and needs no order with anything else.
 */
@Component
class ProfilesPastTheirKeepingAreDeleted {

	private static final Logger LOG = LoggerFactory.getLogger(ProfilesPastTheirKeepingAreDeleted.class);

	/** „Pet godina od poslednje sezone" (Privacy Policy, section 5; PDL P23). */
	static final int YEARS_KEPT = 5;

	/** „12 meseci od otvaranja naloga" (Privacy Policy, section 5; PDL 05.11.2026). */
	static final int MONTHS_KEPT_NEVER_A_MEMBER = 12;

	/**
	 * Members who may go: {@code :lastSeasonGone} is the latest season whose five years are over, and
	 * {@code :openedBy} the latest opening whose twelve months are. Asked again under the holds, one
	 * member at a time.
	 *
	 * <p>The latest season is the greatest of his seasons of membership and of the seasons his trail
	 * names, and a member with neither has no greatest season: {@code max} of nothing is null, and null
	 * is never at or before anything, so the first branch never reaches somebody who was never a member.
	 */
	private static final String MAY_GO = " from competitor c where"
			+ " ((select max(s.season) from (select season from membership where competitor_id = c.id"
			+ "     union all select season from membership_change where competitor_id = c.id) s)"
			+ "   <= :lastSeasonGone"
			+ "  or (c.member_number is null"
			+ "   and not exists (select 1 from membership m where m.competitor_id = c.id)"
			+ "   and not exists (select 1 from membership_change h where h.competitor_id = c.id)"
			+ "   and exists (select 1 from account a where a.competitor_id = c.id"
			+ "     and a.email_confirmed_at is not null"
			+ "     and coalesce(a.created_at, c.health_statement_at) <= :openedBy)))";

	/**
	 * One statement for each key of a snapshot table that is to let go of a member, written by the
	 * catalogue with every identifier quoted by {@code format('%I')}: the table, every column of the key
	 * set to null (which is what {@code on delete set null} itself would do), and the column of the key
	 * that names {@code competitor.id}, which is what the member is found by. Ordered, so two deletions
	 * take the rows in one order.
	 */
	private static final String LETTING_GO = "select format('update %I set %s where %I = ?', r.relname,"
			+ "   string_agg(format('%I = null', a.attname), ', ' order by a.attnum),"
			+ "   max(a.attname::text) filter (where f.attname = 'id'))"
			+ " from pg_constraint k"
			+ " join pg_class r on r.oid = k.conrelid"
			+ " join pg_namespace n on n.oid = r.relnamespace"
			+ " cross join lateral unnest(k.conkey, k.confkey) as p(col, fcol)"
			+ " join pg_attribute a on a.attrelid = k.conrelid and a.attnum = p.col"
			+ " join pg_attribute f on f.attrelid = k.confrelid and f.attnum = p.fcol"
			+ " where k.contype = 'f' and k.confrelid = 'competitor'::regclass and k.confdeltype = 'n'"
			+ "   and n.nspname = current_schema() and r.relname like 'season\\_%'"
			+ " group by k.oid, k.conname, r.relname"
			+ " order by r.relname, k.conname";

	private final JdbcClient db;

	private final Clock clock;

	private final TransactionTemplate inOneTransaction;

	private final CompetitorWriteApi members;

	ProfilesPastTheirKeepingAreDeleted(JdbcClient db, Clock clock, TransactionTemplate inOneTransaction,
			CompetitorWriteApi members) {
		this.db = db;
		this.clock = clock;
		this.inOneTransaction = inOneTransaction;
		this.members = members;
	}

	@Scheduled(fixedDelay = 1, initialDelay = 1, timeUnit = TimeUnit.HOURS)
	void sweep() {
		ZonedDateTime now = clock.instant().atZone(SeasonClock.ZONE);
		int gone = 0;

		for (long member : db.sql("select c.id" + MAY_GO + " order by c.id")
				.param("lastSeasonGone", lastSeasonGone(now)).param("openedBy", openedBy(now))
				.query(Long.class).list()) {

			if (Boolean.TRUE.equals(inOneTransaction.execute(deciding -> goes(member, now)))) {
				gone++;
			}
		}

		/* A COUNT AND NEVER A NAME, for the reason `UnconfirmedAccountsAreSwept` gives (ADL A12), and
		   nothing at all when nothing went. */
		if (gone > 0) {
			LOG.info("{} profile(s) whose keeping had run out were deleted", gone);
		}
	}

	/**
	 * Whether this member goes, decided under the holds on his account and his row, and his deletion if
	 * he does. Package visible for the case the walk cannot produce in one thread: a member it found who
	 * was given a season before the holds were taken.
	 */
	boolean goes(long member, ZonedDateTime now) {
		db.sql("select id from account where competitor_id = ? for update")
				.param(member).query(Long.class).list();
		db.sql("select id from competitor where id = ? for update")
				.param(member).query(Long.class).list();

		boolean stillMayGo = db.sql("select exists (select 1" + MAY_GO + " and c.id = :member)")
				.param("lastSeasonGone", lastSeasonGone(now)).param("openedBy", openedBy(now))
				.param("member", member)
				.query(Boolean.class).single();

		if (!stillMayGo || members.hisAccountAdministers(member)) {
			return false;
		}

		for (String lettingGo : db.sql(LETTING_GO).query(String.class).list()) {
			db.sql(lettingGo).param(member).update();
		}

		members.takeAwayWithoutAWord(member);

		return true;
	}

	/**
	 * The latest season whose five years are over at {@code now}: the end of a season is
	 * {@link SeasonClock#racesEnd}, and the keeping ends five years after it. Asked of that boundary
	 * rather than of the calendar year, so the day the end of a season moves, this moves with it. The
	 * walk starts at the year of {@code now} in whatever zone it is given, because that year is never
	 * earlier than the answer, which is at least five years before it.
	 */
	static int lastSeasonGone(ZonedDateTime now) {
		int season = now.getYear();

		while (SeasonClock.racesEnd(season).plusYears(YEARS_KEPT).isAfter(now)) {
			season--;
		}

		return season;
	}

	/** The latest opening of an account whose twelve months are over at {@code now}, in the league's zone. */
	static Timestamp openedBy(ZonedDateTime now) {
		return Timestamp.from(now.withZoneSameInstant(SeasonClock.ZONE)
				.minusMonths(MONTHS_KEPT_NEVER_A_MEMBER).toInstant());
	}
}
