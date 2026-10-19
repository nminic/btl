package com.btl.portal.web;

import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.membership.WhatAMembershipChangeSays;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.Optional;

/**
 * A PAYMENT RECORDED FROM THE MEMBER'S ROW IN THE MODERATION OF THE MEMBERS.
 *
 * <p><b>The owner, 18.10.2026</b> (PDL P8, the section „Osnov članstva ima jedan dom”): „Na redu
 * člana u moderaciji: upis uplate za sezonu”, because „kad mi stigne uplata obnove (npr, clan iz 2027.
 * godine uplati za sezonu 2028), njega nema u redu clanova da verifikujem, nego ja moram da napravim
 * taj rekord za njega.” And „Upis uplate na redu člana: kaže se „uplata” i koliko je dinara uplaćeno;
 * ostatak do članarine se skida sa balansa.” So the request is the amount that arrived and nothing
 * else a moderator chooses, and the booking is {@link BookingAPayment}'s, the one the payments screen
 * books through, because the journal derives it is „isto pravilo kao na redu za aktivaciju na ekranu
 * Uplate ..., ne novo”.
 *
 * <p><b>WHAT THIS DOOR SETS THAT THE OTHER ONE ASKS.</b>
 *
 * <ul>
 * <li><b>The balance always pays the rest</b>: PDL, „[IZVEDENO 18.10.2026, iz vlasnikove rečenice
 * „Ostalo se skida sa balansa”] Na redu člana balans se uvek koristi za ostatak; nema kućice kao na
 * ekranu Uplate.” So {@code useTheBalance} is true here and never read off the request.
 * <li><b>No reference</b>: the row has no field for one, and a first payment is impossible here
 * anyway, because only a member who already carries a number has a row (PDL 21.09.2026, „svako ko je
 * ikad dobio članski broj”). The payments screen sends none either.
 * <li><b>The season is the clock's</b>, inside {@link BookingAPayment}: PDL P8, „Koje sezone: do 14.10.
 * samo tekuća, od 15.10. samo naredna”, which is {@code SeasonClock.seasonBeingPaidFor} and is the
 * only season this door can touch. Nothing in the request names one.
 * </ul>
 *
 * <p><b>WHO MAY</b>: the administration over the members, PDL P8 „[izabrao uz moju preporuku] Ko sme:
 * superadmin i moderator sa pravom nad članovima, uz trag ko i kada.” That is
 * {@link CompetitorApi#OVER_THE_MEMBERS}, the right the row itself is read under, and not
 * {@code queue:payments}: a moderator who works only the payments queue is answered 404 here (ADL A8),
 * and one over the members may record a payment here although he may not on the payments screen. On
 * his own row as well (PDL P8, „Moderator i superadmin smeju da rade na sopstvenom redu, uz trag koji
 * ih imenuje”), so nothing compares the account with the member. The trail is the one the payment row
 * has always carried: {@code recorded_by}, its name and its instant (V16).
 *
 * <p><b>THE MEMBER IS TOLD IN HIS INBOX, AND ONLY WHEN SOMETHING WAS WRITTEN.</b> PDL P8: „Upis uplate,
 * promena osnova i storno stižu članu kao poruka u portalskom sandučetu, sa sezonom i novim stanjem,
 * bez mejla.” So one row in {@code message}, addressed to him and never to nobody, because an empty
 * {@code to_id} is the whole league (V13); from the league (PDL P13, 19.09.2026, „Kad portal sam piše
 * poruku članu, pošiljalac je naziv lige”); in the words of {@link WhatAMembershipChangeSays}, which are
 * Serbian only by the decision that class quotes; and no mail. A second press on a season this door
 * has already booked writes nothing (200, {@code RecordingAPayment}'s harmless repeat), so it tells him
 * nothing either, and a refusal tells him nothing.
 *
 * <p><b>THE MEMBER'S ROW IS LOCKED FIRST</b>, {@code for update}, the shape
 * {@link MembershipWriteApi#free} keeps and for its reason: two presses that arrive together both read
 * that no payment stands and the second loses to {@code payment_one_a_season} with a 500. Held here,
 * the second waits for the first to commit and then reads its row, which is the harmless repeat. The
 * payments screen takes the same lock since 19.10.2026 ({@link PaymentApi}'s {@code lockTheMember}),
 * so a press there racing a press here on the same member and season is the same harmless repeat
 * and no longer the 500 (a deadlock) it was measured to be.
 */
@RestController
class MemberPaymentApi {

	private final JdbcClient db;

	private final BookingAPayment booking;

	private final TransactionTemplate inOneTransaction;

	MemberPaymentApi(JdbcClient db, BookingAPayment booking, TransactionTemplate inOneTransaction) {
		this.db = db;
		this.booking = booking;
		this.inOneTransaction = inOneTransaction;
	}

	/**
	 * @param received what arrived, in the member's own money, which is not asked for; refused as the
	 *                 payments screen refuses it ({@link PaymentApi#whatIsWrongWith})
	 * @param method   how it arrived, one of {@link PaymentApi#METHODS}: the screen works it out of the
	 *                 member's money exactly as the payments screen does ({@code paymentQr.ts#methodFor},
	 *                 PDL 20a), so the rule has one home
	 */
	record Paid(BigDecimal received, String method) {
	}

	@PostMapping("/api/members/{memberNumber}/payment")
	@RightIsNeeded(CompetitorApi.OVER_THE_MEMBERS)
	ResponseEntity<?> record(@PathVariable String memberNumber, @RequestBody Paid typed,
			@AuthenticationPrincipal WhoIsAsking.Member asking) {

		return inOneTransaction.execute(committing -> recording(memberNumber, typed, asking));
	}

	/**
	 * <p><b>THE ORDER OF THE REFUSALS</b> is {@link CompetitorWriteApi}'s for the other route keyed by a
	 * member number: a number nobody has is answered first and the same whatever else is wrong, then
	 * what the request says.
	 */
	private ResponseEntity<?> recording(String memberNumber, Paid typed, WhoIsAsking.Member asking) {
		Optional<Long> member = db.sql("select id from competitor where member_number = ? for update")
				.param(memberNumber)
				.query(Long.class)
				.optional();

		if (member.isEmpty()) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
		}

		if (typed.method() == null || typed.method().isBlank()) {
			return PaymentApi.no(HttpStatus.BAD_REQUEST, PaymentApi.THE_FORM_IS_NOT_COMPLETE);
		}

		String wrongWithTheAmount = PaymentApi.whatIsWrongWith(typed.received());

		if (wrongWithTheAmount != null) {
			return PaymentApi.no(HttpStatus.BAD_REQUEST, wrongWithTheAmount);
		}

		if (!PaymentApi.METHODS.contains(typed.method())) {
			return PaymentApi.no(HttpStatus.BAD_REQUEST, PaymentApi.THE_METHOD_IS_NOT_KNOWN);
		}

		BookingAPayment.Booked booked = booking.book(
				new PaymentApi.Confirm(member.get(), typed.received(), true, typed.method(), null), null,
				asking);

		/* 201 IS THE ONE ANSWER THAT WROTE ANYTHING, so it is the one he is told about. The season is
		   the one the booking itself read off the clock, never read a second time here, so the message
		   cannot name a different year from the row across midnight of 15 October. */
		if (booked.answer().getStatusCode() == HttpStatus.CREATED) {
			tell(member.get(), WhatAMembershipChangeSays.paymentRecorded(booked.season()));
		}

		return booked.answer();
	}

	private void tell(long member, Said said) {
		db.sql("insert into message (to_id, from_id, from_name, subject, body) values (?, null, ?, ?, ?)")
				.params(member, PairWriteApi.THE_LEAGUE, said.subject(), said.body())
				.update();
	}
}
