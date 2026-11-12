package com.btl.portal.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;
import java.util.TreeSet;

/**
 * THE STEP AFTER A COMMIT THAT MOVED SOMEBODY'S RESULTS: HIS DUCATS ARE BROUGHT INTO LINE, AND HE IS TOLD OF
 * EVERY ONE IT WROTE THAT A RESULT BROUGHT IN FROM THE START OF AWARDING CARRIED HIM OVER.
 *
 * <p>Step four of seven of „Dukate dodeljuje verifikacija rezultata”. The owner, 08.11.2026: „normalan put
 * je računanje odmah posle svakog odobrenja, ispravke ili brisanja.” What is reconciled, what is announced
 * and in which words is {@link AwardingDucats}', in the transaction that writes the ducat; this is only
 * WHEN and WHO.
 *
 * <p><b>WHICH DUCAT IS TOLD IS NOT DECIDED HERE, and not by the door.</b> The owner, 12.11.2026: „Poruka
 * „Osvojili ste dukat” nabraja samo dukate iz rezultata odobrenih od početka dodele”, and of the job at
 * night: „Tiho ostaje samo ono što dolazi iz rezultata odobrenih pre početka dodele.” So whether a ducat is
 * announced follows the result that carried him over and not the act that ran the reconciliation, and every
 * door calls the same {@link #follow}: an approval and an entry by the league, and also a change, a
 * deletion, a race or an event moved or deleted and a season cancelled, any of which can write a ducat
 * another run left unwritten. A ducat taken away is never told („Kad se dukat oduzme, član ne dobija
 * posebnu poruku”, 08.11.2026), because what is told is only what a run WROTE.
 *
 * <p><b>ONLY EVER AFTER THE COMMIT.</b> ADL, 21.09.2026, the owner: „Verifikacija rezultata: rezultat i
 * rang liste su unutar transakcije; dukati i pošta idu posle nje.” Every caller hands its members over
 * once its own transaction has returned, the place its post already goes ({@code postAfterwards}). Called
 * from inside, the reconciliation would not see what that transaction has not committed, and where the
 * transaction holds the member's row {@code for update} (the league's save, the cancellation of a
 * season) it would wait on the very request that is waiting on it, without end: measured in review of
 * PR 705. {@code DucatsFollowTheResultsTest} holds each door to this.
 *
 * <p><b>ITS OWN FAILURE IS ITS OWN, AND ONE MEMBER'S IS NOT THE NEXT ONE'S.</b> The result is written and
 * the answer is already the caller's, so a reconciliation that cannot run is logged and nothing else, the
 * way a relay that will not take a letter is, and the members after him are reconciled all the same: any
 * {@link RuntimeException}, the road {@link DucatsAreReconciledAtNight} takes. The ducat and its message are
 * one transaction, so a failure leaves neither, and the night job writes both.
 */
@Component
class DucatsFollowTheResults {

	private static final Logger LOG = LoggerFactory.getLogger(DucatsFollowTheResults.class);

	private final AwardingDucats ducats;

	DucatsFollowTheResults(AwardingDucats ducats) {
		this.ducats = ducats;
	}

	/** One member reconciled. */
	void follow(long member) {
		follow(List.of(member));
	}

	/** Every one of them reconciled, each in a transaction of his own. */
	void follow(Collection<Long> members) {
		/* BY KEY AND ONCE EACH: a member with two results at one event is one reconciliation, and an order
		   nobody chose is the key's. */
		for (long member : new TreeSet<>(members)) {
			try {
				ducats.forMember(member);
			}
			catch (RuntimeException failed) {
				LOG.warn("the ducats of member {} were not brought into line with his results, and nothing"
						+ " was announced to him; the result stands either way, and the night job reconciles him"
						+ " again and announces what it writes", member, failed);
			}
		}
	}
}
