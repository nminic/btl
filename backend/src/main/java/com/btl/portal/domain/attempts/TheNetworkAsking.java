package com.btl.portal.domain.attempts;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * WHAT ONE "IP ADDRESS" IS WHEN REGISTRATIONS ARE COUNTED BY IT.
 *
 * <p><b>An IPv4 address is itself; an IPv6 address is its network of the first 64 bits.</b> Decided
 * 21.11.2026 (owner, through the coordinator: „IPv6 se broji po mreži /64"). A home connection is
 * handed a whole /64, so the machine behind it can take a new address out of it for every request;
 * counted by the full address, five registrations an hour would be five per address and therefore no
 * limit at all for anybody with IPv6.
 *
 * <p><b>Only an address WRITTEN AS ONE is read, never a name, and that is measured rather than
 * assumed.</b> {@link InetAddress#getByName} asks DNS about anything it does not recognise as a
 * literal. Measured 21.11.2026 on JDK 21: {@code 1.2.3.4.5} and {@code 999.1.1.1} went to the
 * resolver („No such host is known"), while every text holding a colon was refused on the spot as an
 * invalid IPv6 literal, {@code ::::} and {@code 1:2:3} among them. So a dotted text is read only when
 * it is four numbers of at most 255, and any other text only when it holds a colon and nothing but
 * the characters of an IPv6 literal. A scoped address ({@code fe80::1%eth0}) is not one: the
 * {@code %} is not among them.
 */
public final class TheNetworkAsking {

	private static final String AN_OCTET = "(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])";

	private static final Pattern AN_IPV4_LITERAL = Pattern.compile(
			AN_OCTET + "\\." + AN_OCTET + "\\." + AN_OCTET + "\\." + AN_OCTET);

	private static final Pattern AN_IPV6_LITERAL = Pattern.compile("[0-9A-Fa-f.]*:[0-9A-Fa-f:.]{1,44}");

	private TheNetworkAsking() {
	}

	/**
	 * The key a registration from {@code written} is counted by, or nothing when {@code written} is
	 * not an address.
	 */
	public static Optional<String> of(String written) {
		if (written == null
				|| !(AN_IPV4_LITERAL.matcher(written).matches() || AN_IPV6_LITERAL.matcher(written).matches())) {

			return Optional.empty();
		}

		InetAddress address;

		try {
			address = InetAddress.getByName(written);
		} catch (UnknownHostException notAnAddress) {
			return Optional.empty();
		}

		if (address instanceof Inet4Address) {
			return Optional.of(address.getHostAddress());
		}

		/* THE FIRST FOUR GROUPS, written out by hand rather than handed back to `InetAddress`, whose
		   `getByAddress` declares an exception no 16 byte array can raise. */
		byte[] bytes = address.getAddress();
		StringBuilder network = new StringBuilder();

		for (int group = 0; group < 4; group++) {
			network.append(Integer.toHexString(((bytes[2 * group] & 0xff) << 8) | (bytes[2 * group + 1] & 0xff)))
					.append(':');
		}

		return Optional.of(network.append(":/64").toString());
	}

}
