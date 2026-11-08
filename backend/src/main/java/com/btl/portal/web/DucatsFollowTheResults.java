package com.btl.portal.web;

import com.btl.portal.domain.mail.WhatAResultChangeSays;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.TransactionException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

/**
 * THE STEP AFTER A COMMIT THAT MOVED SOMEBODY'S RESULTS: HIS DUCATS ARE BROUGHT INTO LINE, AND WHERE THE
 * ACT WAS AN APPROVAL OR AN ENTRY HE IS TOLD WHAT IT WON HIM.
 *
 * <p>Step four of seven of „Dukate dodeljuje verifikacija rezultata”. The owner, 08.11.2026: „normalan put
 * je računanje odmah posle svakog odobrenja, ispravke ili brisanja.” What is reconciled and how is
 * {@link AwardingDucats}'; this is only WHEN and WHO, and the one message.
 *
 * <p><b>ONLY EVER AFTER THE COMMIT.</b> ADL, 21.09.2026, the owner: „Verifikacija rezultata: rezultat i
 * rang liste su unutar transakcije; dukati i pošta idu posle nje.” Every caller hands its members over
 * once its own transaction has returned, the place its post already goes ({@code postAfterwards}). Called
 * from inside, the reconciliation would not see what that transaction has not committed, and where the
 * transaction holds the member's row {@code for update} (the league's save, the cancellation of a
 * season) it would wait on the very request that is waiting on it, without end: measured in review of
 * PR 705. {@code DucatsFollowTheResultsTest} holds each door to this.
 *
 * <p><b>ITS OWN FAILURE IS ITS OWN.</b> The result is written and the answer is already the caller's, so
 * a reconciliation that cannot run is logged and nothing else, the way a relay that will not take a
 * letter is. The night job reconciles every member again (PDL, 08.11.2026), so a ducat missing or
 * standing over after a failure here is put right by the next night. <b>A ducat written without its
 * message is not</b>: the night job awards in silence („prolaz kroz istoriju dodeljuje tiho”), so a
 * message whose insert failed after the ducat was written is never sent. That boundary is said in the
 * log line, not only here.
 *
 * <p><b>The message.</b> The owner: „Poruka u sanduče ide samo za dukat koji donese rezultat odobren od
 * sada; prolaz kroz istoriju dodeljuje tiho.”, and „Kad se dukat oduzme, član ne dobija posebnu poruku;
 * poruku o brisanju ili ispravci rezultata ionako dobija.” So only an approval and an entry by the league
 * tell, and only of what this reconciliation WROTE ({@link AwardingDucats.Won}), never of a row another
 * writer put in first. One message per act, with every ducat the act won him, in the words the owner
 * approved on 08.11.2026 (relayed by the coordinator): „Osvojili ste dukat” and „Odobren vam je rezultat
 * sa trke {trka} od {dan}, i njime ste osvojili dukat „{ime}”. Dukat stoji na vašem profilu.” The sender
 * is the league, PDL P13, 19.09.2026: „Kad portal sam piše poruku članu, pošiljalac je naziv lige.” <b>The
 * name of a ducat stands in English quotes</b>, not in the low ones the relayed words carry: PDL, 18.10.2026,
 * „Tekst koji portal piše koristi engleske navodnike”, the whole portal and the inbox included, which
 * {@code TheQuotesAMemberReadsAreEnglishTest} holds over every string compiled into the portal.
 */
@Component
class DucatsFollowTheResults {

	private static final Logger LOG = LoggerFactory.getLogger(DucatsFollowTheResults.class);

	/** The months as a Serbian sentence names them after „za”, written out rather than asked of a locale. */
	private static final String[] MONTHS = {"januar", "februar", "mart", "april", "maj", "jun", "jul",
			"avgust", "septembar", "oktobar", "novembar", "decembar"};

	private final AwardingDucats ducats;

	private final JdbcClient db;

	DucatsFollowTheResults(AwardingDucats ducats, JdbcClient db) {
		this.ducats = ducats;
		this.db = db;
	}

	/** Who brought the result in, which is the beginning of the sentence that tells him. */
	enum Brought {
		APPROVED("Odobren vam je rezultat sa trke "),
		ENTERED("Liga vam je unela rezultat sa trke ");

		private final String opening;

		Brought(String opening) {
			this.opening = opening;
		}
	}

	/**
	 * The act that tells, and the result it was about: one race and the day it was run.
	 *
	 * @param race the race's own name, as the letter about the same result names it
	 */
	record Told(Brought by, String race, LocalDate day) {
	}

	/** Every one of them reconciled, in silence: a correction, a deletion, a race or an event moved. */
	void quietly(Collection<Long> members) {
		follow(members, null);
	}

	/** One member reconciled, in silence. */
	void quietly(long member) {
		follow(List.of(member), null);
	}

	/**
	 * Every one of them reconciled, and each told of what this wrote for him where {@code told} is not
	 * empty.
	 */
	void follow(Collection<Long> members, Told told) {
		/* BY KEY AND ONCE EACH: a member with two results at one event is one reconciliation, and an order
		   nobody chose is the key's. */
		for (long member : new TreeSet<>(members)) {
			try {
				List<AwardingDucats.Won> won = ducats.forMember(member);

				if (told != null && !won.isEmpty()) {
					tell(member, told, won);
				}
			}
			catch (DataAccessException | TransactionException failed) {
				LOG.warn("the ducats of member {} were not brought into line with his results, or what was"
						+ " written for him was not announced; the result stands either way, the night job"
						+ " reconciles him again, and a ducat written without its message stays without one",
						member, failed);
			}
		}
	}

	private void tell(long member, Told told, List<AwardingDucats.Won> won) {
		Map<String, String> names = new HashMap<>();

		db.sql("select code, name from ducat where code in (:codes)")
				.param("codes", won.stream().map(AwardingDucats.Won::code).distinct().toList())
				.query((row, one) -> names.put(row.getString(1), row.getString(2)))
				.list();

		List<String> each = new ArrayList<>();

		for (AwardingDucats.Won one : won) {
			each.add("\"" + names.get(one.code()) + "\"" + period(one));
		}

		boolean many = each.size() > 1;
		String listed = many
				? String.join(", ", each.subList(0, each.size() - 1)) + " i " + each.getLast()
				: each.getFirst();

		db.sql("insert into message (to_id, from_id, from_name, subject, body) values (?, null, ?, ?, ?)")
				.params(member, PairWriteApi.THE_LEAGUE, "Osvojili ste dukat",
						told.by().opening + told.race() + " od " + WhatAResultChangeSays.asADay(told.day())
								+ ", i njime ste osvojili " + (many ? "dukate " : "dukat ") + listed + ". "
								+ (many ? "Dukati stoje na vašem profilu." : "Dukat stoji na vašem profilu."))
				.update();
	}

	/** „ za jul 2027” for a ducat of a month, „ za sezonu 2027” for one of a season, nothing for ever. */
	private static String period(AwardingDucats.Won one) {
		if (one.month() != null) {
			return " za " + MONTHS[one.month() - 1] + " " + one.season();
		}

		return one.season() == null ? "" : " za sezonu " + one.season();
	}
}
