package com.btl.portal.domain.membership;

import java.util.Arrays;

/**
 * WHAT A SEASON'S MEMBERSHIP STANDS ON, in the words {@code membership_basis_known} holds.
 *
 * <p>The three ways a member is activated (PDL P8, 26.09.2026, „Clan se aktivira na tri nacina:
 * evidentirana uplata, oslobodjenje od clanarine odlukom Upravnog odbora, i balans"). They are here so
 * that a message to a member can name his basis in words ({@link WhatAMembershipChangeSays}), and the
 * schema's words go with them because the route reads the basis off the row in those words.
 *
 * <p><b>Not a second home for the words, and that is measured rather than promised:</b>
 * {@code MembershipBasisMatchesTheSchemaTest} compares them with {@code membership_basis_known} and
 * with the two rules {@code membership_change} carries over the same words (V63), in both directions.
 */
public enum Basis {

	/** A payment recognised for the season. */
	PAYMENT("payment"),

	/** Freed of the season's fee by the Managing Board. */
	FEE_EXEMPT("feeExempt"),

	/** Paid for out of his balance. */
	BALANCE("balance");

	private final String word;

	Basis(String word) {
		this.word = word;
	}

	/** The word the schema holds. */
	public String word() {
		return word;
	}

	/** The basis a word of the schema names. */
	public static Basis of(String word) {
		return Arrays.stream(values())
				.filter(one -> one.word.equals(word))
				.findFirst()
				.orElseThrow(() -> new IllegalArgumentException("no basis is called " + word));
	}
}
