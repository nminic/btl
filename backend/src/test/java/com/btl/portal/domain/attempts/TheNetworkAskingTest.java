package com.btl.portal.domain.attempts;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class TheNetworkAskingTest {

	@Test
	void anIpv4AddressIsItself() {
		assertThat(TheNetworkAsking.of("198.51.100.7")).contains("198.51.100.7");
		assertThat(TheNetworkAsking.of("198.51.100.8")).contains("198.51.100.8");
	}

	@Test
	void anIpv6AddressIsTheNetworkOfItsFirstSixtyFourBits() {
		assertThat(TheNetworkAsking.of("2001:db8:1:2::a")).contains("2001:db8:1:2::/64");
		assertThat(TheNetworkAsking.of("2001:DB8:1:2:ffff:ffff:ffff:ffff")).contains("2001:db8:1:2::/64");
		assertThat(TheNetworkAsking.of("2001:db8:1:3::a")).contains("2001:db8:1:3::/64");
		assertThat(TheNetworkAsking.of("abcd:ef01:2345:6789::1")).contains("abcd:ef01:2345:6789::/64");
	}

	@Test
	void anIpv4AddressWrittenAsIpv6IsTheIpv4AddressItCarries() {
		assertThat(TheNetworkAsking.of("::ffff:198.51.100.7")).contains("198.51.100.7");
	}

	@ParameterizedTest
	@ValueSource(strings = {"", "unknown", "localhost", "1.2.3.4.5", "999.1.1.1", "1.2.3", "::::", "1:2:3",
			"fe80::1%eth0", "dead:beef", "198.51.100.7, 203.0.113.9"})
	void textThatIsNotAnAddressIsNotOne(String written) {
		assertThat(TheNetworkAsking.of(written)).isEmpty();
	}

	@Test
	void andNeitherIsNothing() {
		assertThat(TheNetworkAsking.of(null)).isEmpty();
	}

}
