package com.btl.portal.mail;

import com.btl.portal.domain.mail.WhatTheMessageSays;
import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.mail.WhatTheMessageSays.Portal;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.util.ServerSetupTest;
import jakarta.mail.internet.MimeMessage;
import org.yaml.snakeyaml.Yaml;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * THE PORTAL'S MAIL, MEASURED BY SPEAKING SMTP TO A REAL SERVER.
 *
 * <p>GreenMail is an SMTP server, not a mock: the message is handed to Spring,
 * Spring opens a socket, and what this reads back is what actually travelled.
 * A mock asked "were you called" answers about the test; this answers about the
 * message.
 *
 * <p><b>No database, so no Testcontainers here.</b> Nothing in this class
 * touches a row, and a test that started a database to send an email would be
 * paying half a minute to prove something about a socket.
 */
@SpringBootTest(classes = {Postman.class,
		org.springframework.boot.mail.autoconfigure.MailSenderAutoConfiguration.class})
@TestPropertySource(properties = {
		"btl.mail.from=noreply@balkanskatrkackaliga.net",
		"spring.mail.host=127.0.0.1",
		"spring.mail.port=3025",
		"spring.mail.properties.mail.smtp.auth=false"})
class PostmanTest {

	/** Port 3025 is GreenMail's own for SMTP, and the properties above name it. */
	@RegisterExtension
	static final GreenMailExtension SMTP = new GreenMailExtension(ServerSetupTest.SMTP);

	private static final Portal PORTAL = new Portal("https://balkanskatrkackaliga.net");

	@Autowired
	private Postman postman;

	@Value("${btl.mail.from}")
	private String from;

	private MimeMessage waitForOne() throws Exception {
		assertThat(SMTP.waitForIncomingEmail(5000, 1))
				.as("nothing arrived at the server in five seconds")
				.isTrue();

		MimeMessage[] arrived = SMTP.getReceivedMessages();

		assertThat(arrived).as("more than one message arrived for one send").hasSize(1);

		return arrived[0];
	}

	/**
	 * WHAT WAS SAID IS WHAT ARRIVES, down to the address it came from.
	 *
	 * <p>The subject and the body are read off the message the server received
	 * rather than off the object that was handed in, because everything between
	 * the two is what this class exists to be right about.
	 */
	@Test
	void theMessageArrivesAndItIsTheOneThatWasWritten() throws Exception {
		Said said = WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS, PORTAL, "AbCd-EfGh_1234");

		postman.send(said, "clan@primer.rs");

		MimeMessage arrived = waitForOne();

		assertThat(arrived.getSubject()).isEqualTo(said.subject());
		assertThat(arrived.getContent().toString())
				.as("the link the whole message exists to carry did not travel")
				.contains(PORTAL.address() + Message.CONFIRM_THE_ADDRESS.path() + "?token=AbCd-EfGh_1234");
		assertThat(arrived.getAllRecipients()[0].toString()).isEqualTo("clan@primer.rs");
	}

	/**
	 * AND IT COMES FROM THE ADDRESS THAT REFUSES REPLIES.
	 *
	 * <p>{@code info@} is read by a person and {@code noreply@} is what the portal
	 * writes from (ADL-posta, 29.07.2026). Sent from the wrong one, every member
	 * pressing reply would write to a mailbox somebody has to answer, and the
	 * decision that made those two addresses different would be undone by one
	 * line of configuration.
	 */
	@Test
	void itComesFromTheAddressThatRefusesReplies() throws Exception {
		postman.send(new Said("Naslov", "Telo"), "clan@primer.rs");

		assertThat(waitForOne().getFrom()[0].toString())
				.as("the portal wrote from an address a person reads")
				.isEqualTo(from)
				.startsWith("noreply@");
	}

	/**
	 * AND SERBIAN SURVIVES THE JOURNEY.
	 *
	 * <p>Every word the portal sends is Serbian and a third of its letters are not
	 * ASCII. A subject encoded wrongly arrives as a row of question marks in the
	 * member's inbox, which is the sort of thing nobody writes a case for until it
	 * has already happened to everybody.
	 */
	@Test
	void ourLettersArriveAsOurLetters() throws Exception {
		postman.send(new Said("Potvrdite svoju adresu",
				"Dobrodošli u Balkansku trkačku ligu. Veza važi 24 sata."), "clan@primer.rs");

		MimeMessage arrived = waitForOne();

		assertThat(arrived.getSubject()).isEqualTo("Potvrdite svoju adresu");
		assertThat(arrived.getContent().toString())
				.contains("Dobrodošli")
				.contains("trkačku")
				.contains("važi");
	}

	/**
	 * A KEY IS NEVER SENT DOWN A CONNECTION THAT MIGHT NOT BE ENCRYPTED.
	 *
	 * <p>`starttls.enable` means "use it if the server offers it", so a stripping
	 * attacker on the wire gets a connection in the clear and, with authentication
	 * on, the relay's key follows it in Base64. `starttls.required` is the switch
	 * that refuses instead, and the two are separate.
	 *
	 * <p>The rule lives in the constructor rather than in a properties file because
	 * a line of configuration is one deployment away from being lost. All four
	 * combinations are here: only the dangerous one is refused, and it is refused
	 * before the server is up rather than at the first message.
	 */
	@Test
	void aPortalThatWouldSendItsKeyInTheClearDoesNotStart() {
		assertThatThrownBy(() -> new Postman(anywhere(), from, "brevo-korisnik", "kljuc", false))
				.as("the portal carries a key and does not require TLS")
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("starttls.required");

		/* A KEY WITH NO NAME, AND A NAME WITH NO KEY, ARE BOTH SOMEBODY SIGNING IN.
		   These two are here because the first draft of the guard asked whether
		   `mail.smtp.auth` was on, and a round on 12.09.2026 showed that is a different
		   question: Jakarta Mail sends AUTH LOGIN whenever credentials are present and
		   the server offers AUTH, whatever that switch says. Either half being set is
		   an installation that means to authenticate. */
		assertThatThrownBy(() -> new Postman(anywhere(), from, "brevo-korisnik", "", false))
				.isInstanceOf(IllegalStateException.class);
		assertThatThrownBy(() -> new Postman(anywhere(), from, "", "kljuc", false))
				.isInstanceOf(IllegalStateException.class);

		/* A SINGLE SPACE IS A CREDENTIAL, and a third round on 12.09.2026 found this
		   guard asking `isBlank` while the library asks `"".equals(...)`. To the
		   library a space is a value: it opens the connection, sends AUTH LOGIN, and
		   the space travels in Base64. Somebody typing a stray space into
		   `deploy/.env` is all it takes. */
		assertThatThrownBy(() -> new Postman(anywhere(), from, " ", " ", false))
				.as("a space is nothing to us and a credential to the library")
				.isInstanceOf(IllegalStateException.class);

		assertThatCode(() -> new Postman(anywhere(), from, "brevo-korisnik", "kljuc", true))
				.as("signing in over required TLS is the arrangement QA and production use")
				.doesNotThrowAnyException();
		assertThatCode(() -> new Postman(anywhere(), from, "", "", false))
				.as("development signs in to nothing and must keep working")
				.doesNotThrowAnyException();
		assertThatCode(() -> new Postman(anywhere(), from, "", "", true))
				.doesNotThrowAnyException();
	}

	/**
	 * AND THE SWITCH IS NOT DECORATION: WITH IT ON, NOTHING GOES OUT IN THE CLEAR.
	 *
	 * <p>GreenMail here offers no STARTTLS, which is exactly what a stripping
	 * attacker leaves behind. Sent with `enable` alone the message arrives anyway;
	 * with `required` the send fails and nothing reaches the server. The second
	 * half is the one that matters and the first is why it had to be measured.
	 */
	@Test
	void requiringTlsStopsTheMessageRatherThanSendingItInTheClear() throws Exception {
		JavaMailSenderImpl insisting = new JavaMailSenderImpl();

		insisting.setHost("127.0.0.1");
		insisting.setPort(SMTP.getSmtp().getPort());
		insisting.getJavaMailProperties().setProperty("mail.smtp.starttls.enable", "true");
		insisting.getJavaMailProperties().setProperty("mail.smtp.starttls.required", "true");

		assertThatThrownBy(() -> new Postman(insisting, from, "", "", true)
				.send(new Said("Naslov", "Telo"), "clan@primer.rs"))
				.as("the message went to a server offering no STARTTLS")
				.isInstanceOf(org.springframework.mail.MailException.class);

		assertThat(SMTP.waitForIncomingEmail(200, 1))
				.as("something reached the server in the clear")
				.isFalse();
	}

	/**
	 * AND NOTHING TYPED INTO AN ADDRESS OR A SUBJECT BECOMES A HEADER.
	 *
	 * <p>A second recipient folded into the address, and a header folded into the
	 * subject, are the two shapes of the same old trick. Both are refused today by
	 * the library underneath, and that is precisely why this is here: nothing in
	 * the portal said so, and a change of how the message is assembled would take
	 * the protection away without a word.
	 */
	@Test
	void nothingFoldedIntoAnAddressOrASubjectBecomesAHeader() throws Exception {
		/* The fold is written as the two numbers rather than typed, for the same
		   reason a thin space is: a carriage return inside a string literal is
		   invisible, and a reader cannot tell it from a line somebody wrapped. */
		String fold = "" + (char) 13 + (char) 10;

		assertThatThrownBy(() -> postman.send(new Said("Naslov", "Telo"),
				"clan@primer.rs" + fold + "Bcc: haker@zlo.rs"))
				.as("a second recipient was folded into the address")
				.isInstanceOf(org.springframework.mail.MailException.class);
		assertThatThrownBy(() -> postman.send(new Said("Naslov", "Telo"),
				"clan@primer.rs,haker@zlo.rs"))
				.as("two addresses were accepted where one was asked for")
				.isInstanceOf(org.springframework.mail.MailException.class);

		postman.send(new Said("Naslov" + fold + "X-Ubaceno: da", "Telo"), "clan@primer.rs");

		MimeMessage arrived = waitForOne();

		assertThat(arrived.getHeader("X-Ubaceno"))
				.as("a header folded into the subject arrived as a header")
				.isNull();
		assertThat(arrived.getAllRecipients()).hasSize(1);
	}

	/**
	 * AND THE INSTALLATION THAT ACTUALLY SIGNS IN SETS BOTH SWITCHES.
	 *
	 * <p>The guard in the constructor stops a portal configured this way from
	 * starting, which is the loud half. This is the quiet half: it reads the file QA
	 * is deployed from and requires the pair to be together there, so the mistake is
	 * caught by a red test rather than by a server that will not come up in the
	 * middle of a deploy.
	 *
	 * <p><b>It PARSES the file rather than searching it, and a round on 12.09.2026
	 * is why.</b> Written as a search for the text {@code SMTP_AUTH: "true"} it was
	 * proven green while lying in both directions: the same setting written without
	 * quotes is valid YAML, means the same thing to Compose, and slipped past it;
	 * and a line commented out still satisfied it, because the text was still in the
	 * file. Read as values, an unquoted true is a boolean and a commented line is
	 * not a key at all.
	 *
	 * <p><b>And what it asks about is the CREDENTIALS</b>, not the {@code auth}
	 * switch, for the same reason the constructor does: a name and a key are what
	 * make Jakarta Mail sign in, and that switch has no say in it.
	 */
	@Test
	void theInstallationThatSignsInAlsoRequiresTls() throws Exception {
		Map<String, Object> forTheBackend = deployedEnvironment();

		assertThat(forTheBackend)
				.as("the QA stack no longer configures mail at all, so this compares nothing")
				.containsKey("SPRING_MAIL_USERNAME");

		boolean signsIn = Stream.of("SPRING_MAIL_USERNAME", "SPRING_MAIL_PASSWORD")
				.anyMatch(forTheBackend::containsKey);

		if (signsIn) {
			assertThat(String.valueOf(
					forTheBackend.get("SPRING_MAIL_PROPERTIES_MAIL_SMTP_STARTTLS_REQUIRED")))
					.as("QA carries a key for the relay and does not require TLS, so the key can be"
							+ " stripped onto a clear connection")
					.isEqualTo("true");
		}
	}

	/** What the QA stack actually hands the backend, read as values and not as text. */
	@SuppressWarnings("unchecked")
	private static Map<String, Object> deployedEnvironment() throws Exception {
		Map<String, Object> compose = new Yaml()
				.load(Files.readString(Path.of("..", "deploy", "compose.qa.yml"), StandardCharsets.UTF_8));
		Map<String, Object> services = (Map<String, Object>) compose.get("services");
		Map<String, Object> backend = (Map<String, Object>) services.get("backend");
		Object environment = backend.get("environment");

		/* Compose takes `environment` as a map or as a list of `KEY=value`, and this
		   reads the map. Written as a bare cast it would fail on the list form with a
		   ClassCastException naming neither TLS nor authentication, and the next
		   person would be tempted to make the failure go away rather than to keep what
		   it was guarding. So it says what it needs and why. */
		assertThat(environment)
				.as("the QA stack writes its settings as a list rather than a map, and this case"
						+ " reads the map - rewrite it to read both rather than dropping it, because"
						+ " what it holds is that a key for the relay never travels without TLS")
				.isInstanceOf(Map.class);

		return (Map<String, Object>) environment;
	}

	/** A sender that is never used, for the cases that only build a postman. */
	private static JavaMailSenderImpl anywhere() {
		return new JavaMailSenderImpl();
	}

	@Test
	void aMessageWithNowhereToGoIsNotSent() {
		Said said = new Said("Naslov", "Telo");

		assertThatThrownBy(() -> postman.send(null, "clan@primer.rs"))
				.isInstanceOf(NullPointerException.class).hasMessage("said");
		assertThatThrownBy(() -> postman.send(said, null))
				.isInstanceOf(NullPointerException.class).hasMessage("to");

		assertThat(SMTP.waitForIncomingEmail(200, 1))
				.as("something was sent anyway")
				.isFalse();
	}

	/**
	 * AND A RELAY THAT DOES NOT ANSWER IS A THROWN ERROR, NOT A SHRUG.
	 *
	 * <p>Whoever asked for the message is the one who can decide what the member
	 * should see, and that is a different answer for a confirmation link than for
	 * a reminder. Swallowed here, every failure would be a member waiting for a
	 * link that was never coming.
	 */
	@Test
	void aRelayThatDoesNotAnswerIsSaidOutLoud() {
		/* A postman pointed at a port nothing listens on, rather than the shared
		   server stopped and started again. Stopping it would be the obvious way and
		   it is not available: GreenMail's service is a Thread, and `Thread.stop` was
		   removed in Java 21. Pointing elsewhere is also the cleaner measurement,
		   because it leaves the case that follows this one untouched. */
		JavaMailSenderImpl nowhere = new JavaMailSenderImpl();

		nowhere.setHost("127.0.0.1");
		nowhere.setPort(1);
		nowhere.getJavaMailProperties().setProperty("mail.smtp.connectiontimeout", "2000");

		assertThatThrownBy(() -> new Postman(nowhere, from, "", "", false).send(new Said("Naslov", "Telo"),
				"clan@primer.rs"))
				.as("a message that could not be sent was reported as sent")
				.isInstanceOf(org.springframework.mail.MailException.class);
	}
}
