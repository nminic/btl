package com.btl.portal.mail;

import com.btl.portal.domain.mail.WhatTheMessageSays;
import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.mail.WhatTheMessageSays.Portal;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.util.ServerSetupTest;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;
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

		assertThatThrownBy(() -> new Postman(nowhere, from).send(new Said("Naslov", "Telo"),
				"clan@primer.rs"))
				.as("a message that could not be sent was reported as sent")
				.isInstanceOf(org.springframework.mail.MailException.class);
	}
}
