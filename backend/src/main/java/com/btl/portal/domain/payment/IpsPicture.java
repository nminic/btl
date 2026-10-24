package com.btl.portal.domain.payment;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;

import javax.imageio.ImageIO;
import javax.imageio.stream.ImageOutputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * THE PICTURE IN THE LETTER: THE QR CODE, AND THREE LINES OF TEXT UNDER IT.
 *
 * <p>The owner was shown {@code btl-produkt/primeri/uplatnica-qr-2027.png} on 23.10.2026 and chose
 * it: the code, and under it „IPS QR kod za uplatu", the purpose and the amount. ZXing draws the
 * code (owner, the same day, „Server crta QR kod bibliotekom ZXing"); the platform's own
 * {@link ImageIO} writes the PNG, so ZXing's {@code javase} module is not needed.
 *
 * <p><b>THE BYTES IN THE CODE ARE THE BYTES THE PAGE PUTS IN ITS OWN</b>, and getting that right
 * took one decision that is easy to undo by accident. The page writes the text as UTF-8 and nothing
 * else ({@code QrCode.tsx}: {@code stringToBytes} returns the UTF-8 encoding, level M). ZXing, told
 * the text is UTF-8 through its {@code CHARACTER_SET} hint, puts an ECI segment in front of the
 * data, which the page's code does not carry and some readers stumble over. So no character set is
 * named: the UTF-8 bytes are handed over as a string of one character per byte, which ZXing writes
 * byte for byte in its default ISO-8859-1. The data in the code is then exactly the UTF-8 of the
 * text, with nothing in front of it, as on the page. {@code IpsPictureTest} reads the code back
 * out of the picture and compares the bytes.
 */
public final class IpsPicture {

	/** Pixels to one module of the code: large enough for a telephone camera off a screen. */
	private static final int MODULE = 8;

	/** The quiet zone the QR standard asks for, four modules on every side. */
	private static final int QUIET_ZONE = 4;

	private static final int FIRST_LINE = 18;

	private static final int OTHER_LINES = 22;

	private static final int LINE_GAP = 10;

	private IpsPicture() {
	}

	/**
	 * @param payload the text of the code, as {@link IpsSlip#payload} writes it
	 * @param under   the lines under the code, the first of them in a smaller hand
	 */
	public static byte[] png(String payload, List<String> under) throws IOException {
		BitMatrix code = encoded(payload);
		int side = (code.getWidth() + 2 * QUIET_ZONE) * MODULE;
		int height = side + under.size() * (OTHER_LINES + LINE_GAP) + QUIET_ZONE * MODULE;

		BufferedImage picture = new BufferedImage(side, height, BufferedImage.TYPE_INT_RGB);
		Graphics2D pen = picture.createGraphics();

		try {
			pen.setColor(Color.WHITE);
			pen.fillRect(0, 0, side, height);
			pen.setColor(Color.BLACK);

			for (int y = 0; y < code.getHeight(); y++) {
				for (int x = 0; x < code.getWidth(); x++) {
					if (code.get(x, y)) {
						pen.fillRect((x + QUIET_ZONE) * MODULE, (y + QUIET_ZONE) * MODULE, MODULE, MODULE);
					}
				}
			}

			pen.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING,
					RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

			int baseline = side;

			for (int line = 0; line < under.size(); line++) {
				pen.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, line == 0 ? FIRST_LINE : OTHER_LINES));
				FontMetrics metrics = pen.getFontMetrics();

				baseline += metrics.getAscent();
				pen.drawString(under.get(line), (side - metrics.stringWidth(under.get(line))) / 2, baseline);
				baseline += metrics.getDescent() + LINE_GAP;
			}
		} finally {
			pen.dispose();
		}

		/* IN MEMORY, NEVER THROUGH THE PLATFORM'S TEMPORARY FILES, which is `SmallPicture`'s own
		   way of writing a picture and its reason. The `IOException` that cannot happen into memory
		   is declared rather than caught: the letter draws this inside the message it is preparing
		   (`Postman`), where whatever goes wrong is the relay's kind of failure and is answered
		   there, so there is no catch here for a line nothing can reach. */
		ByteArrayOutputStream written = new ByteArrayOutputStream();

		try (ImageOutputStream out = new MemoryCacheImageOutputStream(written)) {
			ImageIO.write(picture, "png", out);
		}

		return written.toByteArray();
	}

	private static BitMatrix encoded(String payload) {
		String oneCharacterPerByte = new String(payload.getBytes(StandardCharsets.UTF_8),
				StandardCharsets.ISO_8859_1);

		try {
			return new QRCodeWriter().encode(oneCharacterPerByte, BarcodeFormat.QR_CODE, 0, 0,
					Map.of(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M, EncodeHintType.MARGIN, 0));
		} catch (WriterException tooLongForAnyCode) {
			throw new IllegalArgumentException("a payment slip too long for a QR code", tooLongForAnyCode);
		}
	}
}
