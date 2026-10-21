#!/bin/sh
# PUTS PRODUCTION BACK FROM A COPY IN R2: THE DATABASE FIRST, THEN THE PHOTOGRAPHS.
#
# Run ON THE HOST, from /opt/btl/deploy, by hand, after deploy/README.md "Restoring production
# from a copy" has been read. It is the procedure that README describes, written as a script so
# that the order cannot be taken out of it:
#
#   docker compose -f compose.prod.yml stop backend
#   (the production database emptied, as the README says)
#   sh restore.sh                        the newest copy under daily/
#   sh restore.sh monthly/btl-2026-11.gpg   or a copy named by its key
#   docker compose -f compose.prod.yml up -d backend
#
# WHAT IT REFUSES, each with the reason it exists:
#
#   - A RUNNING BACKEND. The backend deletes, once an hour, every photograph no `photo` row names
#     that is older than ten minutes (ThePicturesFolderIsSwept), and it writes rows while it runs. A
#     restore under a running backend is a restore whose result depends on what it did meanwhile.
#     Asked at the start and again just before the first write.
#   - A DATABASE THAT IS NOT EMPTY, refused by backup/restore-database.sh itself: the copy carries
#     the whole schema and flyway_schema_history, so it is restored into nothing and never merged
#     into something.
#   - A COPY THAT DOES NOT OPEN, by backup/check.sh, before anything is written. A copy whose
#     photographs do not all match their rows is restored, and says which do not: on the day this is
#     run the newest good database is what is wanted, and the rows that lost their file are named.
#
# THE DATABASE FIRST, THEN THE PHOTOGRAPHS, AND THEY ARE GIVEN THE TIME OF THE RESTORE (`tar -m`,
# backup/restore-photos.sh says why), and only then the backend: its first sweep finds every file
# with its row already there.
#
# Like deploy/backup.sh it reads no .env, keeps everything in plain text in memory only, and
# deletes nothing in R2.

set -eu

say() { printf '%s\n' "$*"; }
fail() {
  printf 'REFUSED: %s\n' "$*" >&2
  if [ -n "${WORK:-}" ] && [ -d "$WORK" ]; then
    printf '%s\n' "$*" > "$WORK/failure"
  fi
  exit 1
}

KEY=${1:-}
case "$KEY" in
  '' | daily/?* | monthly/?*) ;;
  *) fail "'$KEY' is not the key of a copy; copies live under daily/ and monthly/" ;;
esac

COMPOSE=compose.prod.yml
BACKUP="$(pwd)/backup"
TRANSFER_IMAGE=eclipse-temurin:21-jre
THROWAWAY=btl-restore-none

[ -f "$COMPOSE" ] || fail "no $COMPOSE here; this is run from /opt/btl/deploy"
[ -d "$BACKUP" ] || fail "no $BACKUP; this tool is a shell script AND the folder beside it"

# The operator is at the terminal and reads the refusal there; nobody else is mailed.
alert() { return 0; }

backend_is_stopped() {
  [ -z "$(docker compose -f "$COMPOSE" ps -q backend)" ] || fail "the backend is running. Stop it first:
  docker compose -f $COMPOSE stop backend
It sweeps the photographs and writes rows while it runs, so nothing is restored under it."
}

backend_is_stopped

# shellcheck source=backup/in-memory.sh
. "$BACKUP/in-memory.sh"
# shellcheck source=backup/stack.sh
. "$BACKUP/stack.sh"
say "work files, in memory: $WORK. Removed on exit; a SIGKILL leaves them, and then they are yours to remove."

say '--- 1. the settings and the stack ---'
read_settings
find_stack

say ''
say '--- 2. the copy, brought back and opened ---'
if [ -z "$KEY" ]; then
  KEY=$(transfer newest daily/) || fail 'R2 could not say which copy is the newest'
fi
say "restoring $KEY"
transfer get "$KEY" /work/copy.gpg || fail "$KEY could not be brought back whole"
check_copy
case "$CHECKED" in
  0) ;;
  3) say 'THE COPY IS RESTORED ALTHOUGH some photo rows have no matching file in it (listed above).' ;;
  *) fail "$KEY does not open as a copy; nothing was written" ;;
esac

say ''
say '--- 3. the database, into the empty production database ---'
backend_is_stopped
if ! docker exec -i "$DB" sh -c "$(cat "$BACKUP/restore-database.sh")" \
     < "$WORK/check/btl.dump" > "$WORK/restore.log" 2>&1; then
  show_errors "$WORK/restore.log"
  fail "$KEY did not restore. It was one transaction, so the database is as it was; the photographs were not touched."
fi
say 'restored'

say ''
say '--- 4. then the photographs, as young as the restore ---'
docker run --rm --network none -v "$WORK":/work -v "$PHOTOS_VOLUME":/photos -v "$BACKUP":/backup:ro \
  --entrypoint sh "$IMAGE" /backup/restore-photos.sh /work /work/copy.gpg /photos \
  || fail 'the photographs could not be put back; the database is restored, so run this again only after emptying it'

say ''
say "DONE. Start the backend now; it applies whatever migrations are newer than the copy:
  docker compose -f $COMPOSE up -d backend"
