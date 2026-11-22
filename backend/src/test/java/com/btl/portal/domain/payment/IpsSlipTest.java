package com.btl.portal.domain.payment;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE SLIP THE SERVER WRITES IS THE ONE THE PAGE WRITES, held on the file both of them read.
 *
 * <p>{@code frontend/src/data/ipsSlipBothSidesWrite.json} holds the payee and a set of slips with the
 * text each must come out as. This requires {@link IpsSlip} to write exactly that, and
 * {@code paymentQrMatchesTheServer.test.ts} requires the page's {@code ipsPayload} to. The file is
 * pinned from both ends, so editing it to suit one side fails on the other.
 */
class IpsSlipTest {

	private static JsonNode theFileBothSidesRead() throws IOException {
		Path here = Path.of("").toAbsolutePath();

		for (Path candidate = here; candidate != null; candidate = candidate.getParent()) {
			Path file = candidate.resolve("frontend/src/data/ipsSlipBothSidesWrite.json");

			if (Files.isRegularFile(file)) {
				return new ObjectMapper().readTree(Files.readString(file, StandardCharsets.UTF_8));
			}
		}

		throw new IllegalStateException("no directory above " + here + " holds the slip both sides write");
	}

	@Test
	void thePayeeIsThePayeeThePageNames() throws IOException {
		JsonNode slip = theFileBothSidesRead();

		assertThat(IpsSlip.RECIPIENT_NAME).isEqualTo(slip.get("recipientName").asText());
		assertThat(IpsSlip.RECIPIENT_ADDRESS).isEqualTo(slip.get("recipientAddress").asText());
		assertThat(IpsSlip.RECIPIENT_ACCOUNT).isEqualTo(slip.get("account").asText());
		assertThat(IpsSlip.PAYPAL_ADDRESS).isEqualTo(slip.get("paypalAddress").asText());
	}

	@Test
	void everySlipIsWrittenAsThePageWritesIt() throws IOException {
		JsonNode slips = theFileBothSidesRead().get("slips");

		assertThat(slips.size()).as("the file holds no slip, so this compares nothing").isGreaterThan(1);

		for (JsonNode one : slips) {
			assertThat(IpsSlip.payload(one.get("season").asInt(), one.get("amountRsd").decimalValue(),
					one.get("payer").asText())).isEqualTo(one.get("payload").asText());
		}
	}

	/**
	 * THE PAYER STANDS AFTER THE AMOUNT AND BEFORE THE PAYMENT CODE, and it is the name that was
	 * handed in, not the payee's: read as fields of the text, so a name that moved or was swapped for
	 * the recipient's fails here and not only on the file.
	 */
	@Test
	void thePayerIsTheFieldBetweenTheAmountAndThePaymentCodeAndIsNotThePayee() {
		String[] fields = IpsSlip.payload(2027, new java.math.BigDecimal("3600"), "Ana Jovanović").split("\\|");

		assertThat(fields).extracting(f -> f.substring(0, f.indexOf(':')))
				.containsExactly("K", "V", "C", "R", "N", "I", "P", "SF", "S");
		assertThat(fields[6]).isEqualTo("P:Ana Jovanović");
		assertThat(fields[4]).isEqualTo("N:" + IpsSlip.RECIPIENT_NAME);
	}

	@Test
	void theNameIsTheFirstNameAndTheLastNameAndNothingElse() {
		assertThat(IpsSlip.payerName("Ana", "Jovanović")).isEqualTo("Ana Jovanović");
	}

	/** A NAME CANNOT CUT THE FIELD IN TWO: the bar and the line breaks are what the text splits on. */
	@Test
	void aBarOrALineBreakInANameBecomesASpaceAndCutsNothing() {
		assertThat(IpsSlip.payerName("Ana|SF:999", "Jo\r\nvanović")).isEqualTo("Ana SF:999 Jo  vanović");
		assertThat(IpsSlip.payload(2027, new java.math.BigDecimal("1"), IpsSlip.payerName("A|B", "C")).split("\\|"))
				.hasSize(9);
	}

	/** THE FIELD HOLDS SEVENTY CHARACTERS: a name of exactly that is kept, one more is cut, and the cut leaves no trailing space. */
	@Test
	void aNameOfSeventyCharactersIsKeptAndALongerOneIsCutThere() {
		String last = "L".repeat(70 - "Ana ".length());

		assertThat(IpsSlip.payerName("Ana", last)).hasSize(70).isEqualTo("Ana " + last);
		assertThat(IpsSlip.payerName("Ana", last + "X")).hasSize(70).isEqualTo("Ana " + last);
		assertThat(IpsSlip.payerName("A".repeat(69), "Bcd")).isEqualTo("A".repeat(69));
	}

	@Test
	void theAccountAndThePayeeAreWrittenAsTheOwnersTextWritesThem() {
		assertThat(IpsSlip.accountAsWritten()).isEqualTo("105-0000000003284-71");
		assertThat(IpsSlip.recipientAsWritten())
				.isEqualTo("Sportsko udruženje BTL, Bulevar Arsenija Čarnojevića 77, 11070 Novi Beograd");
		assertThat(IpsSlip.purpose(2027)).isEqualTo("Članarina za 2027. godinu");
	}
}
