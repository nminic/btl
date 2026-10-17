package com.btl.portal.web;

import com.btl.portal.domain.mail.MailLanguage;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

/**
 * WHOEVER HOLDS AN ACCOUNT CHOOSES THE LANGUAGE HIS MAIL IS WRITTEN IN.
 *
 * <p><b>The owner, PDL P18, 03.10.2026, choosing between the outcomes put to him:</b> the screen
 * does not remember a language, because the address carries it, but „član u profilu bira jezik
 * mejlova, podrazumevano srpski" (the record's wording). The privacy policy has promised it since
 * V57. Where the choice lives and what reads it is {@link MailLanguage} and V59; this is the one
 * road that changes it after registration, which sets it first (owner, 10.10.2026, Q1).
 *
 * <p><b>WHO MAY: EVERY ACCOUNT, and that is the owner's choice of 17.10.2026 among the outcomes
 * put to him</b> (PDL, „Odgovori vlasnika 17.10.2026, jezik pošte", in the record's wording: „Jezik
 * pošte sme da promeni svako ko ima nalog, i član bez plaćene članarine i član kome je istekla, jer je
 * to podešavanje naloga a ne takmičarsko pravo"). So the fee is not asked, and neither is whether the
 * account names a member at all: a moderator who does not race has an address and is written to, so
 * he chooses the language of what he is written. A caller who is not signed in is 401 from the chain
 * (ADL A8). The outcomes refused were a member whose fee stands and nobody else, which this route
 * carried until that day by derivation, and „a member who never paid yes, a lapsed one no".
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

	MeMailLanguageApi(JdbcClient db) {
		this.db = db;
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
	 * @param sent   the body, read by the handler rather than bound, the shape every write route
	 *               of the portal takes ({@link WhatWasSent})
	 */
	@PutMapping(path = "/api/me/mail-language", consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<?> choose(@AuthenticationPrincipal WhoIsAsking.Member asking,
			WhatWasSent<Chosen> sent) throws IOException {

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

}
