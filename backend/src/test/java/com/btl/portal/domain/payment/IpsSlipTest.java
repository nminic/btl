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
			assertThat(IpsSlip.payload(one.get("season").asInt(), one.get("amountRsd").decimalValue()))
					.isEqualTo(one.get("payload").asText());
		}
	}

	@Test
	void theAccountAndThePayeeAreWrittenAsTheOwnersTextWritesThem() {
		assertThat(IpsSlip.accountAsWritten()).isEqualTo("105-0000000003284-71");
		assertThat(IpsSlip.recipientAsWritten())
				.isEqualTo("Sportsko udruženje BTL, Bulevar Arsenija Čarnojevića 77, 11070 Novi Beograd");
		assertThat(IpsSlip.purpose(2027)).isEqualTo("Članarina za 2027. godinu");
	}
}
