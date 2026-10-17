package com.btl.portal.web;

import com.btl.portal.domain.mail.MailLanguage;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

/**
 * A MEMBER CHOOSES THE LANGUAGE HIS MAIL IS WRITTEN IN.
 *
 * <p><b>The owner, PDL P18, 03.10.2026, choosing between the outcomes put to him:</b> the screen
 * does not remember a language, because the address carries it, but „član u profilu bira jezik
 * mejlova, podrazumevano srpski" (the record's wording). The privacy policy has promised it since
 * V57. Where the choice lives and what reads it is {@link MailLanguage} and V59; this is the one
 * road that changes it after registration, which sets it first (owner, 10.10.2026, Q1).
 *
 * <p><b>WHO MAY, AND THAT IS A DERIVATION RATHER THAN A SENTENCE OF THE OWNER'S, SO IT IS NAMED.</b>
 * The decision speaks of a MEMBER choosing in his PROFILE, so an account that names no member is
 * answered as an address that is not there (ADL A8, 401 and 404). And it is not on the list of what
 * a member who has not paid may do (PDL P8, 10.10.2026, „Sme: izbor kategorije i plaćanje, lozinku,
 * adresu pošte i svoje podatke za evidenciju i majicu"), so the older line of the same entry holds,
 * „Pre plaćanja član ... ne može ništa da radi u sistemu", which is the derivation
 * {@code NoWriteTakesAMemberWhoHasNotPaidTest} already writes beside {@code POST /api/inbox/{id}/read}.
 * A member whose fee stands may change it; nobody else may. Widening it to a member who has not paid
 * is the owner's to decide, and the registration already gives him the language of the page he
 * joined on.
 *
 * <p><b>No path variable, so there is nobody else's row to name.</b> The account written is the one
 * the session belongs to, read off {@link WhoIsAsking.Member} and never off the request, which is
 * the reason the resource is under {@code /api/me}.
 *
 * <p><b>What an omitted field means here, which ADL A54 requires every write route to say:</b> it
 * is REFUSED, with the shape and the word {@link MeCategoryWriteApi} uses for its one field and for
 * the same reason - a form of one field that may be left out is a request to do nothing answered as
 * a success. A code that is not one of the two languages is refused the same way, since it is the
 * same field not filled in with anything the portal can write in.
 */
@RestController
class MeMailLanguageApi {

	/** The one field, not sent or not a language: {@link MeCategoryWriteApi}'s word for it. */
	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	private final JdbcClient db;

	/** Who is asking, and whether his fee stands: the one question this route opens with. */
	private final ActiveMemberOrAdministration readers;

	MeMailLanguageApi(JdbcClient db, ActiveMemberOrAdministration readers) {
		this.db = db;
		this.readers = readers;
	}

	/**
	 * WHAT ARRIVES: the language, by the two letters the page names itself by.
	 *
	 * @param language {@code sr} or {@code en}
	 */
	record Chosen(String language) {
	}

	/**
	 * The choice as it now stands, as the statement that wrote it returns it.
	 *
	 * <p>It is the same value as the code that arrived, by construction: only a code
	 * {@link MailLanguage} knows reaches the update, and the column stores it as it is. So reading it
	 * back and echoing the request answer alike, and no case can tell them apart (measured: the
	 * mutation that echoes passes every case). It is read back so that the answer is the row's, the
	 * day the write stops being a plain copy.
	 */
	record Stands(String language) {
	}

	/** The refusal, saying which field: {@link MeCategoryWriteApi.NotComplete}'s shape. */
	record NotComplete(String reason, List<String> missing) {
	}

	/**
	 * @param asking who the chain decided is asking; never null, because the chain answers 401
	 *               before this method runs
	 * @param sent   the body, not read until „is he a member whose fee stands" is answered, so a
	 *               caller this is not for is told nothing about what a body here should look like
	 */
	@PutMapping(path = "/api/me/mail-language", consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<?> choose(@AuthenticationPrincipal WhoIsAsking.Member asking,
			WhatWasSent<Chosen> sent) throws IOException {

		if (readers.activeMember(asking).isEmpty()) {
			throw nothingIsHere();
		}

		Chosen typed = sent.read();
		Optional<MailLanguage> language = typed == null || typed.language() == null
				? Optional.empty()
				: MailLanguage.of(typed.language());

		if (language.isEmpty()) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST)
					.body(new NotComplete(THE_FORM_IS_NOT_COMPLETE, List.of("language")));
		}

		/* THE ACCOUNT OF THE SESSION AND NO OTHER. */
		String stands = db.sql("update account set mail_language = ? where id = ?"
						+ " returning mail_language")
				.params(language.get().code(), asking.account())
				.query(String.class)
				.single();

		return ResponseEntity.ok(new Stands(stands));
	}

	/**
	 * THE ANSWER FOR SOMEBODY THIS ADDRESS IS NOT FOR, which carries nothing at all and goes down
	 * the road an address that maps nothing goes down ({@code sendError}, through
	 * {@link ResponseStatusException}). Made here and thrown at the call site, for the reason
	 * {@code MePasswordApi} gives: a line whose call never comes back is counted as not run.
	 */
	private static ResponseStatusException nothingIsHere() {
		return new ResponseStatusException(HttpStatus.NOT_FOUND);
	}
}
