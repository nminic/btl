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


}
