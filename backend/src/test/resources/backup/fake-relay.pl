# A STAND-IN FOR THE MAIL RELAY, ON THE LOOPBACK OF A CONTAINER THAT HAS NO NETWORK.
#
# Used by BackupTransferTest only, to read what deploy/backup/alert.sh hands curl to send. It is
# not Brevo and does not speak TLS, so the one line of the relay's settings that requires STARTTLS
# (`ssl-reqd`) is held by the case on write-settings.sh instead, and the alert is sent here
# without it. It accepts any login.
#
#   perl fake-relay.pl <port> <folder>
#
# Every line the client sends is appended to <folder>/transcript.

use strict;
use warnings;
use IO::Socket::INET;

my ($port, $folder) = @ARGV;

my $server = IO::Socket::INET->new(LocalAddr => '127.0.0.1', LocalPort => $port, Listen => 5,
	ReuseAddr => 1) or die "cannot listen: $!";

open(my $ready, '>', "$folder/ready") or die; close($ready);

while (my $client = $server->accept) {
	binmode $client;
	$client->autoflush(1);
	print $client "220 fake-relay ESMTP\r\n";
	my $data = 0;
	my $credentials = 0;
	while (my $line = <$client>) {
		open(my $log, '>>', "$folder/transcript") or die;
		print $log $line;
		close($log);
		my $plain = $line;
		$plain =~ s/\r?\n$//;
		if ($data) {
			if ($plain eq '.') {
				$data = 0;
				print $client "250 queued\r\n";
			}
			next;
		}
		if ($credentials) {
			$credentials = 0;
			print $client "235 accepted\r\n";
			next;
		}
		if ($plain =~ /^EHLO/i) {
			print $client "250-fake-relay\r\n250 AUTH PLAIN\r\n";
		}
		elsif ($plain =~ /^AUTH PLAIN \S/i) {
			print $client "235 accepted\r\n";
		}
		elsif ($plain =~ /^AUTH PLAIN$/i) {
			$credentials = 1;
			print $client "334 \r\n";
		}
		elsif ($plain =~ /^DATA/i) {
			$data = 1;
			print $client "354 go on\r\n";
		}
		elsif ($plain =~ /^QUIT/i) {
			print $client "221 bye\r\n";
			last;
		}
		else {
			print $client "250 ok\r\n";
		}
	}
	close($client);
}
