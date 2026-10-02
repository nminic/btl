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
 * which is what makes two simultaneous activations of two different people safe without
 * any lock on the numbers themselves.
 * {@code PaymentNumberConcurrencyTest} is the floor under that, and it measures this
 * statement whichever route reaches it.
 *
 * <p><b>AND THE OTHER HALF OF THAT SAME PROPERTY, WHICH IS WHAT IT COSTS: A NUMBER DRAWN
 * INSIDE A TRANSACTION THAT GOES BACK IS SPENT ANYWAY.</b> {@code nextval} is outside the
 * transaction by construction - that is the whole of why it survives a deleted row - so a
 * booking the database then refuses leaves the sequence one higher with nothing to show for
 * it, and the owner's rule has no room for that: „Clanski broj se nikad ne dodeljuje dvaput"
 * (PDL 31.07.2026). Nothing here can fix that; where the draw SITS is the only lever there
 * is, and it belongs to each caller.
 *
 * <p><b>Where the three callers stand, measured rather than assumed, and the boundary written
 * down rather than left to be found:</b>
 *
 * <ul>
 * <li>{@link PaymentApi#recordIt} draws LAST, after both of its inserts and after every line
 * it writes into the book. It used to draw first, and that cost a number on every 500 the
 * route could reach - measured on a price list row set free, which answered
 * {@code payment_amount_positive} and ate one. Nothing is left after the draw but the
 * {@code update} that writes it down, which nothing can refuse.
 * <li>{@link MyMembershipWriteApi#letHimIn} already drew after its own
 * {@code insert into membership}, and still does.
 * <li>{@link MembershipWriteApi#grant} draws LAST as well, after the line in the book, the
 * {@code insert into membership} and the referral, and the two halves of that came for two
 * different reasons. <b>Two presses at once</b> both decided to grant, both drew - the draw
 * stood ahead of the insert - and the second then lost to {@code membership_pk}: a 500,
 * measured by {@code FreeingTwiceAtOneInstantTest} before either half existed, inside a
 * transaction that went back with its number already drawn. The route now locks the member's
 * row before it decides, so the second press waits for the first and is answered the harmless
 * repeat - that is what closes the race, and it would close it with the draw anywhere: the
 * mutation that put the draw back first left that case green. <b>The draw moved anyway</b>, to
 * keep the order of the other two doors to the same fact. This paragraph used to say that was a
 * change nobody could measure, and with the lock in place no refusal the portal can reach today
 * does come after the decision on that route; so {@code aBookingTheDatabaseRefusesDrawsNoNumber}
 * puts one there by hand, a constraint the case adds and takes away, requires that the sequence
 * did not move, and is the one case that fails when the draw goes back first.
 * </ul>
 *
 * <p><b>What that leaves open, in one sentence:</b> on all three doors a booking the database
 * refuses now spends no number, while a booking that SUCCEEDS spends one for good, which is
 * the owner's own named boundary (PDL section 19, „Aktivacija trosi clanski broj
 * nepovratno").
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
