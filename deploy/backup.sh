#!/bin/sh
# THE NIGHTLY COPY OF PRODUCTION, AND ONCE A MONTH THE PROOF THAT IT RESTORES.
#
# The owner's decisions, ADL O19: "produkcijska baza je kontejner na istom serveru, sa dnevnim
# `pg_dump` na drugu lokaciju i dokazanim vracanjem jednom mesecno", and "Rezervna kopija mora da
# pokrije i volumen sa otpremljenim slikama". On 20.10.2026 he chose, each time between offered
# outcomes and with my recommendation: the second place is Cloudflare R2, in its EU jurisdiction;
# the key is a random passphrase in .env with a copy in his password manager, so the server runs the
# monthly proof unattended; 7 daily and 12 monthly copies are kept by lifecycle rules he sets in the
# R2 panel, and THIS SCRIPT DELETES NOTHING; a failure is mailed to the superadmin through the relay,
# and a Worker mails when no new copy has arrived for 26 hours; the copy runs at 04:00 Belgrade time
# and the proof on the 2nd of the month at 05:00.
#
# Run ON THE HOST, from /opt/btl/deploy, as root, by the two systemd timers in deploy/backup/
# (installing them is the owner's step, deploy/README.md):
#
#   sh backup.sh            the nightly copy
#   sh backup.sh --prove    the monthly proof
#
# THE NIGHTLY COPY, in this order, and the order is the design:
#   1. the settings, out of .env through the one-shot service backup-settings, into memory;
#   2. THE DATABASE FIRST: pg_dump in its custom format, over the database container's own socket,
#      into memory. It is the WHOLE database, flyway_schema_history included: a restore has to
#      bring the schema back exactly as Flyway left it, or the next backend start would try to
#      migrate it again;
#   3. THEN THE PHOTOGRAPHS (backup/pack.sh says why this order and not the other), streamed with the
#      dump and a manifest through tar into gpg, into one encrypted object;
#   4. the same night, that object is opened again and checked (backup/check.sh): it decrypts, the
#      dump is the one its manifest names, and every `photo` row READ FROM THE DUMP has its file in
#      the copy, of the row's size and the row's digest;
#   5. it is sent to R2 under daily/, and the bucket is asked what it holds (an ETag equal to the MD5
#      of what was sent).
# A copy whose photographs disagree with their rows is still SENT, because its database is good and
# the newest good database is worth more than none; and the run still FAILS, so the superadmin hears
# which rows. A copy that does not decrypt, or whose dump is not its own, is not sent at all.
#
# THE MONTHLY PROOF: the newest copy under daily/ is brought back from R2 and restored into a
# throwaway database that has NO NETWORK and keeps its data in MEMORY, and it proves: gpg's
# integrity check; pg_restore --exit-on-error in one transaction, exit 0; every table holding the
# number of rows the DUMP STREAM carries (never the restored database's own count); a floor no empty
# copy can meet; every photo row matched, by the row's size and digest; a copy no older than 26
# hours. It then leaves a proof under proofs/, which holds counts and no member, and the copy it
# proved under monthly/, so that every monthly copy is one that has been restored.
#
# WHAT IS NOT MEASURED FROM HERE, and is the first real run's job (deploy/README.md): that R2 takes
# the signature, that its ETag for one PUT is the MD5 of the body, and how big and how long a real
# copy is.
#
# NOTHING IN PLAIN TEXT OUTSIDE MEMORY. The work folder is tmpfs, refused otherwise
# (backup/in-memory.sh). The dump, the passphrase and the keys live there and nowhere else. The
# ENCRYPTED copy is the one thing that is on a disk (a folder under /var/tmp, mounted at /copy),
# because it is ciphertext and because held in memory it was a whole second production in the
# host's RAM. Every exit code is read from a redirect, never through a pipe: `sh` has no pipefail.
#
# NO COMMAND THAT CAN RUN LONG IS RUN BARE. A docker command goes through `step`, a container
# through `container` (backup/in-memory.sh says why: a shell runs its traps only after the command
# it is waiting for, so a SIGTERM during a step used to wait for the step).

set -eu

say() { printf '%s\n' "$*"; }
fail() {
  printf 'REFUSED: %s\n' "$*" >&2
  if [ -n "${WORK:-}" ] && [ -d "$WORK" ]; then
    printf '%s\n' "$*" > "$WORK/failure"
  fi
  exit 1
}

MODE=copy
WHAT='nightly copy'
case "${1:-}" in
  --prove) MODE=prove; WHAT='monthly proof' ;;
  '') ;;
  *) fail "unknown argument '$1'; this takes --prove or nothing at all" ;;
esac

COMPOSE=compose.prod.yml
BACKUP="$(pwd)/backup"
# The image transfer.sh and alert.sh run in, because it carries curl. The same one the service
# backup-settings declares in compose.prod.yml, which BackupScriptTest compares with this line.
TRANSFER_IMAGE=eclipse-temurin:21-jre
# The proof's throwaway database, by a name of its own so that a run killed with SIGKILL leaves it
# where the next run's `docker rm -f` finds it.
THROWAWAY=btl-backup-proof

[ -f "$COMPOSE" ] || fail "no $COMPOSE here; this is run from /opt/btl/deploy"
[ -d "$BACKUP" ] || fail "no $BACKUP; this tool is a shell script AND the folder beside it"

# The superadmin is told, through the relay, whenever the run ends with anything but 0. The text is
# the line the run refused with and nothing a database said (backup/alert.sh).
alert() {
  [ -s "$WORK/mail.curl" ] || { say 'the relay is not configured, so nobody can be mailed about this'; return 1; }
  hostname > "$WORK/host" 2>/dev/null || true
  container -v "$WORK":/work -v "$BACKUP":/backup:ro --entrypoint sh "$TRANSFER_IMAGE" \
    /backup/alert.sh /work "$WHAT"
}

# shellcheck source=backup/in-memory.sh
. "$BACKUP/in-memory.sh"
# shellcheck source=backup/stack.sh
. "$BACKUP/stack.sh"
say "work files, in memory: $WORK. The encrypted copy, on disk: $SPOOL. Both removed on exit; a SIGKILL leaves them, and then they are yours to remove."

say '--- 1. the settings ---'
read_settings
find_stack
say "database $DB, photographs in $PHOTOS_VOLUME"

if [ "$MODE" = copy ]; then
  say ''
  say '--- 2. the database, first ---'
  if ! step docker exec "$DB" sh -c 'exec pg_dump --format=custom -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
       > "$WORK/btl.dump" 2> "$WORK/dump.err"; then
    show_errors "$WORK/dump.err"
    fail 'pg_dump did not pass, and nothing was sent'
  fi
  [ -s "$WORK/btl.dump" ] || fail 'the dump is empty, and nothing was sent'
  say "dumped: $(wc -c < "$WORK/btl.dump" | tr -d ' ') bytes"

  say ''
  say '--- 3. then the photographs, into one encrypted copy with the dump ---'
  container --network none -v "$WORK":/work -v "$SPOOL":/copy -v "$PHOTOS_VOLUME":/photos:ro -v "$BACKUP":/backup:ro \
    --entrypoint sh "$IMAGE" /backup/pack.sh /work /photos /copy/copy.gpg \
    || fail 'the copy could not be made, and nothing was sent'

  say ''
  say '--- 4. the copy, opened again and checked ---'
  check_copy
  [ "$CHECKED" = 0 ] || [ "$CHECKED" = 3 ] || fail 'the copy just made does not open as a copy, and nothing was sent'

  say ''
  say '--- 5. sent, and asked what arrived ---'
  KEY="daily/btl-$(date -u +%Y-%m-%dT%H%M%SZ).gpg"
  transfer put /copy/copy.gpg "$KEY" || fail "the copy did not reach R2 as $KEY"

  [ "$CHECKED" = 0 ] \
    || fail "the copy was sent as $KEY, but some photo rows in it have no file that matches them (listed above); the database in it is good"
  say ''
  say "DONE: $KEY"
  exit 0
fi

say ''
say '--- 2. the newest copy, brought back ---'
# Into a file and not into $(...): a command substitution is a foreground command to the shell
# that runs it, and a signal would wait for it (backup/in-memory.sh, "WHY A STEP IS RUN IN THE
# BACKGROUND").
transfer newest daily/ > "$WORK/newest.key" || fail 'R2 could not say which copy is the newest'
KEY=$(cat "$WORK/newest.key")
transfer get "$KEY" /copy/copy.gpg || fail "$KEY could not be brought back whole"

say ''
say '--- 3. a throwaway database, with no network and its data in memory ---'
docker rm -f "$THROWAWAY" >/dev/null 2>&1 || true
# trust and no password, for the reason the pour's reference database gives: nothing can reach it
# but `docker exec`, because it has no network. --tmpfs over the image's data folder, so the
# restored members are never on a disk; --memory so a large restore cannot take the host's memory
# from the site. --log-driver none because a restore that fails on a constraint makes the SERVER
# write the member's row into its log (DETAIL: Failing row contains (...), and the CONTEXT line with
# the whole row of data), and the default driver keeps that log in a json file on a disk under
# /var/lib/docker for as long as the container exists, which is for as long as a SIGKILL leaves it
# standing. Measured 21.10.2026: `docker logs` showed the row with the default driver and nothing with
# none, and what this script shows of a failed restore (show_errors, from what the client printed)
# was the same in both.
docker run -d --name "$THROWAWAY" --log-driver none --network none --tmpfs /var/lib/postgresql --memory 1g \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_USER=postgres -e POSTGRES_DB=proof \
  -v "$WORK":/work -v "$SPOOL":/copy:ro -v "$BACKUP":/backup:ro "$IMAGE" > /dev/null
waited=0
until step docker exec "$THROWAWAY" pg_isready -q -h 127.0.0.1 -U postgres -d proof 2>/dev/null; do
  waited=$((waited + 1))
  [ "$waited" -lt 90 ] || fail 'the throwaway database did not come up within 90 seconds'
  sleep 1
done

say ''
say '--- 4. the copy, opened ---'
if step docker exec "$THROWAWAY" sh /backup/check.sh /work /copy/copy.gpg; then CHECKED=0; else CHECKED=$?; fi
[ "$CHECKED" = 0 ] || fail "$KEY does not pass the check, so it does not prove a restore"

say ''
say '--- 5. restored, in one transaction ---'
if ! step docker exec -i "$THROWAWAY" sh -c "$(cat "$BACKUP/restore-database.sh")" \
     < "$WORK/check/btl.dump" > "$WORK/restore.log" 2>&1; then
  show_errors "$WORK/restore.log"
  fail "$KEY did not restore"
fi

say ''
say '--- 6. and the restored database holds what the copy carries ---'
step docker exec "$THROWAWAY" sh /backup/prove.sh counts /work || fail "$KEY restored into something other than what it carries"
NOW=$(date -u +%s)
step docker exec "$THROWAWAY" sh /backup/prove.sh age /work "$NOW" || fail "$KEY is too old to prove that the nightly copy works"
step docker exec "$THROWAWAY" sh /backup/prove.sh record /work "$NOW" || fail 'the proof could not be written down'
printf 'copy %s\n' "$KEY" >> "$WORK/proof.txt"

say ''
say '--- 7. the proof, and the copy it proved, written to R2 ---'
transfer put /work/proof.txt "proofs/btl-$(date -u +%Y-%m-%d).txt" || fail 'the proof could not be written to R2'
transfer put /copy/copy.gpg "monthly/btl-$(TZ=Europe/Belgrade date +%Y-%m).gpg" \
  || fail 'the proven copy could not be kept under monthly/'

say ''
say "PROVEN: $KEY restores, and is kept under monthly/"
