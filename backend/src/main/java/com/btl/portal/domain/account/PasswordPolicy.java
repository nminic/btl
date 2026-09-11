package com.btl.portal.domain.account;

import java.util.Locale;

/**
 * What a password has to be, and nothing else.
 *
 * <p>The owner decided this on 11.09.2026 and it is two rules: at least twelve
 * characters, and not one of the passwords that are already known to have leaked.
 * There is deliberately no third rule - no demand for a digit, a capital and a
 * symbol - and that is the decision rather than an omission. Rules of that kind are
 * what NIST stopped recommending, because they push people towards {@code
 * Password1!} and away from anything long, and a rule that makes passwords worse is
 * worse than no rule.
 *
 * <p><strong>Why the list only carries long entries.</strong> Twelve characters is
 * itself a filter: {@code 123456}, {@code qwerty} and {@code password} are refused
 * by the length before the list is ever asked. A leaked password that matters here
 * is one somebody would actually be allowed to use - {@code qwertyuiop123},
 * {@code passwordpassword}, {@code iloveyouforever} - so the list holds those and
 * nothing shorter. {@link BreachedPasswords} refuses to load a shorter entry rather
 * than carrying it as dead weight.
 */
public final class PasswordPolicy {

	/**
	 * Twelve, and it is a count of characters rather than of bytes.
	 *
	 * <p>{@code String.length()} counts UTF-16 units, so an emoji or any character
	 * outside the basic plane would count as two and a twelve character password
	 * made of them would be accepted at eleven. {@code codePointCount} counts what a
	 * person counts.
	 */
	public static final int SHORTEST = 12;

	private final BreachedPasswords breached;

	public PasswordPolicy(BreachedPasswords breached) {
		this.breached = breached;
	}

	/**
	 * Why a password was refused, or that it was not.
	 *
	 * <p>Three answers and not a boolean, because the screen says something
	 * different for each: too short is the member's to fix by typing more, and a
	 * leaked one is the member's to fix by choosing another. Telling him only "no"
	 * makes him try the same thing with a digit on the end.
	 */
	public enum Verdict {
		/** Long enough, and not known to have leaked. */
		FINE,
		/** Shorter than {@link #SHORTEST} characters. */
		TOO_SHORT,
		/** Long enough, but it is one of the passwords that have already leaked. */
		BREACHED
	}

	/**
	 * Judges one password.
	 *
	 * <p>Order matters and it is the cheap test first: a short password is refused
	 * without the list being asked at all, which is also why the list may hold
	 * nothing shorter.
	 *
	 * @param password what the member typed, never null
	 */
	public Verdict judge(String password) {
		if (password.codePointCount(0, password.length()) < SHORTEST) {
			return Verdict.TOO_SHORT;
		}
		if (breached.knows(password)) {
			return Verdict.BREACHED;
		}
		return Verdict.FINE;
	}

	/**
	 * The same question as a plain yes or no, for callers that only branch.
	 */
	public boolean accepts(String password) {
		return judge(password) == Verdict.FINE;
	}

	/**
	 * How a password is compared with the list, in one place so that the loader and
	 * the lookup cannot disagree.
	 *
	 * <p>Case is folded because {@code Password123456} and {@code password123456}
	 * are the same guess to anybody trying them, and the lists that circulate hold
	 * one of the two. Folding is done in {@link Locale#ROOT} on purpose: in a
	 * Turkish locale {@code "I".toLowerCase()} is {@code "ı"} and not {@code "i"},
	 * so a Turkish server would fold the list one way and the typed password the
	 * same way but both differently from every other server - and a password refused
	 * in Belgrade would be accepted in Istanbul.
	 *
	 * <p>Nothing else is done to it. Spaces are not trimmed, because a space is a
	 * character somebody chose and {@code correct horse battery} is not
	 * {@code correcthorsebattery}.
	 */
	static String fold(String password) {
		return password.toLowerCase(Locale.ROOT);
	}
}
