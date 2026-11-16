package com.btl.portal.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;

/**
 * THE ONE PLACE THE SERVER SPEAKS TO FACEBOOK: it asks Facebook to read a page of the portal again.
 *
 * <p>Owner, PDL P11, 15.11.2026, item 10: „Facebook se osvežava sa servera: posle svake promene koja menja karticu
 * server traži od Facebooka da ponovo pročita profil", and on 15.11.2026 („Evo ti odmah da") the owner approved the
 * Facebook application and its key on the server. The request is the one the owner's measurement of 16.11.2026 made
 * against the front page: a {@code POST} to the Graph API with the address, {@code scrape=true} and the access
 * token of the application, which Facebook answers by reading the page as it stands and keeping that.
 *
 * <p><b>THE KEY IS NEVER IN THE REPOSITORY.</b> The application's id and secret come from the environment
 * ({@code BTL_FACEBOOK_APP_ID} and {@code BTL_FACEBOOK_APP_SECRET}, which {@code deploy/compose.prod.yml} fills
 * from {@code PROD_FACEBOOK_APP_ID} and {@code PROD_FACEBOOK_APP_SECRET} in {@code /opt/btl/deploy/.env}), and
 * the token they make, {@code id|secret}, which is the application token Facebook documents, goes in the BODY of
 * the request and never in its address, so no log of any proxy and no line of this class carries it. What this
 * class logs is scrubbed of it first ({@link #scrubbed}), because the one thing it logs that it did not write is
 * what Facebook answered.
 *
 * <p><b>WITHOUT BOTH OF THEM IT IS OFF, AND THEN NOTHING LEAVES THE SERVER.</b> QA has no Facebook
 * ({@code deploy/compose.qa.yml} sets both to nothing on purpose, because QA sits behind a password Facebook cannot
 * pass), a developer's machine has none, and neither has the test suite unless a case gives it one. Half a pair,
 * an id without its secret, is off too, and says so once at start.
 *
 * <p><b>NOTHING HERE CAN SLOW OR STOP ANYBODY.</b> It is called by {@link FacebookIsAskedToReadAChangedCard}, which
 * runs on its own, and by {@link WhatFacebookHasRead} after a deletion has committed (owner, PDL P11, 16.11.2026,
 * item 14), when the member or the administrator has nothing left to wait for and nothing left to fail; the request
 * is sent without waiting for it ({@link HttpClient#sendAsync}), it has a term ({@code btl.facebook.wait-millis}), and what goes wrong,
 * an answer that is not a success, a term run out or a connection refused, is logged and goes no further. The
 * future it returns never fails, so nothing that waits on it can be thrown at.
 */
@Component
class FacebookGraph {

	private static final Logger LOG = LoggerFactory.getLogger(FacebookGraph.class);

	/** How much of an answer that is not a success is logged. */
	private static final int AT_MOST_LOGGED = 300;

	/** What the log calls the page of a member who has just been deleted, in place of its address. */
	static final String A_DELETED_MEMBERS_PAGE = "the page of a deleted member";

	private final String secret;
	private final String token;
	private final URI graph;
	private final Duration term;
	private final HttpClient client;

	/**
	 * @param graph where the Graph API answers; Facebook's own address everywhere but in a case, which hands in a
	 *              server of its own on this machine
	 * @param waitMillis how long a request may take before it is given up on
	 */
	FacebookGraph(@Value("${btl.facebook.app-id:}") String appId,
			@Value("${btl.facebook.app-secret:}") String appSecret,
			@Value("${btl.facebook.graph:https://graph.facebook.com}") String graph,
			@Value("${btl.facebook.wait-millis:20000}") long waitMillis) {
		boolean hasId = !appId.isBlank();
		boolean hasSecret = !appSecret.isBlank();

		if (hasId != hasSecret) {
			LOG.warn("Facebook is off: only one of the application's id and secret is set");
		}

		this.secret = appSecret.strip();
		this.token = hasId && hasSecret ? appId.strip() + "|" + this.secret : null;
		this.graph = URI.create(graph).resolve("/");
		this.term = Duration.ofMillis(waitMillis);
		this.client = HttpClient.newBuilder().connectTimeout(term).build();
	}

	/** Whether the server may speak to Facebook at all. */
	boolean isOn() {
		return token != null;
	}

	/**
	 * ASKS FACEBOOK TO READ THIS ADDRESS AGAIN, without waiting for the answer. Off, it sends nothing. The future
	 * completes when Facebook has answered or the term has run out, and it never completes with a failure.
	 *
	 * @param address the whole address of a page of the portal, host included
	 */
	CompletableFuture<Void> readAgain(String address) {
		return asked(address, address, true);
	}

	/**
	 * THE SAME REQUEST FOR THE PAGE OF A MEMBER WHO HAS JUST BEEN DELETED, AND THE LOG NAMES NEITHER THE PAGE NOR WHAT
	 * FACEBOOK ANSWERED. The address carries his name, and the owner, PDL P11, 16.11.2026, item 14: the name is kept
	 * not a minute after the deletion, which a line of the log is a place to keep it in; what Facebook answers to a
	 * page it could not read may name the page too. So the log says what happened, and to a deleted member's page.
	 *
	 * @param address the whole address of a page of the portal, host included
	 */
	CompletableFuture<Void> readAgainUnnamed(String address) {
		return asked(address, A_DELETED_MEMBERS_PAGE, false);
	}

	private CompletableFuture<Void> asked(String address, String named, boolean answerLogged) {
		if (!isOn()) {
			return CompletableFuture.completedFuture(null);
		}

		HttpRequest request = HttpRequest.newBuilder(graph)
				.timeout(term)
				.header("Content-Type", "application/x-www-form-urlencoded")
				.POST(HttpRequest.BodyPublishers.ofString("id=" + encoded(address) + "&scrape=true&access_token="
						+ encoded(token)))
				.build();

		return client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
				.handle((answer, failed) -> {
					if (failed != null) {
						LOG.warn("Facebook was not reached to read {} again: {}", named, scrubbed(failed.toString()));
					} else if (answer.statusCode() / 100 != 2) {
						LOG.warn("Facebook did not read {} again: {} {}", named, answer.statusCode(),
								answerLogged ? scrubbed(answer.body()) : "");
					} else {
						LOG.info("Facebook read {} again", named);
					}

					return null;
				});
	}

	/**
	 * The text without the secret, which is the part of the token that is one (the id is public, it is in every
	 * page Facebook shows of the application), and no longer than a line of the log.
	 */
	private String scrubbed(String text) {
		String without = text.replace(secret, "[secret]");

		return without.length() > AT_MOST_LOGGED ? without.substring(0, AT_MOST_LOGGED) + "..." : without;
	}

	private static String encoded(String text) {
		return URLEncoder.encode(text, StandardCharsets.UTF_8);
	}
}
