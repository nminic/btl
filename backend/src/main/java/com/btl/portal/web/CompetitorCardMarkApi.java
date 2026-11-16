package com.btl.portal.web;

import com.btl.portal.domain.card.WhatACardSays;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * THE SHORT MARK OF THE STATE OF A CARD, WHICH THE ADDRESS OF A MEMBER'S OWN PROFILE CARRIES.
 *
 * <p>Owner, PDL P11, 16.11.2026, anchor „Profil ima deljivu sliku za društvene mreže (OG sliku)”,
 * point 15. He measured it on himself: „radi odlicno na WA i na Viberu. Problem je sto kad dodam neki
 * rezultat i probam ponovo, vuce istu sliku.” Viber and WhatsApp keep a preview by the address of the
 * link and never ask the portal again for the same one. On the plan he decided: „pusti ispravku iz
 * tačke 2 odmah”: when a member opens HIS OWN profile, the address in the browser carries a short mark
 * of the state of his card, which changes with every change of the card, so the link he copies after
 * every change is a new one. The canonical address and {@code og:url} stay clean, the address without
 * the mark still works, and the mark is not a referral code (P18).
 *
 * <p><b>The mark is a piece of the digest the card's own address already carries, and nothing worked
 * out again.</b> {@link CompetitorCards#fingerprintOf} is the name of the card as it stands now, the one
 * {@code og:image} points at ({@link CompetitorPreviewApi}), and its last part is the digest of what
 * the card shows. The mark is the first {@link #LONG} characters of that digest, so the address of the
 * profile moves exactly when the address of the card does and for no other reason, and the browser
 * never computes a second copy of the fact. Four, because that is the length of the example the owner
 * was shown ({@code ?k=268f}); the price, which is MY REASONING and not an owner decision, is that two
 * states of one card share a mark once in 65 536 changes, and then that one change is not a new link.
 *
 * <p><b>Who may see it is the card's, to the byte.</b> The mark is there exactly when the card is: a
 * hidden profile, a lapsed member, a deleted one, a number nobody holds and a page of the wrong shape
 * are the one 404 of {@link PhotoApi#nothingIsHere}, the same answer the card gives for each of them.
 * It is open to anybody by name ({@link ApiSecurity#READ_BY_ANYBODY_UNDER_A_NAME}) for the card's own
 * reason: it says less than the card's address, which every page of a profile already carries in its
 * head. Only the member's own page asks for it ({@code pages/profile/cardMark.ts}); being open gives
 * nobody anything the page of the profile does not.
 *
 * <p><b>Never kept</b>, because it is the state of the card at this moment and a mark kept by a browser
 * is the very fault this route exists to end.
 */
@RestController
class CompetitorCardMarkApi {

	/**
	 * WHERE THE MARK IS ASKED FOR: the member number and the language, as the preview of the profile is
	 * asked ({@link CompetitorPreviewApi#ASKED_AT}). Under {@code /api/cards/}, so nginx limits it with
	 * the zone the cards are limited by ({@code frontend/nginx.conf}, the location over that folder):
	 * it reads the portal exactly as drawing a card does, and anybody may ask.
	 */
	static final String ASKED_AT = "/api/cards/marks/{page}";

	/**
	 * The member number and the language, {@code 000127-sr}: the shape of
	 * {@code CompetitorPreviewApi.A_PAGE}, written again here because that one is private to a class
	 * this increment does not touch.
	 */
	private static final Pattern A_PAGE = Pattern.compile("^([0-9]{6})-(sr|en)$");

	/** How many hexadecimal characters of the card's digest the mark carries. */
	static final int LONG = 4;

	/** What the route answers: the mark, and nothing else. */
	record Mark(String mark) {
	}

	private final CompetitorCards cards;

	CompetitorCardMarkApi(CompetitorCards cards) {
		this.cards = cards;
	}

	@GetMapping(ASKED_AT)
	ResponseEntity<Mark> mark(@PathVariable String page, HttpServletResponse response) throws IOException {
		Optional<String> mark = markOf(page);

		if (mark.isEmpty()) {
			PhotoApi.nothingIsHere(response);
			return null;
		}

		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Mark(mark.get()));
	}

	/** The mark for a page, or nothing when a visitor may not see the card. */
	Optional<String> markOf(String page) {
		Matcher spelt = A_PAGE.matcher(page);

		if (!spelt.matches()) {
			return Optional.empty();
		}

		return cards.fingerprintOf(spelt.group(1), WhatACardSays.of(spelt.group(2)).orElseThrow())
				.map(name -> name.substring(name.lastIndexOf('-') + 1, name.lastIndexOf('-') + 1 + LONG));
	}
}
