#!/bin/sh
# MAILS THE SUPERADMIN THAT A BACKUP RUN FAILED, THROUGH THE SAME RELAY THE PORTAL SENDS WITH.
#
# The owner's decision (3) of 20.10.2026 (ADL O19): "skripta salje mejl preko Breva kad padne", to
# "adresa superadmina (BTL_SUPERADMIN_EMAIL)". Run by deploy/backup.sh and deploy/restore.sh on
# their way out, in a container of eclipse-temurin:21-jre, with the work folder mounted:
#
#   alert.sh <work folder> <what failed>
#
# The relay's address, login and key are <work folder>/mail.curl, written by write-settings.sh and
# read by curl with -K, never an argument. `ssl-reqd` is in that file, so the message goes only over
# a connection STARTTLS has encrypted.
#
# WHAT THE MESSAGE SAYS is the line the script refused with and the host's name, and nothing that a
# database said: a failed restore's complaint can carry a member's row, and a message is a copy of it
# in somebody's mailbox. Where to look for the rest is in the message.

set -eu
umask 077

WORK=${1:?alert.sh needs the work folder}
WHAT=${2:?alert.sh needs what failed}

[ -s "$WORK/mail.curl" ] || { printf 'the relay is not configured, so this alert goes to nobody: %s\n' "$WHAT" >&2; exit 1; }

FROM=$(cat "$WORK/mail.from")
TO=$(cat "$WORK/mail.to")
REASON='(the run gave no reason)'
[ -s "$WORK/failure" ] && REASON=$(head -c 2000 "$WORK/failure")

# CRLF line ends, as SMTP wants them, and nothing but ASCII outside the body's own text. The body is
# UTF-8 because the refusal lines are written in plain English and the host's name is ASCII; the
# header says so.
{
  printf 'From: %s\r\n' "$FROM"
  printf 'To: %s\r\n' "$TO"
  printf 'Subject: BTL backup FAILED: %s\r\n' "$WHAT"
  printf 'Date: %s\r\n' "$(LC_ALL=C date -R)"
  printf 'MIME-Version: 1.0\r\n'
  printf 'Content-Type: text/plain; charset=UTF-8\r\n'
  printf '\r\n'
  printf 'The %s on %s did not finish.\r\n' "$WHAT" "$(cat "$WORK/host" 2>/dev/null || echo 'the host')"
  printf '\r\n'
  printf '%s\r\n' "$REASON" | sed 's/\r*$/\r/'
  printf '\r\n'
  printf 'The whole output of the run is in the journal of its timer on the host:\r\n'
  printf '  journalctl -u btl-backup.service -u btl-backup-proof.service --since today\r\n'
  printf 'No copy was deleted; the copies already in the bucket are as they were.\r\n'
} > "$WORK/alert.mail"

if ! curl -sS --fail -K "$WORK/mail.curl" --upload-file "$WORK/alert.mail" 2> "$WORK/alert.err"; then
  printf 'the relay refused the alert: %s\n' "$(cat "$WORK/alert.err")" >&2
  exit 1
fi
printf 'alert sent to %s\n' "$TO"
