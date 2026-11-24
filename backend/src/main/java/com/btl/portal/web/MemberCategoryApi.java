package com.btl.portal.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.List;

/**
 * THE ADMINISTRATION CHOOSES A MEMBER'S CATEGORY ON HIS CARD „PODACI".
 *
 * <p>Owner, 24.11.2026 (PDL, „Administracija bira kategoriju članu u njegovim podacima, a u prijavi je
 * starosna podrazumevana"): „Ma hocu da imam izbor u podacima clana koje vidim sa njegove strane (edit, ili
 * kad sa profila kliknem na podaci)". Offered and not chosen: „javi mi člana, ja prebacim u bazi". The rule
 * beside it is the assistant's derivation, written as such in the journal: „Izbor u podacima člana radi po
 * istim pravilima kao članov izbor na „Mojoj članarini” (sezona u prodaji, portal proverava pravo na
 * početničku, isti rok), a poruku šalje ili ne šalje po presedanu ostalih polja te forme kad ih menja
 * administracija." So:
 *
 * <ul>
 * <li><b>The same rules are the same code</b>: the read is {@link TheChoiceAsItStands#of}, the very answer
 * {@code GET /api/me/category} gives, and the write is {@link ACategoryIsChosen#choose}, the very write
 * {@code PUT /api/me/category} makes. The body, its refusal and the deadline's 409 are
 * {@link MeCategoryWriteApi}'s own records and words, so one screen reads both routes alike.</li>
 * <li><b>A wish for the beginners' category with no right behind it is accepted here as it is there</b>, and
 * answered with the age band it turns into (PDL P7, 26.09.2026, „Ono što se čuva je ŽELJA, ne kategorija":
 * „stanje „sačuvan izbor na koji član nema pravo” ne može ni da nastane"). The screen offers the option only
 * where it is open, with the member's own sentence why not ({@link MeCategoryWriteApi} carries the reasoning).</li>
 * <li><b>The right to it is the right to the rest of the card</b>: {@link CompetitorApi#OVER_THE_MEMBERS} at
 * the door, so a moderator without it and anybody signed in without it is answered 404 (ADL A8), and a
 * moderator over his own record is answered 404 too, the superadmin not
 * ({@link MemberDataWriteApi#hisOwnAndHeIsNotTheSuperadmin}, „moderator ne ispravlja svoj zapis").</li>
 * <li><b>AND IT SENDS NO MESSAGE, to him or to anybody.</b> Owner, 24.11.2026, doslovno: „Neka idu bez
 * poruke.” That struck the assistant's derivation „po presedanu ostalih polja te forme": the other fields of
 * the card still tell him in his inbox ({@code WhatADataCorrectionSays}, PDL M7), and the category does not.
 * It is the same shape as the owner's own corrections of 12.11, 14.11 and 24.11.2026, each written „tiho,
 * bez poruke".</li>
 * </ul>
 *
 * <p><b>Only the member with a number</b>: the card „Podaci" of a profile is reached by it, from the pencil
 * on the screen of the members and from the profile. The form for somebody who registered and has no number
 * yet (the screen Uplate, {@link MemberDataApi#UNNUMBERED}) is not named by the owner's sentence and has no
 * box for it; that is a boundary of this route and not a decision.
 */
@RestController
class MemberCategoryApi {

	private final MemberDataApi data;

	private final TheChoiceAsItStands theChoice;

	private final ACategoryIsChosen chosen;

	private final MemberOfAccount memberOfAccount;

	private final WhatHeMayDo mayHe;

	private final ObjectMapper json;

	MemberCategoryApi(MemberDataApi data, TheChoiceAsItStands theChoice, ACategoryIsChosen chosen,
			MemberOfAccount memberOfAccount, WhatHeMayDo mayHe, ObjectMapper json) {

		this.data = data;
		this.theChoice = theChoice;
		this.chosen = chosen;
		this.memberOfAccount = memberOfAccount;
		this.mayHe = mayHe;
		this.json = json;
	}

	/** The choice as it stands for him, the answer {@code GET /api/me/category} gives him. */
	@GetMapping("/api/members/{memberNumber}/category")
	@RightIsNeeded(CompetitorApi.OVER_THE_MEMBERS)
	ResponseEntity<MeCategoryApi.Choice> read(@PathVariable String memberNumber) {
		return data.numbered(memberNumber)
				.map(theChoice::of)
				.map(ResponseEntity::ok)
				.orElseGet(() -> ResponseEntity.notFound().build());
	}

	/**
	 * <p><b>The body is read as BYTES and only after „is there a member here, and is he yours to choose
	 * for" is answered</b>, for the reason {@link MeCategoryWriteApi} gives: bound as an argument, a body
	 * nobody can parse would be answered 400 before the method ran, while the same body sent about a number
	 * nobody has, or by a moderator about himself, is answered 404.
	 */
	@PutMapping(path = "/api/members/{memberNumber}/category", consumes = MediaType.APPLICATION_JSON_VALUE)
	@RightIsNeeded(CompetitorApi.OVER_THE_MEMBERS)
	ResponseEntity<?> choose(@PathVariable String memberNumber,
			@AuthenticationPrincipal WhoIsAsking.Member asking, HttpServletRequest request,
			HttpServletResponse response) throws IOException {

		Long member = data.numbered(memberNumber).orElse(null);

		if (member == null
				|| MemberDataWriteApi.hisOwnAndHeIsNotTheSuperadmin(mayHe, memberOfAccount, member, asking)) {
			response.sendError(HttpStatus.NOT_FOUND.value());
			return null;
		}

		MeCategoryWriteApi.Wish typed = read(request.getInputStream().readAllBytes());

		if (typed == null || typed.firstSeason() == null) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new MeCategoryWriteApi.NotComplete(
					MeCategoryWriteApi.THE_FORM_IS_NOT_COMPLETE, List.of("firstSeason")));
		}

		/* ONE STATEMENT AND NOTHING BESIDE IT: no message, by the owner's word of 24.11.2026 (see the head). */
		MeCategoryApi.Choice done = chosen.choose(member, typed.firstSeason());

		if (done == null) {
			return ResponseEntity.status(HttpStatus.CONFLICT)
					.body(new MeCategoryWriteApi.Refused(MeCategoryWriteApi.THE_CHOICE_IS_SHUT));
		}

		return ResponseEntity.ok(done);
	}

	/** Absent, empty and unreadable are one answer, the member's own route's principle. */
	private MeCategoryWriteApi.Wish read(byte[] sent) {
		try {
			return json.readValue(sent, MeCategoryWriteApi.Wish.class);
		}
		catch (JacksonException cannot) {
			return null;
		}
	}
}
