package com.btl.portal.web;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

/**
 * THE CARD A PROFILE IS SHARED WITH, AS A PICTURE ANYBODY MAY ASK FOR.
 *
 * <p>Owner, PDL P11, 15.11.2026, anchor „Profil ima deljivu sliku za društvene mreže (OG sliku)”:
 * the preview a network draws when a member pastes the address of his profile into Viber, WhatsApp
 * or Facebook. What the card shows, and who may see it, is {@link CompetitorCards}'s; this class
 * only carries the answer out.
 *
 * <p><b>Open to anybody, by name</b> ({@link ApiSecurity#READ_BY_ANYBODY_UNDER_A_NAME}), because the
 * one who asks is the network's crawler or the phone of whoever the link was sent to, and neither
 * is ever signed in. What it may draw is decided by reading the portal as a visitor, so being open
 * gives nobody anything the list of competitors does not already give him.
 *
 * <p><b>Three answers and no fourth.</b> The card; 404 for every card a visitor may not see,
 * written by the same {@link PhotoApi#nothingIsHere} a picture nobody holds is, so a hidden
 * profile, a lapsed member, a deleted one, a number nobody holds and a name of the wrong shape are
 * one answer to the byte; and 503 while the server is drawing other cards and this request has
 * waited its whole term, which a network answers by asking again later ({@code SmallPictures}).
 *
 * <p><b>Kept a day, privately</b>, under {@link PhotoApi#FOR_A_DAY_PRIVATELY} itself and for its
 * reason: every answer of this chain sets the CSRF cookie, so no shared cache may keep it, and a day
 * is how long a withdrawn profile can still be shown by a browser that kept it.
 */
@RestController
class CompetitorCardApi {

	private final CompetitorCards cards;

	CompetitorCardApi(CompetitorCards cards) {
		this.cards = cards;
	}

	@GetMapping(CompetitorCards.ASKED_AT)
	ResponseEntity<byte[]> card(@PathVariable String card, HttpServletResponse response)
			throws IOException {
		CompetitorCards.Answer answer = cards.card(card);

		if (answer instanceof CompetitorCards.Drawn drawn) {
			return ResponseEntity.ok()
					.contentType(MediaType.IMAGE_JPEG)
					.cacheControl(PhotoApi.FOR_A_DAY_PRIVATELY)
					.body(drawn.jpeg());
		}

		if (answer instanceof CompetitorCards.NotNow) {
			response.sendError(HttpStatus.SERVICE_UNAVAILABLE.value());
			return null;
		}

		return PhotoApi.nothingIsHere(response);
	}
}
