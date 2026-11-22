package com.btl.portal.domain.payment;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.RGBLuminanceSource;
import com.google.zxing.Result;
import com.google.zxing.ResultMetadataType;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.qrcode.QRCodeReader;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;

/**
 * THE CODE IN A PICTURE, READ BACK THE WAY A CAMERA READS IT: off the pixels, by ZXing's own reader,
 * and not off the matrix that drew it. Shared by the cases that measure the picture and the letter.
 */
public final class ReadingTheCode {

	private ReadingTheCode() {
	}

	/**
	 * @param bytes      the data the code carries, every byte segment in order
	 * @param level      its error correction level, „M" for a payment slip
	 * @param symbology  „]Q1" for a code with no ECI segment in front of its data, „]Q2" for one with
	 */
	public record Read(byte[] bytes, String level, String symbology) {
	}

	public static Read in(byte[] png) throws Exception {
		return in(png, Map.of(DecodeHintType.TRY_HARDER, Boolean.TRUE));
	}

	/**
	 * THE SYMBOL ITSELF, WITHOUT ZXING'S SEARCH FOR IT: for a picture that is nothing but a code. The search
	 * (finder and alignment patterns) is a reader's weakness that a valid symbol can meet, and it does: a
	 * payer named {@code aaaaaa} makes a code that {@link #in} cannot find and this reads without a mistake
	 * (measured 22.11.2026). A case that asks whether a symbol is valid at every length asks this.
	 */
	public static Read pure(byte[] png) throws Exception {
		return in(png, Map.of(DecodeHintType.PURE_BARCODE, Boolean.TRUE));
	}

	@SuppressWarnings("unchecked")
	private static Read in(byte[] png, Map<DecodeHintType, ?> hints) throws Exception {
		BufferedImage picture = ImageIO.read(new ByteArrayInputStream(png));
		int[] pixels = picture.getRGB(0, 0, picture.getWidth(), picture.getHeight(), null, 0, picture.getWidth());

		Result read = new QRCodeReader().decode(
				new BinaryBitmap(new HybridBinarizer(
						new RGBLuminanceSource(picture.getWidth(), picture.getHeight(), pixels))),
				hints);

		ByteArrayOutputStream bytes = new ByteArrayOutputStream();

		for (byte[] segment : (List<byte[]>) read.getResultMetadata().get(ResultMetadataType.BYTE_SEGMENTS)) {
			bytes.write(segment);
		}

		return new Read(bytes.toByteArray(),
				(String) read.getResultMetadata().get(ResultMetadataType.ERROR_CORRECTION_LEVEL),
				(String) read.getResultMetadata().get(ResultMetadataType.SYMBOLOGY_IDENTIFIER));
	}
}
