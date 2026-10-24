package com.btl.portal.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * A REGISTRATION NOBODY CONFIRMED IN SEVEN DAYS IS DELETED, AND SO IS A MEMBER THE ADMINISTRATION
 * ENTERED WHO SET NO PASSWORD IN SEVEN DAYS.
 *
 * <p>The owner, 23.10.2026 (PDL „Poruka posle potvrde adrese i rok nedovršene registracije"), asked
 * „Moze li link da traje 7 dana, a da se nakon toga briše i cela prijava (nedovršena registracija, oslobađa se mail adresa i sl)?", and chose with my recommendation that
 * the link lasts seven days and that a registration not confirmed in that time is deleted by itself,
 * with no message, leaving the address free for a new registration. He chose too, against my
 * recommendation, that the same holds for a member the administration entered who sets no password
 * in seven days, and with my recommendation the exception: a member who already has a recorded
 * payment or a member number is not deleted, because a number is never handed out twice.
 *
 * <p><b>WHO GOES, IN THE TERMS THE SCHEMA ALREADY HAS.</b> A member whose account has no confirmed
 * address - which is both a registration not confirmed and an entry whose invitation was never
 * spent, because spending it is what confirms the address (PDL 19.09.2026) - when:
 * <ul>
 * <li><b>every link he was ever sent has run out, or fourteen days have passed since his account
 * was written</b>, and he was sent at least one link. The seven days are the life of a link: every
 * letter the portal sends him says „Link važi sedam dana", and a link asked for on the sixth day is
 * another seven days. But no more than fourteen from the registration: the owner chose with my
 * recommendation (PDL 24.10.2026, „Rok nepotvrđene prijave") that a new confirmation gives seven
 * new days and the registration is deleted fourteen days after it at the latest, so that nobody
 * holds somebody else's address taken by asking for a new link every six days. The same for an
 * invitation, fourteen days from the entry, which is derived and not his decision (PDL, IZVEDENO
 * 24.10.2026, „Granica od 14 dana važi i za pozivnicu", from his decision of 23.10.2026 that what
 * holds for a registration holds for the member the administration entered). An account that stood before V72 has no recorded moment and no fourteenth day.
 * An account no link was ever sent to is not a registration and not an invitation - nothing the
 * decision is about - and stays;
 * <li><b>he has no member number and no payment of any state</b>. The owner's exception names the
 * entered member, and it holds for a registration too, for the reason he gave: a number is never
 * handed out twice, and a payment is money somebody sent (accepted 24.10.2026, derived from that
 * reason);
 * <li><b>his account does not administer the portal</b>, asked of {@link CompetitorWriteApi} as the
 * administration's own deletion asks it. A moderator with no member is not a member and is never
 * swept at all: the decision is about a member;
 * <li><b>and he is not one of the accounts that stood unconfirmed the day V72 ran</b>, which are kept
 * seven days from that day. That is derived and not the owner's words (PDL, IZVEDENO 24.10.2026).
 * </ul>
 *
 * <p><b>Confirmed is never swept</b>, and that is a property and not a branch: nothing in the portal
 * empties {@code email_confirmed_at} once it is written.
 *
 * <p><b>THE DELETING IS THE ADMINISTRATION'S OWN</b> ({@link CompetitorWriteApi#takeAway}): his
 * account and him, his pairs' other halves told, a team he was the last of gone, his picture's file.
 * Without a message to him, because the decision says the registration goes with no message.
 *
 * <p><b>ONE MEMBER AT A TIME, EACH IN A TRANSACTION OF ITS OWN, AND HIS ACCOUNT HELD FIRST.</b> The
 * account before anything else is the order every route that touches an account and its links
 * keeps ({@code EmailConfirmationApi.confirm}, {@code PasswordResetApi.reset}, PR 633), so a
 * confirmation in the same instant is either before this - and the question, asked only under the
 * hold, finds him confirmed - or after it, and finds its link gone with the account. The walk itself
 * reads nothing but which unconfirmed accounts name a member; whether one goes is never decided
 * off a list read without the hold.
 *
 * <p><b>Hourly, the first an hour after the process starts</b>, for the reasons
 * {@link ThePicturesFolderIsSwept} gives for its own; seven days are not a deadline an hour moves.
 */
@Component
class UnconfirmedAccountsAreSwept {

	private static final Logger LOG = LoggerFactory.getLogger(UnconfirmedAccountsAreSwept.class);

	/**
	 * Members whose account is unconfirmed and who may go at {@code :now}. Asked only under the hold
	 * on the account, one member at a time: the sweep walks every member whose account is unconfirmed
	 * and lets this decide, so there is no list read without a hold that could be out of date by the
	 * time it is acted on.
	 */
	private static final String MAY_GO = " from competitor c join account a on a.competitor_id = c.id"
			+ " where a.email_confirmed_at is null"
			+ " and c.member_number is null"
			+ " and not exists (select 1 from payment p where p.competitor_id = c.id)"
			+ " and (a.kept_unconfirmed_until is null or a.kept_unconfirmed_until <= :now)"
			+ " and (exists (select 1 from email_verification_token t where t.account_id = a.id)"
			+ "   or exists (select 1 from password_reset_token t where t.account_id = a.id))"
			+ " and ((not exists (select 1 from email_verification_token t"
			+ "     where t.account_id = a.id and t.expires_at > :now)"
			+ "   and not exists (select 1 from password_reset_token t"
			+ "     where t.account_id = a.id and t.used_at is null and t.expires_at > :now))"
			+ "  or a.created_at + make_interval(secs => :atTheLatest) <= :now)";

	/**
	 * Fourteen days from the moment the account was written, and the registration goes whatever its
	 * links say (the owner chose it with my recommendation, PDL 24.10.2026; for an invitation it is
	 * derived, PDL IZVEDENO 24.10.2026).
	 */
	static final Duration AT_THE_LATEST = Duration.ofDays(14);

	private final JdbcClient db;

	private final Clock clock;

	private final TransactionTemplate inOneTransaction;

	private final CompetitorWriteApi members;

	UnconfirmedAccountsAreSwept(JdbcClient db, Clock clock, TransactionTemplate inOneTransaction,
			CompetitorWriteApi members) {
		this.db = db;
		this.clock = clock;
		this.inOneTransaction = inOneTransaction;
		this.members = members;
	}

	@Scheduled(fixedDelay = 1, initialDelay = 1, timeUnit = TimeUnit.HOURS)
	void sweep() {
		OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
		int gone = 0;

		for (long member : db.sql("select a.competitor_id from account a where a.email_confirmed_at is null"
						+ " and a.competitor_id is not null order by a.competitor_id")
				.query(Long.class).list()) {

			if (Boolean.TRUE.equals(inOneTransaction.execute(deciding -> goes(member, now)))) {
				gone++;
			}
		}

		/* A COUNT AND NEVER AN ADDRESS OR A NAME: a log is read by whoever can read the disk, and both
		   are personal data (ADL A12). Nothing is written when nothing went, for the reason
		   `ThePicturesFolderIsSwept` gives about an hourly line saying nothing happened. */
		if (gone > 0) {
			LOG.info("{} unconfirmed account(s) whose links had all run out were deleted", gone);
		}
	}

	/**
	 * Whether this member goes, decided under the hold on his account, and his deletion if he does.
	 * Package visible for the one case that has to reach it without the walk: a member the walk found
	 * unconfirmed and who was confirmed before the hold was taken, which the walk itself cannot
	 * produce in one thread.
	 */
	boolean goes(long member, OffsetDateTime now) {
		db.sql("select id from account where competitor_id = ? for update")
				.param(member).query(Long.class).list();

		boolean stillMayGo = db.sql("select exists (select 1" + MAY_GO + " and c.id = :member)")
				.param("now", now).param("atTheLatest", AT_THE_LATEST.toSeconds()).param("member", member)
				.query(Boolean.class).single();

		if (!stillMayGo || members.hisAccountAdministers(member)) {
			return false;
		}

		members.takeAway(member);

		return true;
	}
}
