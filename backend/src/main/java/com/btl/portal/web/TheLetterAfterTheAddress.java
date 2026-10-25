package com.btl.portal.web;

import com.btl.portal.domain.balance.Balance;
import com.btl.portal.domain.mail.MailLanguage;
import com.btl.portal.domain.mail.WhatTheMessageSays.Portal;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.mail.WhatTheWelcomeSays;
import com.btl.portal.domain.mail.WhatTheWelcomeSays.Letter;
import com.btl.portal.domain.payment.IpsPicture;
import com.btl.portal.domain.payment.IpsSlip;
import com.btl.portal.mail.Postman;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mail.MailException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;

/**
 * THE LETTER A MEMBER IS SENT THE MOMENT HIS ADDRESS IS CONFIRMED FOR THE FIRST TIME.
 *
 * <p>The owner, 23.10.2026 (PDL „Poruka posle potvrde adrese i rok nedovršene registracije"): once
 * the address is confirmed, the portal writes to the member about his membership. Which of the six letters it is,
 * {@link WhatTheWelcomeSays#which} decides; this class reads what that needs and sends it.
 *
 * <p><b>THERE ARE TWO WAYS AN ADDRESS IS CONFIRMED, AND BOTH CALL THIS, EACH ONLY WHEN IT WAS THE
 * ONE THAT CONFIRMED IT.</b> {@code EmailConfirmationApi.confirm} writes the moment for a member who
 * registered; {@code PasswordResetApi.reset} writes it for an account with no password, the member
 * the administration entered (PDL 19.09.2026). Each asks whether ITS statement was the one that
 * moved the column from empty, and calls this once if it was - so a second press on the link, or a
 * second link spent after the first, sends nothing. No statement anywhere empties the column again,
 * so the moment is one per account.
 *
 * <p><b>AFTER THE CONFIRMATION HAS COMMITTED, IN A TRANSACTION OF ITS OWN, AND THE LETTER AFTER
 * THAT.</b> The confirmation is the member's and does not wait on this, nor fail with it: a relay
 * that will not take the letter is logged and nothing else happens, the shape
 * {@code MemberDataWriteApi} and {@code EmailConfirmationApi.resend} give a link they send. The
 * transaction here exists because a slip writes a promise (owner, 27.09.2026), and the letter goes
 * out only once that promise is committed, for the same reason a link is sent only once its row is.
 *
 * <p><b>THE AMOUNT IS THE SERVER'S, MINUS THE BALANCE, AT THE JUNIOR PRICE WHERE IT APPLIES</b>
 * (owner, 26.09.2026, chosen with my recommendation: the code is minted on the amount less the
 * balance; PDL 24.10.2026), worked out by
 * {@link MembershipInvoice} exactly as {@code GET /api/me/membership} works it out, and promised the
 * same way the first time it is shown. The page „Moja članarina" quotes the full price of the period
 * today; that is the page's fault against the same decision and is mended on its own.
 */
@Component
class TheLetterAfterTheAddress {

	private static final Logger LOG = LoggerFactory.getLogger(TheLetterAfterTheAddress.class);

	private final JdbcClient db;

	private final TransactionTemplate inOneTransaction;

	private final MembershipInvoice invoice;

	private final Postman postman;

	private final Portal portal;

	/**
	 * A SIXTH CONSTRUCTOR THAT BUILDS A {@code Portal} OUT OF CONFIGURATION; {@code WhatTheMessageSays}
	 * says why it is never built out of anything that arrived with a request, and why the number of
	 * such constructors is not counted anywhere.
	 */
	TheLetterAfterTheAddress(JdbcClient db, TransactionTemplate inOneTransaction,
			MembershipInvoice invoice, Postman postman, @Value("${btl.portal.address}") String address) {
		this.db = db;
		this.inOneTransaction = inOneTransaction;
		this.invoice = invoice;
		this.postman = postman;
		this.portal = new Portal(address);
	}

	/** What goes out, to whom, and the slip's picture where there is one. */
	private record Written(String to, Said said, Postman.Attachment slip) {
	}

	/** The account, as much of it as the letter needs. */
	private record Reader(String address, MailLanguage language, Long member) {
	}

	/**
	 * Called once an address has been confirmed and that confirmation has committed.
	 *
	 * @param account the account whose address was confirmed by the caller's own statement
	 */
	void sendTo(long account) {
		Written letter = inOneTransaction.execute(writing -> written(account));

		if (letter == null) {
			return;
		}

		try {
			if (letter.slip() == null) {
				postman.send(letter.said(), letter.to());
			} else {
				postman.sendWith(letter.said(), letter.to(), letter.slip());
			}
		} catch (MailException theRelayDidNotTakeIt) {
			LOG.warn("the letter after the address of account {} was confirmed did not go out; the"
					+ " same facts stand on his membership page", account, theRelayDidNotTakeIt);
		}
	}

	private Written written(long account) {
		Reader reader = db.sql("select email, mail_language, competitor_id from account where id = ?")
				.param(account)
				.query((row, i) -> new Reader(row.getString(1), MailLanguage.ofTheColumn(row.getString(2)),
						row.getObject(3, Long.class)))
				.single();

		/* AN ACCOUNT THAT NAMES NO MEMBER HAS NO MEMBERSHIP TO BE TOLD ABOUT: a moderator who does
		   not race, invited and taking his account over through the same link. `GET
		   /api/me/membership` answers him 404 for the same sentence. */
		if (reader.member() == null) {
			return null;
		}

		long me = reader.member();
		MembershipInvoice.Invoice owed = invoice.forMember(me);
		Balance.Settlement today = owed.settled();

		Letter letter = WhatTheWelcomeSays.which(owed.holds(), today.fee().isNothing(),
				owed.numberHeAlreadyHas() != null, today.coveredByTheBalance(),
				today.fee().currency().isEuro()).orElse(null);

		if (letter == null) {
			return null;
		}

		MailLanguage in = reader.language();

		if (letter == Letter.WITH_A_SLIP) {
			Balance.Settlement slip = invoice.asTheSlipPromises(me, owed);
			String purpose = IpsSlip.purpose(owed.season());
			String amount = WhatTheWelcomeSays.amount(slip.toTransfer().amount(),
					slip.toTransfer().currency().name(), in);
			String payload = IpsSlip.payload(owed.season(), slip.toTransfer().amount());

			return new Written(reader.address(),
					WhatTheWelcomeSays.withASlip(in, owed.season(), IpsSlip.recipientAsWritten(),
							IpsSlip.accountAsWritten(), amount, purpose, portal),
					new Postman.Attachment("uplatnica-" + owed.season() + ".png", "image/png",
							() -> IpsPicture.png(payload,
									List.of(WhatTheWelcomeSays.caption(in), purpose, amount))));
		}

		if (letter == Letter.WITH_PAYPAL) {
			Balance.Settlement slip = invoice.asTheSlipPromises(me, owed);
			String amount = WhatTheWelcomeSays.amount(
					slip.toTransfer().amount().add(MembershipInvoice.processingOn(slip, owed)),
					slip.toTransfer().currency().name(), in);

			return new Written(reader.address(), WhatTheWelcomeSays.withPayPal(in,
					owed.season(), IpsSlip.PAYPAL_ADDRESS, amount, IpsSlip.RECIPIENT_NAME, portal), null);
		}

		return new Written(reader.address(),
				WhatTheWelcomeSays.about(letter, in, owed.season(), portal), null);
	}
}
