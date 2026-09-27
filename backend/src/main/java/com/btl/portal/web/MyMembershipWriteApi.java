package com.btl.portal.web;

import com.btl.portal.domain.balance.ActivatingFromBalance;
import com.btl.portal.domain.balance.ActivatingFromBalance.Outcome;
import com.btl.portal.domain.balance.Balance;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * A MEMBER LETTING HIMSELF IN ON HIS OWN BALANCE, which is the third way onto this portal and the
 * first one nobody else has to agree to.
 *
 * <p><b>Owner, 26.09.2026:</b> „Balans veci ili jednak clanarini: QR koda nema, clanstvo se
 * aktivira iz balansa, a visak ostaje za sledecu godinu." And the cost he was shown before
 * choosing it: it „trazi rutu koja aktivira clanstvo bez uplate, dakle nov put do aktivacije, i
 * <b>taj put mora da nosi istu proveru kao i onaj kroz uplatu</b>."
 *
 * <p><b>THAT SENTENCE IS WHAT THIS CLASS IS FOR, so what the other door asks is listed here beside
 * what this one does about it.</b> {@link PaymentApi} is the other door and it answers to a
 * moderator holding {@code queue:payments}; this one answers to the member himself, so every
 * question that route asks of the world is asked here of the same world.
 *
 * <ul>
 * <li><b>Is he already a member of this season.</b> {@link Outcome#ALREADY_A_MEMBER}, 409. On the
 * payments route the equivalent is {@code ALREADY_RECORDED}, which answers 200 with the row that
 * already stands, because a bank statement imported twice must be harmless. A member clicking twice
 * is not an import, and there is no second row to answer with, so this one refuses instead of
 * pretending it did something.
 * <li><b>Is he exempt from the fee.</b> {@link Outcome#HE_OWES_NOTHING}, 409, <b>and his balance is
 * untouched</b>. {@link PaymentApi} names this exact state as one it deliberately leaves unguarded
 * because „has no code path to reach today"; this class is a code path, so the guard is owed here.
 * <li><b>Does his balance cover the fee.</b> {@link Outcome#THE_BALANCE_IS_NOT_ENOUGH}, 409. A short
 * balance is what the payment code is for, and that road goes through the other door.
 * <li><b>Does he already carry a member number.</b> Decided by the rule
 * {@link com.btl.portal.domain.payment.RecordingAPayment} states, drawn from the one place
 * {@link MemberNumbers} now is.
 * </ul>
 *
 * <p><b>IT NAMES NO MEMBER, AND THAT IS ITS AUTHORISATION RATHER THAN A CHECK IT PERFORMS.</b>
 * There is no id in the path, no body and no parameter, so „somebody else's membership" is not
 * something this route can be asked for - the construction {@link MeWriteApi} chose and for the
 * same reason. It is absent from {@link ApiSecurity#READ_BY_ANYBODY}, so a visitor is answered 401
 * by the chain before this class runs, and it carries no {@link RightIsNeeded} because there is no
 * box anybody could tick that would let one member spend another's balance - the right does not
 * exist, and inventing one would be inventing the very thing PDL forbids („Balans se ne može
 * preneti drugom članu. Vezan je za nalog na kom je zarađen.").
 *
 * <p><b>ONE TRANSACTION, AND ADL NAMES THIS PLACE BY ITS OWN WORDS.</b> „Naplata članarine iz
 * balansa i naplata karticom moraju biti jedna transakcija, da delimično plaćanje ne ostavi člana
 * bez novca i bez članstva" - one of the four written transactional boundaries, and the one ADL
 * calls „jedina granica koja stoji". The entry in the book, the membership row and the member's
 * number all happen or none of them does. Written by hand on the field rather than left to an
 * annotation, the choice {@link PaymentApi} and {@link RegistrationApi} both made: a boundary
 * somebody has to open and close on purpose cannot be widened by accident.
 *
 * <p><b>AND THE BOOK IS WRITTEN BEFORE THE MEMBERSHIP, because the membership names the entry.</b>
 * V36 gives {@code membership} a {@code balance_entry_id} and
 * {@code membership_basis_says_whether_a_book_entry_is_named} refuses a {@code balance} membership
 * that names none, so the order is not a preference.
 *
 * <p><b>WHAT IS DELIBERATELY NOT GUARDED HERE, named rather than discovered</b>, the same way
 * {@link PaymentApi} names its own:
 *
 * <ul>
 * <li><b>Two requests activating the identical season at the same instant</b>, both reading no
 * membership before either writes. The second loses to {@code membership_pk} (V22) and answers 500
 * rather than the 409 {@link Outcome#ALREADY_A_MEMBER} would give it. Nothing is written twice and
 * no balance is spent twice - the losing transaction rolls its entry back with it, which is what
 * the one transaction around all of this is for - so the cost is an ugly answer to a second click,
 * not money. Folding that race back into the refusal is real work with its own guard and nothing
 * in this brief asks for it. What IS spent for good is the member number the loser drew, for the
 * reason {@link MemberNumbers} gives about sequences.
 * <li><b>A code minted for one season and a code for another, both standing, and the balance gone
 * by the time the second is paid.</b> That is the boundary PDL leaves open, and it belongs to the
 * payments route rather than to this one: {@link Balance#honouring} is where it is answered, by
 * taking what is there rather than going negative.
 * </ul>
 */
@RestController
class MyMembershipWriteApi {

	static final String ALREADY_A_MEMBER = "alreadyAMemberOfThisSeason";

	static final String HE_OWES_NOTHING = "thereIsNoFeeToPay";

	static final String NOT_ENOUGH = "theBalanceDoesNotCoverTheFee";

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	private final MembershipInvoice invoice;

	private final BalanceBook book;

	private final MemberNumbers numbers;

	private final TransactionTemplate inOneTransaction;

	MyMembershipWriteApi(JdbcClient db, MemberOfAccount memberOfAccount, MembershipInvoice invoice,
			BalanceBook book, MemberNumbers numbers, TransactionTemplate inOneTransaction) {
		this.db = db;
		this.memberOfAccount = memberOfAccount;
		this.invoice = invoice;
		this.book = book;
		this.numbers = numbers;
		this.inOneTransaction = inOneTransaction;
	}

	/** Why an activation was refused. */
	record Refused(String reason) {
	}

	/**
	 * @param season      the season he is now a member of
	 * @param memberNumber his, old or newly drawn
	 * @param fromTheBalance what was taken out of the book for it, both currencies
	 */
	record Activated(int season, String memberNumber, Balance.Money fromTheBalance) {
	}

	@PostMapping("/api/me/membership")
	ResponseEntity<?> activate(@AuthenticationPrincipal WhoIsAsking.Member asking) {
		Long me = memberOfAccount.competitorId(asking.account());

		if (me == null) {
			return ResponseEntity.notFound().build();
		}

		return inOneTransaction.execute(committing -> write(me, asking));
	}

	private ResponseEntity<?> write(long me, WhoIsAsking.Member asking) {
		MembershipInvoice.Invoice owed = invoice.forMember(me);

		Outcome outcome = ActivatingFromBalance.decide(new ActivatingFromBalance.Asking(
				owed.alreadyAMember(), owed.exemptFromTheFee(), owed.settled(), owed.numberHeAlreadyHas()));

		return switch (outcome) {
			case ALREADY_A_MEMBER -> no(ALREADY_A_MEMBER);
			case HE_OWES_NOTHING -> no(HE_OWES_NOTHING);
			case THE_BALANCE_IS_NOT_ENOUGH -> no(NOT_ENOUGH);
			case ACTIVATE, ACTIVATE_AND_NUMBER_HIM ->
					letHimIn(me, asking, owed, outcome == Outcome.ACTIVATE_AND_NUMBER_HIM);
		};
	}

	private ResponseEntity<?> letHimIn(long me, WhoIsAsking.Member asking, MembershipInvoice.Invoice owed,
			boolean numbering) {

		String myName = memberOfAccount.nameOf(asking.account());

		/* EXACTLY THE FEE AND NOT THE WHOLE BALANCE: he is here because the balance covers it, so
		   `fromTheBalance` is the fee and the rest is his „visak ostaje za sledecu godinu". Read off
		   the settlement rather than recomputed, so the number spent is the number the invoice
		   served. */
		Balance.Money spent = owed.settled().fromTheBalance();

		long entry = book.spentOnAMembership(me, owed.season(), spent, asking.account(), myName);

		db.sql("insert into membership (competitor_id, season, basis, balance_entry_id)"
						+ " values (?, ?, 'balance', ?)")
				.params(me, owed.season(), entry)
				.update();

		String memberNumber = numbering ? numbers.draw().written() : owed.numberHeAlreadyHas().written();

		if (numbering) {
			db.sql("update competitor set member_number = ?, active = true where id = ?")
					.params(memberNumber, me).update();
		}
		else {
			db.sql("update competitor set active = true where id = ?").param(me).update();
		}

		/* AND WHOEVER BROUGHT HIM IN IS PAID, because PDL ties the reward to ACTIVATION and says
		   nothing about how it was paid for: „Iznos leže na balans automatski, u trenutku kad se
		   novom članu aktivira članarina." A member let in on his own balance is activated, so his
		   referrer earns exactly as he would have from a recognised payment. Left out, the reward
		   would depend on which door the newcomer came through, which no decision says. */
		book.aReferralWasActivated(me, asking.account(), myName);

		return ResponseEntity.status(HttpStatus.CREATED).body(new Activated(owed.season(), memberNumber, spent));
	}

	private static ResponseEntity<?> no(String reason) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(new Refused(reason));
	}
}
