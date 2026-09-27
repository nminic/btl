package com.btl.portal.web;

import com.btl.portal.domain.member.MemberNumber;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * THE ONE PLACE A MEMBER NUMBER IS EVER DRAWN, AND IT IS A SEQUENCE AND NEVER A QUERY.
 *
 * <p><b>Why this is a class of its own since 27.09.2026.</b> Until then the draw lived
 * inside {@link PaymentApi}, whose own comment called itself „the one place a number is
 * ever drawn" - true for as long as a recorded fee was the only thing that activated a
 * membership. It is not any more: the administration may free a member of the fee
 * ({@link MembershipWriteApi}), and PDL 27.07.2026 attaches the number to the ACTIVATION
 * and not to the fee - „Aktivacija clanstva - evidentirana uplata ili [oslobodjenje],
 * cime clan dobija clanski broj i postaje punopravan" (PDL:760), and again „punopravan,
 * IMA CLANSKI BROJ i pravo rangiranja" (PDL:808). Two routes therefore hand out numbers,
 * and the choice was between two call sites of one statement or one call site of two
 * copies. A number that must never repeat is the wrong fact to keep two copies of.
 *
 * <p><b>What PDL:777 says and what it does not.</b> „Clanski broj se dodeljuje automatski
 * u trenutku evidentiranja uplate... administrator ga nikad ne kuca", with the consequence
 * „registrovan a neplacen clan nema clanski broj". That is a sentence about the PAYMENT
 * path and about the man still waiting in the queue; it is not a sentence that only a
 * payment may ever produce a number, which PDL:760 and PDL:808 settle in the other
 * direction. What it does forbid outright is a number typed by hand, and nothing on this
 * portal types one: {@link RegistrationApi} and {@link CompetitorWriteApi} both write a
 * row with none and both say so.
 *
 * <p><b>A sequence and not {@code max(...) + 1}, which is V16's reason and is about two
 * different failures at once.</b> A query reads what is THERE, and what is there is
 * missing exactly the people who left - PDL 31.07.2026: „Clanski broj se nikad ne
 * dodeljuje dvaput... brisanje clana prekida vezu broja i osobe, ali broj ne vraca u
 * opticaj, jer bi ga naslijedio neko drugi a broj stoji u starim rezultatima, starim
 * tabelama i odstampanoj kartici." And a query is also a race: two concurrent readers see
 * the same highest value before either writes, and both draw it. PostgreSQL hands out each
 * value of {@code member_number_seq} (V16) exactly once, whichever transaction asks first,
 * which is what makes two simultaneous activations safe without a lock anywhere.
 * {@code PaymentNumberConcurrencyTest} is the floor under that, and it measures this
 * statement whichever route reaches it.
 */
@Component
class MemberNumbers {

	private final JdbcClient db;

	MemberNumbers(JdbcClient db) {
		this.db = db;
	}

	/** The next number nobody has ever held, drawn once and never handed out again. */
	MemberNumber draw() {
		long value = db.sql("select nextval('member_number_seq')").query(Long.class).single();

		return MemberNumber.of((int) value);
	}
}
