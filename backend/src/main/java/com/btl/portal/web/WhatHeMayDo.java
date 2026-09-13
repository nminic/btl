package com.btl.portal.web;

import com.btl.portal.domain.rights.AdminRights;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * WHAT WHOEVER IS ASKING MAY DO, answered in one place.
 *
 * <p>ADL A8 names this as the second of the three things rights need: "Odgovor daje
 * jedno mesto". The front end has {@code useMay()} and this is its counterpart, and
 * the counterpart matters more: a second place answering on the browser's side shows
 * a link it should not, a second place answering here lets the request through.
 *
 * <p><b>Who is asking comes off the SESSION and from nowhere else.</b> Not a field in
 * the body, not a header, not a query parameter - those are written by whoever is
 * calling, and a permission read out of them is a permission the caller grants
 * himself. {@link WhoIsAsking} has already worked out whose request this is, from a
 * cookie whose secret the database does not hold, and this reads that answer.
 * {@code theRightIsReadFromTheSessionAndNotFromTheRequest} sends a superadmin's
 * account in a header, in a parameter and in the body of a request made by a
 * moderator who may not, and measures that nothing moves.
 *
 * <p><b>Why the principal is taken without asking whether it is there.</b> A route
 * that needs a right is a route {@link ApiSecurity} has not opened, so the chain
 * answers 401 before anything here runs, and there is nobody for this to be asked
 * about. Written as a branch it would be a branch no request can reach, which is a
 * branch nothing can measure - the same sentence {@code WhoIsAsking} carries where a
 * null check was taken out. What holds it is not a comment:
 * {@code everyRouteThatNeedsARightIsShutToSomebodyWhoIsNotSignedIn} asks every route
 * carrying a right, without a cookie, and fails on anything but 401.
 *
 * <p><b>Two statements rather than one join.</b> A left join would bring the mode and
 * the ticks back together, and would need a line telling the empty ones apart from the
 * real ones - a branch about the shape of a result set, standing where the question is
 * "may he". Two statements say what they read, and the second is asked of a table
 * whose primary key is exactly the pair it is being asked about.
 */
@Component
class WhatHeMayDo {

	private final JdbcClient db;

	WhatHeMayDo(JdbcClient db) {
		this.db = db;
	}

	/**
	 * Whether the member this request belongs to may do this.
	 *
	 * @param right the code as {@code admin_right.code} generates it
	 */
	boolean may(String right) {
		return rightsOf(asking().account()).may(right);
	}

	/**
	 * Whether the member this request belongs to holds every right there is, which is
	 * the question {@link OnlyTheSuperadmin} asks and the only other question this
	 * place answers.
	 *
	 * <p>It reads the same two statements {@link #may(String)} does rather than one of
	 * its own, so "who is asking" and "what does his role grant" stay one answer from
	 * one place - ADL A8's second requirement. The ticks are read and thrown away here,
	 * which is not waste: what is asked of the ROLE is the whole answer, and a shorter
	 * statement that read the mode alone would be a second way to work out what
	 * somebody holds.
	 */
	boolean holdsEveryRightThereIs() {
		return rightsOf(asking().account()).holdsEveryRightThereIs();
	}

	/**
	 * What one account holds, in the shape {@link AdminRights} answers from.
	 *
	 * <p>The mode comes off the ROLE and the ticks off the account. Both halves are
	 * needed and neither implies the other: a superadmin holds everything with no tick
	 * anywhere, and a moderator with every tick removed is still a moderator and holds
	 * nothing. Read the other way round - ticks only - the superadmin is refused his
	 * own portal; read as the role alone, the whole matrix is decoration.
	 */
	private AdminRights rightsOf(long account) {
		String mode = db.sql("select r.rights_mode from account a"
						+ " join role r on r.id = a.role_id"
						+ " where a.id = ?")
				.param(account).query(String.class).single();

		/* NAMED BY ACCOUNT, and that is the whole of the statement. Without the
		   condition every moderator would hold every tick anybody was ever given, and
		   a suite whose fixture has one moderator in it would not notice.
		   `aModeratorIsRefusedARightAnotherModeratorHolds` is the case that does. */
		Set<String> ticked = Set.copyOf(db.sql("select right_code from account_admin_right"
						+ " where account_id = ?")
				.param(account).query(String.class).list());

		return new AdminRights(AdminRights.Mode.of(mode), ticked);
	}

	/** Whose request this is, as the filter at the front of the chain decided. */
	private static WhoIsAsking.Member asking() {
		return (WhoIsAsking.Member) SecurityContextHolder.getContext()
				.getAuthentication().getPrincipal();
	}
}
