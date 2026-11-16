package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE CARD A VISITOR MAY NOT SEE IS NOT THERE IN EXACTLY THE WAY A CARD NOBODY HAS IS NOT, ON THE
 * WIRE.
 *
 * <p>PDL, 06.09.2026, confirmed by the owner on 03.10.2026: „Ako skriven profil vodi na naslovnu a
 * nepostojeći kaže „nije pronađen", posetilac po razlici saznaje koji brojevi pripadaju skrivenim
 * članovima ... Oba slučaja dobijaju isti ishod." The card's address carries the member number, so
 * the same holds for it: a hidden profile, a member whose fee has lapsed and a number nobody holds
 * must be one answer, and a status alone is not an answer (the class note on
 * {@link RightsOverRealHttpTest} measured why: the length gave two answers away once already).
 *
 * <p><b>Nothing is thrown away before the comparison, no line at all.</b> Every request sends the
 * CSRF cookie, so no answer sets one ({@code RightsOverRealHttpTest#withoutTheClock} measured that
 * with a token sent nothing under {@code /api} sets a cookie), and the three addresses are of the
 * same length. What is changed is two VALUES, and both are the clock: the value of {@code Date} and
 * the {@code timestamp} of the error document. The names of every header are compared, in order.
 *
 * <p><b>And the control that makes the hidden case a case</b>: the same member, once he stops
 * hiding, is answered his card. Without it a member who was simply not on the list for another
 * reason would make the comparison pass while measuring nothing about hiding.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import({TestcontainersConfiguration.class, CompetitorCardApiTest.TheClockTheseCasesUse.class})
class CompetitorCardOverRealHttpTest {

	private static final String HIDDEN = "000782";

	private static final String LAPSED = "000783";

	private static final String NOBODY = "000799";

	private static final String A_TOKEN = "11111111-2222-3333-4444-555555555555";

	@LocalServerPort
	private int port;

	@Autowired
	private JdbcClient db;

	@BeforeEach
	void aHiddenMemberAndALapsedOne() {
		member(HIDDEN, true, 2028);
		member(LAPSED, false, 2027);
	}

	@AfterEach
	void takeThemBackOut() {
		for (String number : List.of(HIDDEN, LAPSED)) {
			db.sql("delete from membership where competitor_id = (select id from competitor where member_number = ?)")
					.param(number).update();
			db.sql("delete from competitor where member_number = ?").param(number).update();
		}
	}

	@Test
	void aHiddenProfileALapsedMemberAndANumberNobodyHoldsAreOneAnswerToTheByte() throws Exception {
		String nobody = answerTo(nameFor(NOBODY));

		assertThat(nobody).startsWith("HTTP/1.1 404 ");

		for (String number : List.of(HIDDEN, LAPSED)) {
			String answered = answerTo(nameFor(number));

			assertThat(headerNamesOf(answered)).as(number).isEqualTo(headerNamesOf(nobody));
			assertThat(withoutTheClock(answered, nameFor(number)))
					.as(number).isEqualTo(withoutTheClock(nobody, nameFor(NOBODY)));
		}

		/* The control: the hidden member, no longer hiding, has a card. */
		db.sql("update competitor set profile_hidden = false where member_number = ?").param(HIDDEN).update();
		assertThat(answerTo(nameFor(HIDDEN))).startsWith("HTTP/1.1 200 ");
	}

	@Test
	void andItIsTheAnswerAPictureNobodyHoldsIsGiven() throws Exception {
		String photo = "/api/photos/" + "ab".repeat(32);
		String picture = answerTo(photo);
		String card = answerTo(nameFor(HIDDEN));

		assertThat(picture).startsWith("HTTP/1.1 404 ");
		assertThat(headerNamesOf(card)).isEqualTo(headerNamesOf(picture));
		/* The document in the one chunk, without the chunk's size: the size is the length of the
		   path, and the two paths are of different lengths. */
		assertThat(documentIn(withoutTheClock(card, nameFor(HIDDEN))))
				.isEqualTo(documentIn(withoutTheClock(picture, photo)))
				.contains("\"status\":404");
	}

	private static String documentIn(String answer) {
		String body = bodyOf(answer);
		return body.substring(body.indexOf("\r\n") + 2, body.indexOf("\r\n0\r\n"));
	}

	private static String nameFor(String number) {
		return "/api/cards/competitor/" + number + "-sr1-0123456789abcdef.jpg";
	}

	/**
	 * The value of {@code Date}, the {@code timestamp} and the path, which three are what may differ.
	 *
	 * <p>The line of {@code Date} is matched WITH its {@code \r\n}, the shape {@link RightsOverRealHttpTest}
	 * uses: in Java {@code .} does not take the {@code \r}, and {@code $} does not stand between the {@code \r}
	 * and the {@code \n} of one line ending, so {@code ^Date: .*\r$} never matched a header line, the value was
	 * never replaced, and the comparison failed whenever the second changed between two requests. That the value
	 * WAS replaced is asserted here, so a pattern that matches nothing fails every time and not only on a second
	 * that turns over.
	 */
	private static String withoutTheClock(String answer, String path) {
		String masked = answer.replaceAll("(?m)^Date: .*\r\n", "Date: AT SOME MOMENT\r\n")
				.replaceAll("\"timestamp\":\"[^\"]*\"", "\"timestamp\":\"AT SOME MOMENT\"")
				.replace(path, "THE ADDRESS THAT WAS ASKED FOR");

		assertThat(masked).as("the value of Date was not replaced").contains("\r\nDate: AT SOME MOMENT\r\n");

		return masked;
	}

	private static List<String> headerNamesOf(String answer) {
		return answer.substring(0, answer.indexOf("\r\n\r\n")).lines().skip(1)
				.map(line -> line.substring(0, line.indexOf(':'))).toList();
	}

	private static String bodyOf(String answer) {
		return answer.substring(answer.indexOf("\r\n\r\n") + 4);
	}

	private String answerTo(String path) throws Exception {
		String asking = "GET " + path + " HTTP/1.1\r\n"
				+ "Host: localhost:" + port + "\r\n"
				+ "Cookie: XSRF-TOKEN=" + A_TOKEN + "\r\n"
				+ "X-XSRF-TOKEN: " + A_TOKEN + "\r\n"
				+ "Connection: close\r\n\r\n";

		try (Socket socket = new Socket("localhost", port)) {
			socket.getOutputStream().write(asking.getBytes(StandardCharsets.ISO_8859_1));
			socket.getOutputStream().flush();
			return new String(socket.getInputStream().readAllBytes(), StandardCharsets.ISO_8859_1);
		}
	}

	private void member(String number, boolean hidden, int season) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season,"
						+ " referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Ime', 'Prezime', 'M', date '1980-05-05',"
						+ " (select id from place where rank = 1), null, null, 2027,"
						+ " ?, null, '', ?, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, "0011223388" + number, hidden).update();
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values ((select id from competitor where member_number = ?), ?, 'feeExempt',"
						+ " 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
				.params(number, season).update();
	}
}
