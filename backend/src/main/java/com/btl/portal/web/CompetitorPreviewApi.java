package com.btl.portal.web;

import com.btl.portal.domain.card.CompetitorCard;
import com.btl.portal.domain.card.WhatACardSays;
import com.btl.portal.domain.card.WhatFacebookIsAskedAgain.Key;
import com.btl.portal.domain.event.EventAddress;
import com.btl.portal.domain.mail.WhatTheMessageSays.Portal;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * WHAT A NETWORK SHOWS WHEN SOMEBODY PASTES THE ADDRESS OF A PROFILE: the tags in the head of the
 * page that name the member and point at his card.
 *
 * <p>Owner, PDL P11, 15.11.2026, anchor „Profil ima deljivu sliku za društvene mreže (OG sliku)”:
 * „meni ne treba dugme podeli za sve ove mreže. Želim da funkcioniše tako kad samo iskopiram link i
 * paste-ujem u Viber, WhatsApp, Facebook i sl.” Facebook and Viber run no JavaScript, so what they
 * read is the page as the server sends it, and until now that was {@code frontend/index.html} for
 * every address, with the title of the front page and the logo. nginx now asks this route for the
 * address of a profile and puts its answer into the head of that page through SSI
 * ({@code frontend/nginx.conf}, the location over {@code takmicar}), in place of the block
 * {@code index.html} carries for every other address.
 *
 * <p><b>What the block says, and whose words they are.</b> The title is the owner's: „boldovan
 * naslov treba da glasi Nikola Minić u Balkanskoj trkačkoj ligi”, and the preview has NO
 * description: „ne treba da piše uopšte ovaj deo [...]”. So the block carries no
 * {@code og:description}, and, until the owner decides it, no {@code meta name="description"}
 * either, because a network that finds no {@code og:description} may show that one instead (an
 * open question in the PR). The English title is MY PROPOSAL and nobody's decision. The picture is
 * the card {@link CompetitorCards} draws, at the address that carries the digest of what it shows,
 * so a changed card is a new address and a network fetches it again.
 *
 * <p><b>Nothing here decides who may be shown.</b> The block is written only when
 * {@link CompetitorCards#shown} answers, which is the same reading of the portal as a visitor the
 * card itself is drawn from. Every other case - a hidden profile, a lapsed member, a deleted one, a
 * number nobody holds and a name of the wrong shape - is the one 404 of
 * {@link PhotoApi#nothingIsHere}, and nginx answers every one of those with the block the front
 * page carries, so the five are one page to the byte.
 *
 * <p><b>Every value goes out escaped for an attribute.</b> The name is typed by the member, and the
 * block stands in the head of a page every visitor of that profile runs: a quotation mark or a
 * {@code <} left as it is would be a script of his in our page. {@link HtmlUtils#htmlEscape} turns
 * {@code & < > " '} into references and leaves every other letter as it is, Cyrillic included,
 * which is what a page served as UTF-8 needs.
 *
 * <p><b>Open to anybody, by name</b> ({@link ApiSecurity#READ_BY_ANYBODY_UNDER_A_NAME}), because the
 * one who asks is nginx on behalf of whoever opened the profile, signed in or not. nginx marks the
 * folder {@code internal}, so nobody outside reaches it; and what it says, a visitor's profile and
 * the address of a card anybody may ask for, is less than the list of competitors already gives.
 */
@RestController
class CompetitorPreviewApi {

	/** Where nginx asks for the preview of a profile: the member number and the language. */
	static final String ASKED_AT = "/api/previews/competitor/{page}";

	/** The member number and the language, {@code 000127-sr}. */
	private static final Pattern A_PAGE = Pattern.compile("^([0-9]{6})-(sr|en)$");

	/**
	 * THE NAME OF THE LEAGUE, AS EVERY PREVIEW ON THE PORTAL NAMES THE SITE. It is
	 * {@code app.name} in both dictionaries of the frontend, the same in both languages, and
	 * {@code CompetitorPreviewApiTest} reads it there.
	 */
	static final String SITE_NAME = "Balkanska trkačka liga";

	/** The words of a preview in one language, and the language Open Graph names it by. */
	enum Words {

		/** The owner's sentence, 15.11.2026. */
		SERBIAN(WhatACardSays.SERBIAN, "{name} u Balkanskoj trkačkoj ligi", "Kartica profila: {name}",
				"sr_RS"),

		/** MY PROPOSAL, nobody's decision yet, and marked as such in the PR. */
		ENGLISH(WhatACardSays.ENGLISH, "{name} in the Balkan Running League", "Profile card: {name}",
				"en_GB");

		private final WhatACardSays card;
		private final String title;
		private final String alt;
		private final String locale;

		Words(WhatACardSays card, String title, String alt, String locale) {
			this.card = card;
			this.title = title;
			this.alt = alt;
			this.locale = locale;
		}

		static Words of(WhatACardSays card) {
			return card == WhatACardSays.SERBIAN ? SERBIAN : ENGLISH;
		}

		/** The title of the preview, which is {@code seo.competitor.shareTitle} of the frontend. */
		String title(String name) {
			return title.replace("{name}", name);
		}

		String alt(String name) {
			return alt.replace("{name}", name);
		}

		String locale() {
			return locale;
		}

		String code() {
			return card.code();
		}
	}

	private final CompetitorCards cards;
	private final Portal portal;
	private final WhatFacebookHasRead facebookHasRead;

	CompetitorPreviewApi(CompetitorCards cards, @Value("${btl.portal.address}") String portal,
			WhatFacebookHasRead facebookHasRead) {
		this.cards = cards;
		this.portal = new Portal(portal);
		this.facebookHasRead = facebookHasRead;
	}

	/**
	 * @param reader the {@code User-Agent} of whoever opened the profile, which nginx's subrequest carries as it came
	 *               ({@link WhatFacebookHasRead}); when it is Facebook's crawler, the page it is given is written down
	 */
	@GetMapping(ASKED_AT)
	ResponseEntity<byte[]> preview(@PathVariable String page,
			@RequestHeader(name = HttpHeaders.USER_AGENT, required = false) String reader, HttpServletResponse response)
			throws IOException {
		Optional<String> block = blockFor(page, reader);

		if (block.isEmpty()) {
			return PhotoApi.nothingIsHere(response);
		}

		return ResponseEntity.ok()
				.contentType(new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8))
				.cacheControl(CacheControl.noStore())
				.body(block.get().getBytes(StandardCharsets.UTF_8));
	}

	/**
	 * The block for a page, or nothing when a visitor may not see the profile; and when the reader is Facebook, what it
	 * is given is written down (owner, PDL P11, 16.11.2026, item 14), only for a profile it is shown, because at any
	 * other it gets the front page's preview and holds nothing of the member.
	 */
	Optional<String> blockFor(String page, String reader) {
		Matcher spelt = A_PAGE.matcher(page);

		if (!spelt.matches()) {
			return Optional.empty();
		}

		String number = spelt.group(1);
		Words words = Words.of(WhatACardSays.of(spelt.group(2)).orElseThrow());

		return cards.shown(number, words.card).map(shown -> {
			facebookHasRead.read(reader, new Key(number, words.code()), WhatFacebookHasRead.pageOf(number, words, shown));

			return block(number, words, shown);
		});
	}

	private String block(String number, Words words, CompetitorCards.Shown shown) {
		String name = shown.face().name();
		String title = words.title(name);
		String alt = words.alt(name);
		String image = portal.address() + shown.address();

		return String.join("\n    ", List.of(
				"<title>" + escaped(title) + "</title>",
				property("og:type", "profile"),
				property("og:site_name", SITE_NAME),
				property("og:title", title),
				property("og:url", portal.address() + profilePath(number, name, words)),
				property("og:locale", words.locale()),
				property("og:image", image),
				property("og:image:type", "image/jpeg"),
				property("og:image:width", String.valueOf(CompetitorCard.WIDTH)),
				property("og:image:height", String.valueOf(CompetitorCard.HEIGHT)),
				property("og:image:alt", alt),
				named("twitter:card", "summary_large_image"),
				named("twitter:title", title),
				named("twitter:image", image),
				named("twitter:image:alt", alt))) + "\n";
	}

	/**
	 * THE ADDRESS OF THE PROFILE, as {@code profilePath} in {@code frontend/src/pages/profileAddress.ts}
	 * writes it: the number, and the name behind it spelt by {@code slugify}, or the number alone
	 * when the name spells nothing. {@link EventAddress#written} is the portal's server copy of
	 * {@code slugify}, held to it by {@code EventAddressTest}.
	 */
	static String profilePath(String number, String name, Words words) {
		String spelt = EventAddress.written(name);

		return "/" + words.code() + "/takmicar/" + (spelt.isEmpty() ? number : number + "-" + spelt);
	}

	private static String property(String key, String value) {
		return "<meta property=\"" + key + "\" content=\"" + escaped(value) + "\" />";
	}

	private static String named(String key, String value) {
		return "<meta name=\"" + key + "\" content=\"" + escaped(value) + "\" />";
	}

	private static String escaped(String value) {
		return HtmlUtils.htmlEscape(value, StandardCharsets.UTF_8.name());
	}
}
