package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.token.SecretToken;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.config.FixedDelayTask;
import org.springframework.scheduling.config.ScheduledTask;
import org.springframework.scheduling.config.ScheduledTaskHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHO THE SWEEP DELETES AND WHO IT LEAVES, one state of each against the other.
 *
 * <p>The owner, 23.10.2026 (PDL „Poruka posle potvrde adrese i rok nedovršene registracije"): a
 * registration not confirmed in seven days is deleted, and so is a member the administration
 * entered who set no password in seven days, unless he has a payment or a number; and 24.10.2026,
 * the accounts already standing on the day of deployment are kept seven days from that day.
 *
 * <p><b>The seven days are the life of a link, and the clock is moved across the end of one</b>:
 * a link that runs out an hour from now is the sixth day and twenty third hour of a registration,
 * and the same registration an hour and a second later is gone. Every other state is measured at
 * the moment its link has run out, so the one thing that keeps it is the thing the case names.
 *
 * <p><b>Each case sweeps a member beside the one it keeps</b>, who does go, so „nothing was
 * deleted" can never be the reason a case passes.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class UnconfirmedAccountsAreSweptTest {

	/** A moment the machine is not at, so nothing here reads its own clock by accident. */
	private static final Instant NOW = Instant.parse("2031-03-03T10:00:00Z");

	private static final String A_TOWN_IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate inOneTransaction;

	@Autowired
	private CompetitorWriteApi members;

	@Autowired
	private ObjectProvider<ScheduledTaskHolder> schedulers;

	private int issued;

	@BeforeEach
	void somebodyWhoIsNeverAskedAboutStandsFirst() {
		aMember("prvi@primer.rs", "competitor", true);
	}

	private UnconfirmedAccountsAreSwept sweptAt(Instant at) {
		return new UnconfirmedAccountsAreSwept(db, Clock.fixed(at, ZoneOffset.UTC), inOneTransaction, members);
	}

	/** An unconfirmed account with a member behind it; its key. */
	private long aMember(String email, String role, boolean withAPassword) {
		long member = db.sql("insert into competitor (first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values ('Probni', 'Clan', 'M', date '1990-01-01', " + A_TOWN_IN_SERBIA
						+ ", 2027, true, false, ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.param(String.format("%016x", 0xd31eL * 1000 + ++issued))
				.query(Long.class).single();

		return db.sql("insert into account (first_name, last_name, email, role_id, competitor_id,"
						+ " password_hash) values ('Probni', 'Clan', ?, (select id from role where code = ?),"
						+ " ?, ?) returning id")
				.params(email, role, member, withAPassword ? "{bcrypt}$2a$10$abcdefghijklmnopqrstuv" : null)
				.query(Long.class).single();
	}

	private void aConfirmationLinkEnding(long account, Instant at) {
		db.sql("insert into email_verification_token (account_id, token_hash, expires_at) values (?, ?, ?)")
				.params(account, SecretToken.fresh().hash(), Timestamp.from(at)).update();
	}

	private void anInvitationEnding(long account, Instant at) {
		db.sql("insert into password_reset_token (account_id, token_hash, created_at, expires_at)"
						+ " values (?, ?, ?, ?)")
				.params(account, SecretToken.fresh().hash(), Timestamp.from(at.minus(Duration.ofDays(7))),
						Timestamp.from(at)).update();
	}

	private boolean stands(long account) {
		return db.sql("select count(*) from account where id = ?").param(account).query(Long.class).single() == 1;
	}

	private long memberOf(long account) {
		return db.sql("select competitor_id from account where id = ?").param(account).query(Long.class).single();
	}

	/** A registration whose only link ran out an hour before {@link #NOW}: it goes. */
	private long oneThatGoes() {
		long account = aMember("ide-" + ++issued + "@primer.rs", "competitor", true);

		aConfirmationLinkEnding(account, NOW.minus(Duration.ofHours(1)));

		return account;
	}

	@Test
	void aRegistrationGoesOnlyOnceItsSevenDaysAreOver() {
		long account = aMember("registrovan@primer.rs", "competitor", true);
		long member = memberOf(account);

		aConfirmationLinkEnding(account, NOW.plus(Duration.ofHours(1)));

		sweptAt(NOW).sweep();

		assertThat(stands(account)).as("deleted on the sixth day and the twenty third hour").isTrue();

		sweptAt(NOW.plus(Duration.ofHours(1)).plusSeconds(1)).sweep();

		assertThat(stands(account)).as("still standing once his link has run out").isFalse();
		assertThat(db.sql("select count(*) from competitor where id = ?").param(member).query(Long.class).single())
				.as("the account went and the member stayed behind it").isZero();

		/* AND THE ADDRESS IS FREE: the decision's „adresa je slobodna za novu registraciju". */
		aMember("registrovan@primer.rs", "competitor", true);
	}

	/** „Pošalji potvrdu ponovo" is another seven days, as its own letter says. */
	@Test
	void aLinkAskedForAgainKeepsHimForItsOwnSevenDays() {
		long account = aMember("ponovo@primer.rs", "competitor", true);
		long beside = oneThatGoes();

		aConfirmationLinkEnding(account, NOW.minus(Duration.ofDays(3)));
		aConfirmationLinkEnding(account, NOW.plus(Duration.ofDays(4)));

		sweptAt(NOW).sweep();

		assertThat(stands(account)).isTrue();
		assertThat(stands(beside)).isFalse();
	}

	/** The exception: a payment of any state, or a number, and he stays (broj se nikad ne dodeljuje ponovo). */
	@Test
	void aPaymentOrANumberKeepsHim() {
		long withAPayment = aMember("uplata@primer.rs", "competitor", true);
		long withANumber = aMember("broj@primer.rs", "competitor", false);
		long beside = oneThatGoes();

		aConfirmationLinkEnding(withAPayment, NOW.minus(Duration.ofHours(1)));
		anInvitationEnding(withANumber, NOW.minus(Duration.ofHours(1)));

		db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount, currency,"
						+ " fee, method, state, recorded_at, recorded_by, recorded_by_name, received)"
						+ " values (?, 2028, null, (select id from price_row order by sort_order limit 1),"
						+ " 35.00, 'EUR', 3.00, 'paypal', 'awaited', null, null, null, null)")
				.param(memberOf(withAPayment)).update();
		db.sql("update competitor set member_number = '009911' where id = ?").param(memberOf(withANumber)).update();

		sweptAt(NOW).sweep();

		assertThat(stands(withAPayment)).as("a member with a payment was deleted").isTrue();
		assertThat(stands(withANumber)).as("a member with a number was deleted").isTrue();
		assertThat(stands(beside)).isFalse();
	}

	/** An entered member whose invitation ran out goes; one whose invitation still stands stays. */
	@Test
	void anEnteredMemberGoesOnceHisInvitationHasRunOut() {
		long ranOut = aMember("pozvan-istekao@primer.rs", "competitor", false);
		long stillOpen = aMember("pozvan-vazi@primer.rs", "competitor", false);

		anInvitationEnding(ranOut, NOW.minus(Duration.ofMinutes(1)));
		anInvitationEnding(stillOpen, NOW.plus(Duration.ofMinutes(1)));

		sweptAt(NOW).sweep();

		assertThat(stands(ranOut)).isFalse();
		assertThat(stands(stillOpen)).isTrue();
	}

	/** Confirmed is never swept, whatever its links say. */
	@Test
	void aConfirmedAccountStaysWhateverItsLinksSay() {
		long confirmed = aMember("potvrdjen@primer.rs", "competitor", true);
		long beside = oneThatGoes();

		aConfirmationLinkEnding(confirmed, NOW.minus(Duration.ofDays(30)));
		db.sql("update account set email_confirmed_at = ? where id = ?")
				.params(Timestamp.from(NOW.minus(Duration.ofDays(40))), confirmed).update();

		sweptAt(NOW).sweep();

		assertThat(stands(confirmed)).isTrue();
		assertThat(stands(beside)).isFalse();
	}

	/**
	 * A MEMBER CONFIRMED BETWEEN THE WALK AND THE HOLD STAYS: the decision is asked again of the row
	 * as it stands under the hold, and not taken off the walk that found him.
	 */
	@Test
	void aMemberConfirmedAfterTheWalkFoundHimStays() {
		long account = oneThatGoes();

		db.sql("update account set email_confirmed_at = ? where id = ?")
				.params(Timestamp.from(NOW), account).update();

		assertThat(sweptAt(NOW).goes(memberOf(account), java.time.OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC)))
				.isFalse();
		assertThat(stands(account)).isTrue();
	}

	/** An account no link was ever sent to is no registration and no invitation. */
	@Test
	void anAccountNoLinkWasEverSentToStays() {
		long neverSent = aMember("bez-veze@primer.rs", "competitor", false);
		long beside = oneThatGoes();

		sweptAt(NOW).sweep();

		assertThat(stands(neverSent)).isTrue();
		assertThat(stands(beside)).isFalse();
	}

	/** An account that administers the portal is not swept, as the administration cannot delete it. */
	@Test
	void anAccountThatAdministersStays() {
		long moderator = aMember("moderator-clan@primer.rs", "moderator", true);
		long ticked = aMember("stiklirani@primer.rs", "competitor", true);
		long beside = oneThatGoes();

		aConfirmationLinkEnding(moderator, NOW.minus(Duration.ofHours(1)));
		aConfirmationLinkEnding(ticked, NOW.minus(Duration.ofHours(1)));
		db.sql("insert into account_admin_right (account_id, right_code) values (?, 'queue:payments')")
				.param(ticked).update();

		sweptAt(NOW).sweep();

		assertThat(stands(moderator)).isTrue();
		assertThat(stands(ticked)).isTrue();
		assertThat(stands(beside)).isFalse();
	}

	/**
	 * AN ACCOUNT THAT STOOD UNCONFIRMED THE DAY V72 RAN IS KEPT UNTIL THE DAY IT WAS GIVEN (owner,
	 * 24.10.2026, „zatečenima 7 dana od dana podizanja"), and swept after it like any other.
	 */
	@Test
	void anAccountStandingOnTheDayOfTheDeploymentIsKeptUntilItsDay() {
		long account = aMember("zatecen@primer.rs", "competitor", true);

		aConfirmationLinkEnding(account, NOW.minus(Duration.ofDays(20)));
		db.sql("update account set kept_unconfirmed_until = ? where id = ?")
				.params(Timestamp.from(NOW.plus(Duration.ofHours(2))), account).update();

		sweptAt(NOW).sweep();

		assertThat(stands(account)).isTrue();

		sweptAt(NOW.plus(Duration.ofHours(2))).sweep();

		assertThat(stands(account)).isFalse();
	}

	/** Once an hour, the first an hour after the start, as the pictures' sweep. */
	@Test
	void theSweepIsScheduledOnceAnHourAndAnHourAfterStart() {
		String theSweep = UnconfirmedAccountsAreSwept.class.getName() + ".sweep";
		List<ScheduledTask> found = schedulers.stream()
				.flatMap(each -> each.getScheduledTasks().stream())
				.distinct()
				.filter(task -> task.getTask().getRunnable().toString().equals(theSweep))
				.toList();

		assertThat(found).as("the scheduler holds no task that runs the sweep").hasSize(1);
		assertThat(found.get(0).getTask()).isInstanceOf(FixedDelayTask.class);
		assertThat(((FixedDelayTask) found.get(0).getTask()).getIntervalDuration()).isEqualTo(Duration.ofHours(1));
		assertThat(((FixedDelayTask) found.get(0).getTask()).getInitialDelayDuration()).isEqualTo(Duration.ofHours(1));
	}
}
