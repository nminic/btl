# A STAND-IN FOR ONE R2 BUCKET, ON THE LOOPBACK OF A CONTAINER THAT HAS NO NETWORK.
#
# Used by BackupTransferTest only. It is not R2 and claims nothing about R2: it does not check a
# signature, and its ETag is the MD5 of the body because that is what an S3 single PUT answers,
# which is exactly the part that is NOT measured here and is written down in deploy/README.md as
# a step for the first real run. What it is for is the other side: what OUR script sends (the
# method, the path, the signed headers, the body) and what our script does with each answer.
#
# Written with perl-base only, which is what eclipse-temurin:21-jre carries; the MD5 is asked of
# md5sum for that reason. One request at a time, which is all one script ever makes.
#
#   perl fake-r2.pl <port> <folder>
#
# Every request is appended to <folder>/requests as one line: METHOD PATH then every header the
# request carried, so a case can read what curl actually sent. An object lives in <folder>/objects
# under its path with every / turned into %2F. A file <folder>/wrong-etag makes every answer carry
# an ETag that is not the body's, and <folder>/refuse-put makes a PUT answer 403.

use strict;
use warnings;
use IO::Socket::INET;

my ($port, $folder) = @ARGV;
mkdir "$folder/objects";

my $server = IO::Socket::INET->new(LocalAddr => '127.0.0.1', LocalPort => $port, Listen => 5,
	ReuseAddr => 1) or die "cannot listen: $!";

open(my $ready, '>', "$folder/ready") or die; close($ready);

sub md5_of {
	my ($file) = @_;
	my $sum = `md5sum '$file'`;
	return (split(/\s+/, $sum))[0];
}

sub answer {
	my ($client, $status, $headers, $body) = @_;
	$body = '' unless defined $body;
	print $client "HTTP/1.1 $status\r\n";
	print $client "$_\r\n" for @$headers;
	print $client "Connection: close\r\n\r\n";
	print $client $body;
}

while (my $client = $server->accept) {
	binmode $client;
	my $line = <$client>;
	next unless defined $line;
	$line =~ s/\r?\n$//;
	my ($method, $target) = split(/ /, $line);
	my %header;
	my @seen;
	while (my $h = <$client>) {
		$h =~ s/\r?\n$//;
		last if $h eq '';
		push @seen, $h;
		my ($name, $value) = split(/:\s*/, $h, 2);
		$header{lc $name} = $value;
	}
	open(my $log, '>>', "$folder/requests") or die;
	print $log "$method $target | " . join(' | ', @seen) . "\n";
	close($log);

	my ($path, $query) = split(/\?/, $target, 2);
	my $name = $path;
	$name =~ s{/}{%2F}g;
	my $stored = "$folder/objects/$name";

	if ($method eq 'PUT') {
		print $client "HTTP/1.1 100 Continue\r\n\r\n" if lc($header{'expect'} // '') eq '100-continue';
		my $left = $header{'content-length'} // 0;
		open(my $out, '>', "$stored.part") or die;
		binmode $out;
		while ($left > 0) {
			my $read = read($client, my $chunk, $left > 65536 ? 65536 : $left);
			last unless $read;
			print $out $chunk;
			$left -= $read;
		}
		close($out);
		if (-e "$folder/refuse-put") {
			unlink "$stored.part";
			answer($client, '403 Forbidden', [], '<Error><Code>AccessDenied</Code></Error>');
		}
		else {
			rename "$stored.part", $stored;
			my $etag = -e "$folder/wrong-etag" ? '0' x 32 : md5_of($stored);
			answer($client, '200 OK', ["ETag: \"$etag\"", 'Content-Length: 0']);
		}
	}
	elsif (($method eq 'HEAD' || $method eq 'GET') && defined $query && $query =~ /list-type=2/) {
		my ($prefix) = $query =~ /prefix=([^&]*)/;
		$prefix = '' unless defined $prefix;
		$prefix =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/ge;
		my $bucket = $path;
		$bucket =~ s{^/}{};
		opendir(my $dir, "$folder/objects") or die;
		my @keys = sort grep { $_ ne '.' && $_ ne '..' && $_ !~ /\.part$/ } readdir($dir);
		closedir($dir);
		my $xml = '<?xml version="1.0" encoding="UTF-8"?><ListBucketResult>';
		for my $one (@keys) {
			my $key = $one;
			$key =~ s/%2F/\//g;
			$key =~ s{^/\Q$bucket\E/}{};
			next unless index($key, $prefix) == 0;
			$xml .= "<Contents><Key>$key</Key><Size>" . (-s "$folder/objects/$one") . '</Size></Contents>';
		}
		$xml .= '</ListBucketResult>';
		answer($client, '200 OK', ['Content-Type: application/xml', 'Content-Length: ' . length($xml)], $xml);
	}
	elsif ($method eq 'HEAD' || $method eq 'GET') {
		if (-e $stored) {
			my $etag = -e "$folder/wrong-etag" ? '0' x 32 : md5_of($stored);
			my $size = -s $stored;
			if ($method eq 'HEAD') {
				answer($client, '200 OK', ["ETag: \"$etag\"", "Content-Length: $size"]);
			}
			else {
				open(my $in, '<', $stored) or die;
				binmode $in;
				local $/;
				my $body = <$in>;
				close($in);
				answer($client, '200 OK', ["ETag: \"$etag\"", "Content-Length: $size"], $body);
			}
		}
		else {
			answer($client, '404 Not Found', ['Content-Length: 0']);
		}
	}
	else {
		answer($client, '405 Method Not Allowed', ['Content-Length: 0']);
	}
	close($client);
}
