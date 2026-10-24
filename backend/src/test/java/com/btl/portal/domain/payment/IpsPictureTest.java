package com.btl.portal.domain.payment;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * THE CODE IN THE PICTURE CARRIES, BYTE FOR BYTE, WHAT THE PAGE'S CODE CARRIES.
 *
 * <p>The page writes its code as UTF-8, at level M, with nothing in front of the data
 * ({@code QrCode.tsx}). Read back off the pixels, this one has to be the same three things: the
 * UTF-8 bytes of the slip and nothing else, level M, and no ECI segment ({@code ]Q1}). The last is
 * the one a careless fix undoes: naming UTF-8 to ZXing as its character set gives a code that reads
 * the same text and carries a segment the page's does not.
 */
class IpsPictureTest {

	private static final String SLIP = IpsSlip.payload(2027, new BigDecimal("3600"));

	@Test
	void theCodeCarriesTheUtf8OfTheSlipAtLevelMWithNothingInFrontOfIt() throws Exception {
		ReadingTheCode.Read read = ReadingTheCode.in(IpsPicture.png(SLIP,
				List.of("IPS QR kod za uplatu", "Članarina za 2027. godinu", "3.600,00 RSD")));

		assertThat(read.bytes()).isEqualTo(SLIP.getBytes(StandardCharsets.UTF_8));
		assertThat(read.level()).isEqualTo("M");
		assertThat(read.symbology())
				.as("the code carries an ECI segment the page's code does not")
				.isEqualTo("]Q1");
	}

	/**
	 * THE THREE LINES ARE UNDER THE CODE, and the picture is taller than it is wide by exactly the room
	 * they take. Without them it would be square, which is what the case measures: the owner chose a
	 * picture with words under the code.
	 */
	@Test
	void thereIsRoomUnderTheCodeForTheLinesAndInkInIt() throws Exception {
		BufferedImage withLines = ImageIO.read(new ByteArrayInputStream(IpsPicture.png(SLIP,
				List.of("IPS QR kod za uplatu", "Članarina za 2027. godinu", "3.600,00 RSD"))));
		BufferedImage without = ImageIO.read(new ByteArrayInputStream(IpsPicture.png(SLIP, List.of())));

		assertThat(without.getHeight()).isLessThan(withLines.getHeight());
		assertThat(withLines.getWidth()).isEqualTo(without.getWidth());

		boolean ink = false;

		for (int y = without.getHeight(); y < withLines.getHeight() && !ink; y++) {
			for (int x = 0; x < withLines.getWidth() && !ink; x++) {
				ink = (withLines.getRGB(x, y) & 0xFFFFFF) != 0xFFFFFF;
			}
		}

		assertThat(ink).as("nothing was written under the code").isTrue();
	}

	@Test
	void aSlipNoCodeCanHoldIsRefusedAndNotDrawnShort() {
		assertThatThrownBy(() -> IpsPicture.png("x".repeat(4000), List.of()))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("too long");
	}
}
