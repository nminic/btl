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
 * <p><b>What it does NOT carry is a member number</b>, and that is a decision
 * with a reason rather than an oversight. V7 says in as many words that nothing
 * joins an account to a competitor in either direction, because how many
 * accounts one member may have is not decided. Inventing the join here is how
 * that decision would quietly get made by whoever wrote this line.
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
