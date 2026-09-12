package com.btl.portal.mail;

import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

import java.util.Objects;

/**
 * THE ONE THING ON THIS SERVER THAT SPEAKS TO THE OUTSIDE WORLD.
 *
 * <p>Everything about how a message is worded is decided before it gets here
 * ({@code WhatTheMessageSays}); this puts an address on it and hands it to the
 * relay. The two are apart on purpose: what a member reads is a product
 * decision that changes, and how it travels is a piece of infrastructure that
 * must not.
 *
 * <p><b>It sends from {@code noreply@}, and that address refuses everything
 * that comes back.</b> ADL-posta, 29.07.2026: {@code info@} is read by a person
 * and {@code noreply@} is what the portal writes from, rejecting incoming mail
 * at the SMTP level rather than swallowing it, because silence is worse than a
 * refusal - somebody who replies has to learn that nobody is reading.
 *
 * <p><b>Nothing here holds a credential.</b> The relay, its port and its key
 * come out of the environment, through Spring's own {@code spring.mail.*}, and
 * the key lives in {@code deploy/.env} which is not in the repository and never
 * passes through anybody's hands but the owner's.
 *
 * <p><b>A failure to send is thrown, not swallowed.</b> Whoever asked for the
 * message to go is the one who can decide what a member should see, and that is
 * a different answer for a confirmation link than for a reminder. Caught here
 * and logged, every one of them would be a member waiting for a link that was
 * never coming, with a line in a file nobody reads.
 */
@Component
public class Postman {

	private final JavaMailSender relay;

	private final String from;

	/**
	 * @param from        the address the portal writes from. Configured rather than
	 *                    written here, because QA and production are two
	 *                    installations of one portal and the day they must differ
	 *                    is not this class's business
	 * @param name        the name the relay is given, empty when there is none
	 * @param key         the key that goes with it
	 * @param insistsOnTls whether STARTTLS is required rather than merely offered
	 */
	Postman(JavaMailSender relay, @Value("${btl.mail.from}") String from,
			@Value("${spring.mail.username:}") String name,
			@Value("${spring.mail.password:}") String key,
			@Value("${spring.mail.properties.mail.smtp.starttls.required:false}") boolean insistsOnTls) {

		/* A KEY IS NEVER SENT DOWN A CONNECTION THAT MIGHT NOT BE ENCRYPTED, and
		   this refuses to start rather than trusting anybody to remember.

		   A security round on 12.09.2026 found the two switches apart: `starttls.enable`
		   means "use it if the server offers it", so somebody on the wire who strips
		   STARTTLS out of the greeting gets a connection in the clear, and with
		   authentication on the relay's key follows it in Base64. `starttls.required`
		   is the switch that refuses instead.

		   Written as a line of configuration the fix would be one deployment away from
		   being lost. Written here it is a server that does not come up, which is the
		   loudest a mistake can be and the cheapest to find. Development authenticates
		   against nothing and is untouched.

		   AND WHAT IT ASKS IS WHETHER THERE ARE CREDENTIALS, not whether
		   `mail.smtp.auth` is on, which is where the first draft of this guard was
		   wrong and a second round caught it. Those two are not the same question:
		   Jakarta Mail sends AUTH LOGIN whenever a name and a key are present and the
		   server offers AUTH, whatever `mail.smtp.auth` says - that switch only decides
		   whether MISSING credentials abort the connection. So a deployment carrying a
		   real Brevo key and no `auth` property walked straight through the old check
		   and sent the key anyway. Measured, over a socket, against a server that
		   offered no encryption: the key arrived in Base64.

		   The name is enough to ask about: a key with no name authenticates nothing,
		   and either of them being set is somebody intending to sign in.

		   AND IT ASKS `isEmpty` AND NOT `isBlank`, which a third round caught and which
		   is the same class of mistake one more time: the question has to be the one the
		   library asks. `JavaMailSenderImpl` treats a value as absent on `"".equals(...)`
		   and on nothing else, so a single space IS a credential to it - it opens the
		   connection, sends AUTH LOGIN, and the space travels in Base64. To `isBlank` a
		   space is nothing, so the guard would have waved it through. Measured: a
		   postman built with a space for both, against a server offering no encryption,
		   authenticated and the server read the space back. */
		boolean signsIn = !name.isEmpty() || !key.isEmpty();

		if (signsIn && !insistsOnTls) {
			throw new IllegalStateException("the portal is set to sign in to the mail relay without"
					+ " requiring TLS, so its key would travel in the clear to anybody who strips"
					+ " STARTTLS off the greeting: set spring.mail.properties.mail.smtp.starttls.required");
		}

		this.relay = relay;
		this.from = from;
	}

	/** Sends what was said to one address. */
	public void send(Said said, String to) {
		Objects.requireNonNull(said, "said");
		Objects.requireNonNull(to, "to");

		SimpleMailMessage message = new SimpleMailMessage();

		message.setFrom(from);
		message.setTo(to);
		message.setSubject(said.subject());
		message.setText(said.body());

		relay.send(message);
	}
}
