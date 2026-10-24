package com.btl.portal.domain.payment;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * THE PAYMENT SLIP A MEMBER FROM SERBIA IS SENT, AS THE SERVER WRITES IT: who the money goes to,
 * and the NBS IPS text the QR code carries.
 *
 * <p><b>The same slip the page „Moja članarina" draws, and that is measured, not hoped.</b> The
 * owner, 23.10.2026 (PDL „Poruka posle potvrde adrese i rok nedovršene registracije"): a member from
 * Serbia is sent the payment details with the IPS QR code attached. The page builds the same text in
 * {@code frontend/src/data/paymentQr.ts} ({@code ipsPayload}), so there are two writers of one
 * string, in two languages. Neither can read the other, so they meet on a file:
 * {@code frontend/src/data/ipsSlipBothSidesWrite.json} holds the payee and a set of slips with the
 * text each must come out as, {@code IpsSlipTest} requires this class to write exactly that, and
 * {@code paymentQrMatchesTheServer.test.ts} requires {@code ipsPayload} to. Edited on one side
 * alone, the file fails on the other.
 *
 * <p><b>What it does NOT share with the page is the amount</b>, and that is the owner's decision
 * of 26.09.2026, chosen with my recommendation, rather than a drift: the code is minted on the
 * amount less the balance. The server works that
 * amount out ({@code MembershipInvoice}); the page still quotes the full price of the period, which
 * is a fault of the page against the same decision and is mended as its own piece of work (PDL,
 * 24.10.2026). The FORM of the text, given an amount, is what both sides hold to.
 */
public final class IpsSlip {

	/** The payee, as the page names it in the code (owner, 31.07.2026). */
	public static final String RECIPIENT_NAME = "Sportsko udruženje BTL";

	/** The seat, which the slip in writing carries beside the name and the code does not. */
	public static final String RECIPIENT_ADDRESS = "Bulevar Arsenija Čarnojevića 77, 11070 Novi Beograd";

	/** The association's dinar account, in the eighteen digits IPS reads. */
	public static final String RECIPIENT_ACCOUNT = "105000000000328471";

	/**
	 * Where a member abroad sends his PayPal payment (owner, 27.09.2026), the address the page
	 * calls {@code PAYPAL_ADDRESS}.
	 */
	public static final String PAYPAL_ADDRESS = "info@balkanskatrkackaliga.net";

	/** IPS's own code for a payment of this kind, the {@code SF} tag the page writes too. */
	private static final String PAYMENT_CODE = "289";

	private IpsSlip() {
	}

	/** What the money is for, in the words the statement carries: „Članarina za 2027. godinu". */
	public static String purpose(int season) {
		return "Članarina za " + season + ". godinu";
	}

	/**
	 * The account as a person reads it off a slip, „105-0000000003284-71": the bank, the
	 * account and the control number, which is how the owner's text writes it.
	 */
	public static String accountAsWritten() {
		return RECIPIENT_ACCOUNT.substring(0, 3) + "-" + RECIPIENT_ACCOUNT.substring(3, 16) + "-"
				+ RECIPIENT_ACCOUNT.substring(16);
	}

	/** The payee in one line, name and seat, as the owner's text writes the recipient. */
	public static String recipientAsWritten() {
		return RECIPIENT_NAME + ", " + RECIPIENT_ADDRESS;
	}

	/**
	 * THE TEXT THE CODE CARRIES, tag for tag what {@code ipsPayload} writes for a member with no
	 * number.
	 *
	 * <p><b>Never with a reference, because the letter is never sent to anybody who has one.</b>
	 * {@code RO} is left out for a member with no number rather than sent empty (PDL P8,
	 * 10.10.2026, „Prvu članarinu nov član plaća bez poziva na broj"), and a member who already
	 * has a number and no membership of the season on sale is sent no letter at all (owner,
	 * 24.10.2026), so there is no slip of this server that would carry one.
	 *
	 * @param amountRsd what he is asked to send, in dinars, never more than two decimals
	 */
	public static String payload(int season, BigDecimal amountRsd) {
		return String.join("|", List.of("K:PR", "V:01", "C:1", "R:" + RECIPIENT_ACCOUNT,
				"N:" + RECIPIENT_NAME,
				"I:RSD" + amountRsd.setScale(2, RoundingMode.UNNECESSARY).toPlainString().replace('.', ','),
				"SF:" + PAYMENT_CODE, "S:" + purpose(season)));
	}
}
