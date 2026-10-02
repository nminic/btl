package com.btl.portal.domain.photo;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Duration;
import java.time.Instant;
import java.util.OptionalLong;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT IN THE PICTURES FOLDER MAY BE A PICTURE'S FILE, AND HOW LONG A FILE MAY STAND THERE
 * BEFORE ITS ROW.
 *
 * <p><b>THE NAME IS TIED TO THE WRITER BY CONSTRUCTION AND NOT BY A SECOND LIST.</b> The
 * route that writes a file names it {@code String.valueOf(photo)} of the key the database
 * just issued, so the cases for a name that IS a key do not spell any name out: they take a
 * number and let {@code String.valueOf} spell it, which is the writer's own call. A reader
 * that agreed with a hand-written list of spellings and not with the writer would pass every
 * case here the day the writer changed.
 *
 * <p><b>THE LIMIT IS WRITTEN OUT AS TEN MINUTES IN EVERY CASE AND IS NEVER READ OFF THE
 * CONSTANT.</b> A case that computed its edges from {@code MAY_WAIT} would move with a
 * mutation of {@code MAY_WAIT} and say nothing about it; the number is the owner's (the
 * journal's sentence he chose says „stariji su od 10", and the unit is minutes), so it stands in
 * the cases as a number.
 */
class AFileWaitingForItsRowTest {

	private static final Instant NOW = Instant.parse("2031-03-15T10:00:00Z");

	@ParameterizedTest
	@ValueSource(longs = {1L, 7L, 42L, 100L, 123_456_789L, 9_000_000_000L, Long.MAX_VALUE})
	void aNameThatIsWhatTheWriterWritesBelongsToThatPicture(long key) {
		assertThat(AFileWaitingForItsRow.keyOf(String.valueOf(key))).isEqualTo(OptionalLong.of(key));
	}

	/**
	 * Every shape here is a name the writer can never have written, and each is one a looser
	 * reading would take for a picture: a leading zero or a sign is a number to
	 * {@code Long.parseLong} and not what {@code String.valueOf} writes; the Arabic-Indic and
	 * the full width digits are numbers to it too, in other alphabets; the two that overflow
	 * are digits only and still no key a {@code bigserial} will ever issue.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"", "0", "-0", "-5", "+5", "007", "01", "12.jpg", "12abc", "abc", " 12",
			"12 ", "1_000", "0x1F", "1,5", "1e3", "9223372036854775808", "99999999999999999999",
			"٣", "１２", "notes.txt", "lost+found", ".hidden"})
	void aNameThatIsNotWhatTheWriterWritesBelongsToNoPicture(String name) {
		assertThat(AFileWaitingForItsRow.keyOf(name)).isEqualTo(OptionalLong.empty());
	}

	/**
	 * STRICTLY OLDER, AND THE EDGE IS ASKED FROM BOTH SIDES. Older than ten minutes: a file
	 * that is exactly ten minutes old is not older than that, so it stays; one nanosecond
	 * beyond it goes. A rule written as „at least ten minutes" would pass the case after this
	 * one and fail this one.
	 */
	@Test
	void aFileThatIsExactlyTenMinutesOldHasNotWaitedLongEnough() {
		assertThat(AFileWaitingForItsRow.hasWaitedLongEnough(NOW.minus(Duration.ofMinutes(10)), NOW))
				.isFalse();
	}

	@Test
	void aFileOneNanosecondBeyondTenMinutesHasWaitedLongEnough() {
		assertThat(AFileWaitingForItsRow.hasWaitedLongEnough(
				NOW.minus(Duration.ofMinutes(10)).minusNanos(1), NOW)).isTrue();
	}

	@Test
	void aFileOfNineMinutesAndFiftyNineSecondsHasNotWaitedLongEnough() {
		assertThat(AFileWaitingForItsRow.hasWaitedLongEnough(
				NOW.minus(Duration.ofMinutes(10)).plusSeconds(1), NOW)).isFalse();
	}

	@Test
	void aFileOfElevenMinutesAndADayAndAYearHaveAllWaitedLongEnough() {
		assertThat(AFileWaitingForItsRow.hasWaitedLongEnough(NOW.minus(Duration.ofMinutes(11)), NOW))
				.isTrue();
		assertThat(AFileWaitingForItsRow.hasWaitedLongEnough(NOW.minus(Duration.ofDays(1)), NOW))
				.isTrue();
		assertThat(AFileWaitingForItsRow.hasWaitedLongEnough(NOW.minus(Duration.ofDays(365)), NOW))
				.isTrue();
	}

	/**
	 * A FILE WRITTEN JUST NOW, AND A FILE DATED IN THE FUTURE, ARE BOTH YOUNG. The second is a
	 * machine whose clock stepped back, or a volume copied from one that was ahead; either way
	 * it is not a file that has waited, and the rule must not read a negative age as a big one.
	 */
	@Test
	void aFileWrittenNowOrDatedInTheFutureHasNotWaitedLongEnough() {
		assertThat(AFileWaitingForItsRow.hasWaitedLongEnough(NOW, NOW)).isFalse();
		assertThat(AFileWaitingForItsRow.hasWaitedLongEnough(NOW.plus(Duration.ofHours(1)), NOW))
				.isFalse();
		assertThat(AFileWaitingForItsRow.hasWaitedLongEnough(NOW.plus(Duration.ofDays(400)), NOW))
				.isFalse();
	}
}
