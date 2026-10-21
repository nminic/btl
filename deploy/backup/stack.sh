# WHAT deploy/backup.sh AND deploy/restore.sh BOTH NEED OF THE RUNNING STACK, SAID ONCE.
#
# SOURCED after deploy/backup/in-memory.sh, which gives WORK. It needs `fail`, `say`, COMPOSE (the
# compose file), BACKUP (this folder, on the host) and TRANSFER_IMAGE from the shell that sources it.
#
# NOTHING HERE READS .env. The settings reach the work folder through the one-shot service
# `backup-settings` (write-settings.sh says why), the role and the database are read inside the
# database container out of its own environment, and the photograph volume is asked of the backend
# container, which is where compose.prod.yml mounts it. The volume is NOT declared on any backup
# service: ADL A43, 2, says it is "montiran samo u bekend", and the runs below mount it for the
# length of one command.

# The settings, as files in the work folder. write-settings.sh prints names and never values, so
# its output may be shown.
read_settings() {
  if docker compose -f "$COMPOSE" --profile backup run --rm -T -v "$WORK":/work backup-settings \
       > "$WORK/settings.log" 2>&1; then
    return 0
  fi
  grep -a 'REFUSED\|relay is not configured' "$WORK/settings.log" | sed 's/^/  /' >&2 || true
  fail "the backup's settings are not complete: $(grep -a 'REFUSED' "$WORK/settings.log" | head -1)"
}

# DB, IMAGE, BACKEND and PHOTOS_VOLUME: the database container, its image, the backend container
# (running or not) and the volume it keeps photographs in.
find_stack() {
  DB=$(docker compose -f "$COMPOSE" ps -q postgres)
  [ -n "$DB" ] || fail 'the production postgres is not running'
  # The IMAGE and not its tag, for the reason pour-from-qa.sh gives: a tag moves, and pg_restore of
  # the same release as the pg_dump that made the copy is the one sure to read it.
  IMAGE=$(docker inspect -f '{{.Image}}' "$DB")

  BACKEND=$(docker compose -f "$COMPOSE" ps -a -q backend)
  [ -n "$BACKEND" ] || fail 'there is no backend container, and it is what says where the photographs are'
  docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$BACKEND" > "$WORK/backend.env" \
    || fail 'the backend container could not be read'
  folder=$(sed -n 's/^BTL_PHOTOS_FOLDER=//p' "$WORK/backend.env")
  [ -n "$folder" ] || fail 'the backend does not say where it keeps photographs'
  PHOTOS_VOLUME=$(docker inspect -f "{{range .Mounts}}{{if eq .Destination \"$folder\"}}{{.Name}}{{end}}{{end}}" "$BACKEND")
  [ -n "$PHOTOS_VOLUME" ] || fail "the backend mounts no volume at $folder, so there is nothing to copy the photographs from or to"
}

# One call of transfer.sh, in the image that has curl. It has a network, because it talks to R2,
# and it holds no secret but the files in the work folder.
transfer() {
  docker run --rm -v "$WORK":/work -v "$BACKUP":/backup:ro --entrypoint sh "$TRANSFER_IMAGE" \
    /backup/transfer.sh /work "$@"
}

# check.sh over /work/copy.gpg, in the database's own image and with no network. Sets CHECKED to
# its status: 0 whole, 3 whole but photographs that do not match their rows, anything else unusable.
check_copy() {
  if docker run --rm --network none -v "$WORK":/work -v "$BACKUP":/backup:ro --entrypoint sh "$IMAGE" \
       /backup/check.sh /work /work/copy.gpg; then
    CHECKED=0
  else
    CHECKED=$?
  fi
}
