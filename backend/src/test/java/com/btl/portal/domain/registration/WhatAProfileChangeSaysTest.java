package com.btl.portal.domain.registration;

import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.registration.WhatAProfileChangeSays.Change;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class WhatAProfileChangeSaysTest {

	@Test
	void everyChangeHasItsWordsAndEveryWordHasAChange() {
		Set<String> expected = Arrays.stream(Change.values())
				.flatMap(one -> Arrays.stream(new String[] {one.word() + ".subject", one.word() + ".body"}))
				.collect(Collectors.toSet());

		assertThat(WhatAProfileChangeSays.words().keySet())
				.as("the words and the changes no longer name the same things")
				.isEqualTo(expected);
	}

	@Test
	void whatItSays() {
		Said picture = WhatAProfileChangeSays.about(Change.PICTURE);
		Said words = WhatAProfileChangeSays.about(Change.WORDS);

		assertThat(picture.subject()).isEqualTo("Promenjena je vaša profilna slika");
		assertThat(picture.body()).isEqualTo("Administracija lige je promenila vašu profilnu sliku. Nova slika već"
				+ " stoji na vašem profilu.\n\nBalkanska trkačka liga");
		assertThat(WhatAProfileChangeSays.about(Change.PICTURE_REMOVED).body()).isEqualTo("Administracija lige je"
				+ " uklonila vašu profilnu sliku. Novu možete da pošaljete na kartici Podaci svog profila.\n\n"
				+ "Balkanska trkačka liga");
		assertThat(words.subject()).isEqualTo("Promenjen je vaš tekst o sebi");
		assertThat(words.body()).isEqualTo("Administracija lige je promenila vaš tekst o sebi. Promena već stoji"
				+ " na vašem profilu.\n\nBalkanska trkačka liga");
	}

	@Test
	void noneCarriesALinkOrAHole() {
		for (Change one : Change.values()) {
			Said said = WhatAProfileChangeSays.about(one);

			assertThat(said.subject() + "\n" + said.body()).as(one.name()).doesNotContain("://").doesNotContain("{");
		}
	}
}
