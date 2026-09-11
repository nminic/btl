package com.btl.portal.domain.rights;

import java.util.Set;

/**
 * Whether somebody may do one administrative thing, answered without a database.
 *
 * <p>V5 put the model in the schema and this is the sentence that reads it. A role
 * carries a {@code rights_mode} and it is one of three: {@code all} means every
 * right whatever is ticked, {@code granted} means exactly what has been ticked for
 * him, {@code none} means nothing at all. Four roles use three modes - visitor and
 * competitor are both {@code none} - and that is why the mode is a column on the
 * role rather than a list of four names anywhere.
 *
 * <p><strong>Why this is a pure type and not a service.</strong> The question is
 * asked on every request that touches the administration, so it has to be cheap;
 * and it is the question a whole class of mistakes hides in, so it has to be
 * measurable without a database, a session or a web request. What it needs is three
 * values, and it takes exactly those.
 */
public record AdminRights(Mode mode, Set<String> granted) {

	/** How a role gets its rights, exactly as {@code role.rights_mode} spells it. */
	public enum Mode {
		/** Every right there is, and what has been ticked does not matter. */
		ALL,
		/** Exactly what has been ticked, and nothing else. */
		GRANTED,
		/** Nothing, and what has been ticked does not matter. */
		NONE;

		/**
		 * Reads the word the database holds.
		 *
		 * @throws IllegalArgumentException on a word no role has, which is a schema
		 *                                  that has moved without this moving with it
		 */
		public static Mode of(String rightsMode) {
			return switch (rightsMode) {
				case "all" -> ALL;
				case "granted" -> GRANTED;
				case "none" -> NONE;
				default -> throw new IllegalArgumentException("nepoznat nacin prava: " + rightsMode);
			};
		}
	}

	/**
	 * Holds a copy of what was ticked, so that nobody can change it afterwards.
	 *
	 * <p>Not tidiness: this object is the answer to "may he", and a caller that
	 * kept a reference to the set it handed in could add a right to itself after the
	 * check had been made.
	 */
	public AdminRights {
		granted = Set.copyOf(granted);
	}

	/** Somebody with no administrative standing at all, which is most people. */
	public static AdminRights none() {
		return new AdminRights(Mode.NONE, Set.of());
	}

	/**
	 * Whether he may do this.
	 *
	 * @param right the code as {@code admin_right.code} generates it, {@code
	 *              entity:members} or {@code queue:results}
	 */
	public boolean may(String right) {
		return switch (mode) {
			case ALL -> true;
			case GRANTED -> granted.contains(right);
			case NONE -> false;
		};
	}

	/**
	 * Whether he may do any administrative thing at all, which is what decides
	 * whether the administration is drawn for him.
	 *
	 * <p>Not the same question as {@link #may(String)} over every right one at a
	 * time: a superadmin may do everything without a single tick, and a moderator
	 * with every tick removed may do nothing while still being a moderator.
	 */
	public boolean mayDoAnything() {
		return switch (mode) {
			case ALL -> true;
			case GRANTED -> !granted.isEmpty();
			case NONE -> false;
		};
	}
}
