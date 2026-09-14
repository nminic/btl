package com.btl.portal.web;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * WHO THE PORTAL THINKS IS ASKING, said back to whoever asked.
 *
 * <p>The single page application has to know this before it draws anything: what
 * a visitor sees, what a member sees and what an administrator sees are three
 * different pages, and until now the answer lived in a browser tab and was lost
 * on every refresh.
 *
 * <p><b>It is behind the same rule as everything else, which is the point.</b>
 * Nobody signed in is answered 401 by the chain, not an empty body saying so:
 * an endpoint that answered "you are nobody" with 200 would be one more place
 * deciding what being signed in means, and the day it disagreed with the chain
 * the portal would show a member a page the server then refuses to fill.
 *
 * <p><b>What it does NOT carry is a member number</b>, and that is still a
 * decision with a reason rather than an oversight - but the reason changed on
 * 14.09.2026 and this paragraph changed with it. Until then there was no link at
 * all to read one through, and this class said so. Now there is: V23 gives
 * {@code account} a {@code competitor_id}, because „jedan nalog je tacno jedan
 * clan" (owner, {@code PDL.md:2987}). What keeps the number out of here is
 * therefore no longer that it cannot be found but that nothing has asked for it.
 * A field this record carries is a field every screen may read, and each one
 * added is a promise about what the portal answers before anybody has said which
 * screen needs it.
 *
 * <p><b>And it would not be the harmless field it looks like.</b> The link is
 * empty for anybody who does not race - a moderator has no member record at all,
 * by the decision of the same day - so a member number here would be null for a
 * real signed in administrator, and every screen reading it would need the branch
 * whether it wanted one or not.
 *
 * <p><b>A BOUNDARY, WRITTEN DOWN BECAUSE IT IS REAL AND NOT BECAUSE IT IS
 * COMFORTABLE: nothing in this repository measures the paragraphs above.</b> Three
 * files carried the sentence that said the cardinality was undecided - this one,
 * {@link WhoIsAsking} and {@link ModeratorApi} - and all three were rewritten in
 * the commit that put the column into the schema, by the rule that a sentence
 * asserting an overturned decision is an instruction to the next reader to put it
 * back. Measured on 14.09.2026 by doing exactly that: the old sentence was
 * restored here and {@code AccountAndVerificationTest}, {@code ModeratorApiTest}
 * and {@code AccountConstraintsTest} were run, sixty six cases, all green. Prose
 * has no guard and cannot be given one that converges - a pattern over English
 * has to be right about sentences nobody has written yet.
 *
 * <p><b>What IS guarded is the thing the prose is about,</b> and that is the whole
 * of why this is a boundary and not a hole: {@code account.competitor_id} exists,
 * refuses a second account on one member, accepts an account on no member at all,
 * and empties rather than cascades when the member goes. Three cases say those,
 * and a reader who believes this paragraph and checks the schema is told the truth
 * by the schema.
 */
@RestController
class MeApi {

	/** What the portal knows about whoever is asking, which today is two things. */
	record WhoIAm(String role, long account) {
	}

	/**
	 * @param member never null here: the chain answers 401 before this method runs,
	 *               so there is no branch for "nobody" and no case measuring one
	 */
	@GetMapping("/api/me")
	WhoIAm me(@AuthenticationPrincipal WhoIsAsking.Member member) {
		return new WhoIAm(member.role(), member.account());
	}
}
