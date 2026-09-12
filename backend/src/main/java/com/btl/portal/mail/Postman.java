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
	 * @param signsIn     whether the relay is given a name and a key
	 * @param insistsOnTls whether STARTTLS is required rather than merely offered
	 */
	Postman(JavaMailSender relay, @Value("${btl.mail.from}") String from,
			@Value("${spring.mail.properties.mail.smtp.auth:false}") boolean signsIn,
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
		   against nothing and is untouched. */
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
