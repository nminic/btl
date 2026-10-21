#!/bin/sh
# TURNS THE BACKUP'S SETTINGS INTO FILES IN THE WORK FOLDER, AND REFUSES THE ONES THAT ARE EMPTY.
#
# Run as the one-shot service `backup-settings` of deploy/compose.prod.yml, by deploy/backup.sh
# and deploy/restore.sh, never by hand:
#
#   docker compose -f compose.prod.yml --profile backup run --rm -T -v "$WORK":/work backup-settings
#
# WHY A SERVICE AT ALL. The values live in /opt/btl/deploy/.env, which only Compose reads, and the
# scripts on the host read no .env (the arrangement deploy/pour-from-qa.sh and proveri-qa.sh already
# rely on). Declared on a service, every name goes through the floors of WhatEachStackRequiresTest:
# it has a row in .env.example, a row in the runbook's table, and a behaviour when it is empty that
# a test reads off Compose.
#
# WHY THE SERVICE MAKES FILES AND DOES NOTHING ELSE. The keys reach this one short-lived container
# through its environment, which is how every secret of this stack reaches its container, and from
# here on they exist only as files in the work folder, which is memory (deploy/backup/in-memory.sh)
# and private (umask 077). Every later step is a plain `docker run` with NO secret in its
# environment and none in any argument: curl reads its keys with -K from a file, gpg its
# passphrase with --passphrase-file. An argument is visible to every user of the host in `ps`.
#
# THE SETTINGS ARE DECLARED WITH `:-` AND REFUSED HERE, AND THAT IS MEASURED RATHER THAN ARGUED.
# A `:?` on a service in an inactive profile still turns down EVERY command over the file
# (ADL A4a: Compose interpolates the whole file before it reads which services a command named),
# so the public site would not deploy while the bucket was not yet made. Here an empty one is named
# and the run fails, which mails the superadmin.
#
# THE RELAY'S FILES ARE WRITTEN FIRST AND WHATEVER ELSE IS MISSING, because the alert that says
# what is missing travels through them. A run with no R2 key still mails "PROD_BACKUP_R2_... is
# empty"; a run with no relay key mails nothing, and then the Worker beside
# deploy/cloudflare/no-reply-reject.js is the one who says, 26 hours later, that no copy came.
#
#   write-settings.sh <work folder>
#
# Exit 0: every file written. Exit 3: the relay's files are written and something else is empty,
# named on the standard error. Exit 1: the folder is not usable.

set -eu
umask 077

WORK=${1:?write-settings.sh needs the work folder}
[ -d "$WORK" ] && [ -w "$WORK" ] || { printf 'REFUSED: %s is not a writable folder\n' "$WORK" >&2; exit 1; }

# A value that will be written inside double quotes in a curl config file must not carry a double
# quote or a backslash, which would end or bend the quoting, nor a line break, which would start a
# new option. None of the keys R2 or Brevo issue does; one that did is refused rather than escaped,
# because an escape here is a second parser nobody tests.
plain() {
  case "$2" in
    *'"'* | *'\'* | *'
'*) printf 'REFUSED: %s carries a quote, a backslash or a line break, which a curl config file cannot hold as written\n' "$1" >&2
        exit 1 ;;
  esac
}

missing=''
need() {
  # $1 the name the owner writes in .env, $2 its value here
  if [ -z "$2" ]; then
    missing="$missing $1"
  fi
}

# --- the relay, first -----------------------------------------------------------------------

mail_ready=yes
for pair in "PROD_MAIL_USERNAME=${BTL_BACKUP_MAIL_USERNAME:-}" "PROD_MAIL_PASSWORD=${BTL_BACKUP_MAIL_PASSWORD:-}" \
            "BTL_SUPERADMIN_EMAIL=${BTL_BACKUP_MAIL_TO:-}"; do
  [ -n "${pair#*=}" ] || mail_ready=no
done

if [ "$mail_ready" = yes ]; then
  plain PROD_MAIL_USERNAME "$BTL_BACKUP_MAIL_USERNAME"
  plain PROD_MAIL_PASSWORD "$BTL_BACKUP_MAIL_PASSWORD"
  plain PROD_MAIL_HOST "${BTL_BACKUP_MAIL_HOST:-}"
  plain BTL_SUPERADMIN_EMAIL "$BTL_BACKUP_MAIL_TO"
  {
    # smtp:// and not smtps://: Brevo takes STARTTLS on 587, and `ssl-reqd` is what REQUIRES it -
    # the same switch compose.prod.yml turns on for the backend, for the same reason: without it a
    # stripping attacker on the wire gets the relay's key.
    printf 'url = "smtp://%s:%s"\n' "${BTL_BACKUP_MAIL_HOST:-}" "${BTL_BACKUP_MAIL_PORT:-}"
    printf 'ssl-reqd\n'
    printf 'user = "%s:%s"\n' "$BTL_BACKUP_MAIL_USERNAME" "$BTL_BACKUP_MAIL_PASSWORD"
    printf 'mail-from = "%s"\n' "${BTL_BACKUP_MAIL_FROM:-}"
    # BTL_SUPERADMIN_EMAIL is a comma separated list (.env.example), and every address on it gets
    # the alert: the owner decided the recipient is "adresa superadmina", and there may be several.
    printf '%s\n' "$BTL_BACKUP_MAIL_TO" | tr ',' '\n' | sed 's/^ *//; s/ *$//' | sed -n 's/^\(..*\)$/mail-rcpt = "\1"/p'
  } > "$WORK/mail.curl"
  printf '%s\n' "${BTL_BACKUP_MAIL_FROM:-}" > "$WORK/mail.from"
  printf '%s\n' "$BTL_BACKUP_MAIL_TO" > "$WORK/mail.to"
else
  printf 'the relay is not configured (PROD_MAIL_USERNAME, PROD_MAIL_PASSWORD and BTL_SUPERADMIN_EMAIL), so a failure of this run can be mailed to nobody\n' >&2
fi

# --- the bucket and the passphrase -----------------------------------------------------------

need PROD_BACKUP_R2_ACCOUNT_ID "${BTL_BACKUP_R2_ACCOUNT_ID:-}"
need PROD_BACKUP_R2_BUCKET "${BTL_BACKUP_R2_BUCKET:-}"
need PROD_BACKUP_R2_ACCESS_KEY_ID "${BTL_BACKUP_R2_ACCESS_KEY_ID:-}"
need PROD_BACKUP_R2_SECRET_ACCESS_KEY "${BTL_BACKUP_R2_SECRET_ACCESS_KEY:-}"
need PROD_BACKUP_PASSPHRASE "${BTL_BACKUP_PASSPHRASE:-}"

if [ -n "$missing" ]; then
  printf 'REFUSED: empty in /opt/btl/deploy/.env:%s\n' "$missing" >&2
  exit 3
fi

# An account id and a bucket name are letters, digits and hyphens; anything else would change the
# address the copy is sent to.
for pair in "PROD_BACKUP_R2_ACCOUNT_ID=$BTL_BACKUP_R2_ACCOUNT_ID" "PROD_BACKUP_R2_BUCKET=$BTL_BACKUP_R2_BUCKET"; do
  case "${pair#*=}" in
    *[!a-z0-9-]*) printf 'REFUSED: %s may hold only lower case letters, digits and hyphens\n' "${pair%%=*}" >&2; exit 1 ;;
  esac
done
plain PROD_BACKUP_R2_ACCESS_KEY_ID "$BTL_BACKUP_R2_ACCESS_KEY_ID"
plain PROD_BACKUP_R2_SECRET_ACCESS_KEY "$BTL_BACKUP_R2_SECRET_ACCESS_KEY"
case "$BTL_BACKUP_PASSPHRASE" in
  *'
'*) printf 'REFUSED: PROD_BACKUP_PASSPHRASE carries a line break, and gpg reads only the first line of it\n' >&2
      exit 1 ;;
esac

printf 'user = "%s:%s"\n' "$BTL_BACKUP_R2_ACCESS_KEY_ID" "$BTL_BACKUP_R2_SECRET_ACCESS_KEY" > "$WORK/r2.curl"

# THE EU JURISDICTION IS IN THE ADDRESS, and that is the owner's decision (4) of 20.10.2026: "kantica
# je u EU jurisdikciji". A bucket made in that jurisdiction answers only at the `.eu.` endpoint, so a
# bucket made outside it fails here with a 404 rather than being written to quietly.
printf 'https://%s.eu.r2.cloudflarestorage.com/%s\n' "$BTL_BACKUP_R2_ACCOUNT_ID" "$BTL_BACKUP_R2_BUCKET" > "$WORK/r2.base"

# printf and not echo, and no newline: gpg reads the whole first line of the file as the
# passphrase, and a passphrase is whatever the owner put there, all of it.
printf '%s' "$BTL_BACKUP_PASSPHRASE" > "$WORK/passphrase"
