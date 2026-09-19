package com.btl.portal.db;

import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.time.Duration;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT THE MESSAGE PROMISES IS WHAT THE SCHEMA ACTUALLY DOES, and PostgreSQL is
 * the one asked.
 *
 * <p>Twenty four hours for confirming an address and one hour for a password link
 * are the owner's numbers, and they are written down twice: once as the column's
 * own default, and once in {@code Message} so the message can say it out loud.
 * Nothing but this joins them, and a message that promises a day about a link the
 * schema ends in an hour sends the member back to a door that shut while he was
 * reading.
 *
 * <p><b>The default is not read as text but EVALUATED.</b> The expression comes
 * out of the catalogue and PostgreSQL is asked what it produces, so
 * {@code now() + interval '24 hours'}, {@code now() + interval '1440 minutes'}
 * and {@code now() + '1 day'::interval} are all one answer here, as they are in
 * the table. A floor that compared the written expression would call two of those
 * three a mismatch.
 */
class HowLongALinkLastsMatchesTheSchemaTest extends DatabaseTest {

	/**
	 * Which row each message is about.
	 *
	 * <p>Written by hand because nothing else knows it: no tool can say that the
	 * message confirming an address is the one whose link lives in
	 * {@code email_verification_token}. What keeps it honest is that the keys come
	 * off {@code Message} itself, so a third message added tomorrow has no entry
	 * here and fails the first case below instead of being quietly unmeasured.
	 */
	private static final Map<Message, String> WHERE_THE_LINK_LIVES = Map.of(
			Message.CONFIRM_THE_ADDRESS, "email_verification_token",
			Message.SET_A_NEW_PASSWORD, "password_reset_token",
			/* AND THE INVITATION'S LINK LIVES IN THE SAME ROW AS A RESET'S, which is the
			   whole of „Pozivnica je isti put sa drugim povodom... jedan povod vise, ne
			   druga tabela i drugi razred" (ADL A53, 18.09.2026). Two messages naming one
			   table is therefore expected here rather than a mistake, and it is why the
			   sentence below asks after the TABLE's default rather than after a number
			   written beside the message. */
			Message.INVITED_AS_A_MODERATOR, "password_reset_token");

	/** How long the column's own default actually gives, asked of PostgreSQL. */
	private Duration whatTheSchemaGives(String table) {
		String whenItEnds = db.sql("select pg_get_expr(def.adbin, def.adrelid)"
						+ " from pg_attrdef def"
						+ " join pg_class rel on rel.oid = def.adrelid"
						+ " join pg_attribute col on col.attrelid = def.adrelid"
						+ "  and col.attnum = def.adnum"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema()"
						+ "  and rel.relname = ? and col.attname = 'expires_at'")
				.param(table).query(String.class).single();

		/* The expression is run, not parsed: whatever shape it is written in, this is
		   the number of seconds a row created now would have. */
		return Duration.ofSeconds(db.sql("select extract(epoch from ((" + whenItEnds + ") - now()))::bigint")
				.query(Long.class).single());
	}

	@Test
	void everyMessageSaysWhichRowItsLinkLivesIn() {
		assertThat(WHERE_THE_LINK_LIVES.keySet())
				.as("a message was added and nothing here measures how long its link lasts")
				.containsExactlyInAnyOrder(Message.values());
	}

	/**
	 * What the message promises, the column gives.
	 *
	 * <p>A second of slack, because the expression is evaluated against a clock
	 * that moves between the two statements.
	 */
	@ParameterizedTest
	@EnumSource(Message.class)
	void whatTheMessagePromisesTheSchemaGives(Message message) {
		Duration given = whatTheSchemaGives(WHERE_THE_LINK_LIVES.get(message));

		assertThat(given.toSeconds())
				.as("%s tells the member the link lasts %s and the schema gives %s",
						message, message.lasts(), given)
				.isCloseTo(message.lasts().toSeconds(), org.assertj.core.data.Offset.offset(2L));
	}

	/**
	 * AND TWO MESSAGES POINT AT ONE SCREEN EXACTLY WHEN THEIR LINKS LIVE IN ONE ROW.
	 *
	 * <p><b>This is the question {@code WhatTheMessageSaysTest} used to answer with „no two
	 * messages point at the same place", and it answers it here because this is where the
	 * fact it needs already lives.</b> That rule was true until 18.09.2026 and only because
	 * every message was its own road; the owner then decided that a new moderator gets his
	 * link „istim mehanizmom koji obnova lozinke vec nosi" (PDL P28a), so two messages
	 * share a screen ON PURPOSE and a rule demanding distinct paths is a rule against that
	 * decision.
	 *
	 * <p><b>What it must not stop catching is a message aimed at somebody ELSE's screen</b>,
	 * and that is not a theory: give {@link Message#SET_A_NEW_PASSWORD} the path
	 * {@code /potvrda-adrese} and every link the portal mails to a member who has forgotten
	 * his password lands on the screen that confirms an address, where his token means
	 * nothing. Measured 19.09.2026: that mutation passes the whole gate, 2171 cases, exit
	 * 0, while the rule it replaced caught it.
	 *
	 * <p><b>The two questions are one question, and that is why this is a biconditional
	 * rather than a list of which paths may repeat.</b> A screen is the thing that SPENDS a
	 * token, so „which screen this message points at" and „which table its link lives in"
	 * are the same fact read twice: two messages whose links live in one row must land
	 * where that row is spent, and two whose links live in different rows must not. Written
	 * as a list of allowed collisions it would be a second thing to remember; written this
	 * way, a fourth message is judged on the day it is added by the entry it already has to
	 * have above.
	 *
	 * <p><b>Both directions are read and both are live.</b> The other one says that a
	 * message whose link lives in {@code password_reset_token} may not be sent to a screen
	 * of its own without somebody saying what spends its token there - which stops the
	 * invitation from quietly growing a path nothing serves.
	 */
	@Test
	void twoMessagesShareAScreenExactlyWhenTheirLinksShareARow() {
		for (Message one : Message.values()) {
			for (Message other : Message.values()) {
				if (one.ordinal() >= other.ordinal()) {
					continue;
				}

				assertThat(one.path().equals(other.path()))
						.as("%s points at %s and %s at %s, while their links live in %s and %s."
								+ " Two messages land on one screen exactly when that screen is"
								+ " the one that spends their row: sharing a path with a"
								+ " different row is a member sent where his token means"
								+ " nothing, and sharing a row without sharing a path is a link"
								+ " nothing has been said to serve",
								one, one.path(), other, other.path(),
								WHERE_THE_LINK_LIVES.get(one), WHERE_THE_LINK_LIVES.get(other))
						.isEqualTo(WHERE_THE_LINK_LIVES.get(one)
								.equals(WHERE_THE_LINK_LIVES.get(other)));
			}
		}
	}

	/**
	 * And the two links do not last the same, which is a decision and not an
	 * accident.
	 *
	 * <p>The password link is the short one because it is the one that hands over
	 * an account. Were both to drift to one number, every case above would still
	 * pass while the reason for having two was gone.
	 */
	@Test
	void thePasswordLinkIsTheShorterOfTheTwo() {
		assertThat(whatTheSchemaGives(WHERE_THE_LINK_LIVES.get(Message.SET_A_NEW_PASSWORD)))
				.as("the link that hands over an account now lasts as long as the one that does not")
				.isLessThan(whatTheSchemaGives(WHERE_THE_LINK_LIVES.get(Message.CONFIRM_THE_ADDRESS)));
	}
}
