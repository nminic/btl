package com.btl.portal.domain.rights;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Whether somebody may do one administrative thing.
 *
 * <p>The cases are about three modes and not about four roles, because the schema
 * is: {@code rights_mode} is a column on the role and visitor and competitor share
 * a value.
 *
 * <p>NOTHING HERE TOUCHES A DATABASE, and that is the point of the type: the
 * question is asked on every request that reaches the administration, so it has to
 * be cheap and it has to be measurable without a session or a connection. What ties
 * these three words to the four rows that use them is a floor in the db package,
 * {@code RolesAndRightsTest.theThreeModesAreTheOnesTheRightsModelReads}, which reads
 * the roles back out of the schema.
 */
class AdminRightsTest {

	private static final String A_RIGHT = "entity:members";
	private static final String ANOTHER_RIGHT = "queue:results";

	/** Everything, and what is ticked does not come into it. */
	@Test
	void thePortalsOwnerMayDoEverythingWithoutASingleTick() {
		AdminRights rights = new AdminRights(AdminRights.Mode.ALL, Set.of());

		assertThat(rights.may(A_RIGHT)).isTrue();
		assertThat(rights.may(ANOTHER_RIGHT)).isTrue();
		assertThat(rights.may("entity:something-nobody-has-invented-yet")).isTrue();
		assertThat(rights.mayDoAnything()).isTrue();
		assertThat(rights.holdsEveryRightThereIs()).isTrue();
	}

	/**
	 * AND HOLDING EVERY TICK IS NOT THE SAME AS HOLDING EVERY RIGHT THERE IS.
	 *
	 * <p><b>This is the difference {@code OnlyTheSuperadmin} is built on, and it cannot
	 * be seen by asking {@link AdminRights#may(String)} over the matrix one code at a
	 * time.</b> A moderator ticked for everything answers yes to every code there is, and
	 * still answers no here: what he holds was GIVEN him, one box at a time, and the one
	 * thing that is not in the matrix at all is who the moderators are
	 * (PDL P28a, 13.08.2026, „Moderatori nemaju kolonu"). A guard written as „does he hold all of
	 * them" would hand the portal to whoever was trusted with all of them, and „Bez te granice
	 * moderator bi sam sebi mogao da dodeli prava, pa granularna prava ne bi značila ništa" (owner,
	 * 30.07.2026).
	 *
	 * <p>Both sides are read in one case on purpose, because the claim is a comparison:
	 * the same set of codes, the same answers to {@code may}, and two different answers
	 * here.
	 */
	@Test
	void aModeratorWithEveryTickStillDoesNotHoldEveryRightThereIs() {
		Set<String> everyTick = Set.of(A_RIGHT, ANOTHER_RIGHT);

		AdminRights ticked = new AdminRights(AdminRights.Mode.GRANTED, everyTick);
		AdminRights owner = new AdminRights(AdminRights.Mode.ALL, everyTick);

		for (String right : everyTick) {
			assertThat(ticked.may(right))
					.as("the fixture's fully ticked moderator does not hold %s, so the two below"
							+ " differ in what was ticked rather than in the mode", right)
					.isTrue();
			assertThat(owner.may(right)).isTrue();
		}

		assertThat(ticked.holdsEveryRightThereIs())
				.as("a moderator ticked for every right there is was taken for the superadmin, and"
						+ " the screen he would then open is the one that ticks boxes")
				.isFalse();
		assertThat(owner.holdsEveryRightThereIs())
				.as("the superadmin does not hold every right there is, so nothing opens the one"
						+ " route no tick opens")
				.isTrue();
	}

	/** And nobody else does either, whatever is ticked. */
	@Test
	void nobodyWhoseRoleGrantsNothingHoldsEveryRightThereIs() {
		assertThat(new AdminRights(AdminRights.Mode.NONE, Set.of(A_RIGHT, ANOTHER_RIGHT))
				.holdsEveryRightThereIs())
				.as("a tick on somebody whose role grants nothing made him the superadmin")
				.isFalse();
		assertThat(AdminRights.none().holdsEveryRightThereIs()).isFalse();
	}

	/** Exactly what was ticked, and nothing beside it. */
	@Test
	void aModeratorMayExactlyWhatWasTickedForHim() {
		AdminRights rights = new AdminRights(AdminRights.Mode.GRANTED, Set.of(A_RIGHT));

		assertThat(rights.may(A_RIGHT)).isTrue();
		assertThat(rights.may(ANOTHER_RIGHT))
				.as("a moderator could do something nobody ticked for him")
				.isFalse();
		assertThat(rights.mayDoAnything()).isTrue();
	}

	/**
	 * And a moderator with every tick taken away may do nothing, while still being a
	 * moderator.
	 *
	 * <p>This is the case that tells {@code mayDoAnything} apart from "is he a
	 * moderator": the administration is not drawn for him, and nothing about his
	 * role has changed.
	 */
	@Test
	void aModeratorWithNoTicksMayDoNothing() {
		AdminRights rights = new AdminRights(AdminRights.Mode.GRANTED, Set.of());

		assertThat(rights.may(A_RIGHT)).isFalse();
		assertThat(rights.mayDoAnything())
				.as("the administration would be drawn for somebody with nothing in it")
				.isFalse();
	}

	/** Nothing, whatever is ticked, which is most people. */
	@Test
	void everybodyElseMayNothingEvenIfSomethingWasTicked() {
		AdminRights rights = new AdminRights(AdminRights.Mode.NONE, Set.of(A_RIGHT, ANOTHER_RIGHT));

		assertThat(rights.may(A_RIGHT))
				.as("a tick on somebody whose role grants nothing was honoured anyway")
				.isFalse();
		assertThat(rights.mayDoAnything()).isFalse();
		assertThat(AdminRights.none().mayDoAnything()).isFalse();
	}

	/**
	 * What was ticked cannot be changed after the answer has been given.
	 *
	 * <p>Not tidiness. The caller hands in a set, and if the object kept that same
	 * set the caller could add a right to itself after the check had been made - or,
	 * more likely, reuse one mutable set for two accounts and give the second one
	 * the first one's rights.
	 */
	@Test
	void whatWasTickedCannotBeChangedAfterwards() {
		Set<String> ticked = new java.util.HashSet<>(Set.of(A_RIGHT));
		AdminRights rights = new AdminRights(AdminRights.Mode.GRANTED, ticked);

		ticked.add(ANOTHER_RIGHT);

		assertThat(rights.may(ANOTHER_RIGHT))
				.as("a right added to the caller's set after the fact was honoured")
				.isFalse();
		assertThatThrownBy(() -> rights.granted().add("entity:pricing"))
				.as("the set this object hands back can be added to")
				.isInstanceOf(UnsupportedOperationException.class);
	}

	/** A word no role carries is a schema that has moved without this moving with it. */
	@Test
	void aModeNoRoleCarriesIsRefusedRatherThanGuessed() {
		assertThatThrownBy(() -> AdminRights.Mode.of("sometimes"))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("sometimes");
	}

	/**
	 * And nothing at all is refused where it is built, not where it is asked.
	 *
	 * <p>Both halves matter and they fail in different places. A role with no mode is
	 * a row the schema cannot hold, so reading one means something upstream is wrong
	 * and a plain {@code NullPointerException} says nothing about what. And rights
	 * built with no mode used to be built happily and fall over on the first question
	 * - which is somebody's request, a long way from the line that made it.
	 */
	@Test
	void nothingAtAllIsRefusedWhereItIsBuilt() {
		assertThatThrownBy(() -> AdminRights.Mode.of(null))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("no rights mode");

		assertThatThrownBy(() -> new AdminRights(null, Set.of()))
				.as("rights with no mode were built, and would have fallen over on a request")
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("no mode");
	}


}
