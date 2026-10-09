package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * AN ACTIVE MEMBER, OR THE ADMINISTRATION: THE ONE RULE FOR WHO READS WHAT THE LEAGUE KEEPS
 * FOR ITS OWN, ASKED IN ONE PLACE.
 *
 * <p><b>Where the rule comes from, in the words of the record.</b> The owner chose it between
 * offered outcomes on 03.10.2026, for the list of who is going to an event, and PDL records the
 * choice as: „Najavu dolaska daju i spisak najavljenih vide aktivni članovi (važeća članarina), a
 * spisak vidi i administracija; isto kao za skriven profil (P23, odeljak 18)." The section it
 * points at, supplemented the same day by a choice of the same kind, names who the
 * administration is: „skriven profil vide samo clanovi aktivirani za sezonu i administracija
 * (moderatori i superadmin)". Both are PDL's sentences and not the owner's own words; the
 * choices are his. So the same reader is asked about on three
 * subjects, and this class is written as the home all of them read, rather than as a
 * condition inside the first of them that the others would have to copy. The list of who is
 * going reads it ({@link AttendanceApi}, {@link AttendanceWriteApi}), and since 03.10.2026 so
 * does the hidden profile: {@link CompetitorApi} asks it for the biography, the portrait and the
 * link to the team of a member who hides his profile, {@link TeamApi} asks it with the answer
 * turned over, and {@link PhotoApi} asks it for the bytes of that portrait.
 *
 * <p><b>The comments on an event are the third subject, by the same entry of the record.</b> PDL
 * names the reader in one line, „Komentare vide aktivni članovi i administracija, isto kao najava
 * dolaska i skriven profil od 03.10.2026; nalog bez važeće članarine ih ne vidi" (PDL P6,
 * 03.10.2026, „Komentare vide aktivni članovi i administracija, isto kao najava dolaska"), and
 * {@link CommentApi} asks this class for the whole list: the two halves of the question below are
 * the same two it is asked on the other doors.
 *
 * <p><b>THE TWO HALVES ARE TWO QUESTIONS, AND A ROUTE MAY NEED ONLY ONE OF THEM.</b> Reading the
 * list is granted to either; SAYING that you are going is granted to the first alone, because
 * an announcement is a row about a member and the administration as such is nobody's member
 * (V23: an account may race for nobody, „the ordinary case and not a fault"). So the member is
 * handed back as the key the row is written under, and not folded into a yes or no.
 *
 * <p><b>ACTIVE MEANS {@code competitor.active}, THE MEMBER NOW, AND NOT A ROW OF
 * {@code membership}.</b> V22 says what the flag answers in its own words - „one boolean with
 * no season in it. It answers "is he a member NOW"" - and it is the fact every other reader of
 * „active" on this server reads: {@link CompetitorApi}'s {@code where c.active}, which is the
 * list a member who has lapsed is not on at all, and the condition {@link PairWriteApi} and
 * {@link TeamJoiningWriteApi} put on the caller, {@code where id = ? and active}, which this
 * asks in the same words. A row of
 * {@code membership} for some season is a different question, and asking it here would let
 * this answer and the public list of members disagree about the same man - the difference
 * PDL's rule of 13.09.2026 forbids, „Nijedan javni odgovor ne sme da imenuje člana kome je
 * članarina istekla, ni posredno".
 *
 * <p><b>THE ADMINISTRATION IS READ OFF THE ROLE'S {@code rights_mode}, and the role is the one
 * {@link WhoIsAsking} decided.</b> V5 gives every role a mode, {@code none} for the visitor and
 * the competitor, {@code granted} for the moderator and {@code all} for the superadmin, so
 * „a role that can hold a right at all" is exactly „moderatori i superadmin" - a moderator with
 * no box ticked included, because the record names the people and not their boxes. Read as
 * the two role names it would be a second home for which roles those are, which is the reason
 * {@link OnlyTheSuperadmin} gives for reading the mode as well. And the role comes off the
 * principal and never off {@code account.role_id}: the superadmin may be named by an address
 * in the server's settings while his row says {@code competitor}, and {@link WhatHeMayDo}
 * records what reading the row cost the one time it was done.
 */
@Component
class ActiveMemberOrAdministration {

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	ActiveMemberOrAdministration(JdbcClient db, MemberOfAccount memberOfAccount) {
		this.db = db;
		this.memberOfAccount = memberOfAccount;
	}

	/**
	 * Whether whoever is asking is either: a member whose fee is standing, or the
	 * administration.
	 *
	 * <p><b>Nobody is a reader who is neither, and is answered no.</b> The hidden profile is
	 * asked about on routes open to anybody ({@code ApiSecurity.READ_BY_ANYBODY} and its sibling for
	 * pictures), where Spring hands a parameter of this type nothing when the principal is the
	 * anonymous token, so a visitor arrives here as {@code null}. Left to the two questions below,
	 * {@code null} would be a {@link NullPointerException} on {@code asking.role()} and the visitor
	 * would be answered 500 rather than what he is answered today. The routes that ask about who
	 * is going and about the comments stand behind a session and never meet it. It is guarded here
	 * and not at the three new call sites so that the guard has one home, and the visitor's case on
	 * each of the three routes is what holds it.
	 *
	 * @param asking read off the session, never off anything the caller sent; {@code null} for
	 *               a request that carries none
	 */
	boolean includes(WhoIsAsking.Member asking) {
		return asking != null && (isTheAdministration(asking) || activeMember(asking).isPresent());
	}

	/**
	 * THE MEMBER THIS ACCOUNT NAMES, WHERE HIS FEE IS STANDING, AND NOTHING OTHERWISE.
	 *
	 * <p>Nothing for an account that names no member (the moderator who does not race), for a
	 * member whose fee has lapsed, and for somebody who registered and has never paid - all
	 * three are one answer, because none of them is somebody this rule lets act.
	 *
	 * @param asking read off the session, never off anything the caller sent
	 * @return {@code competitor.id}, which is the key a row about him is written under
	 */
	Optional<Long> activeMember(WhoIsAsking.Member asking) {
		Long his = memberOfAccount.competitorId(asking.account());

		if (his == null) {
			return Optional.empty();
		}

		return db.sql("select id from competitor where id = ? and active")
				.param(his)
				.query(Long.class)
				.optional();
	}

	/**
	 * Whether the role this request carries is a role that can hold a right at all: a
	 * moderator, ticked or not, or the superadmin.
	 */
	private boolean isTheAdministration(WhoIsAsking.Member asking) {
		return db.sql("select rights_mode <> 'none' from role where code = ?")
				.param(asking.role())
				.query(Boolean.class)
				.single();
	}
}
