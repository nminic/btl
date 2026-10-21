# RESTORES A DUMP, READ FROM STANDARD INPUT, INTO THE EMPTY DATABASE OF THE CONTAINER IT RUNS IN.
#
# Its TEXT is handed to `sh -c` inside a database container by `docker exec -i`, with the dump on
# standard input, and it is the one home of how a copy is restored:
#   - by deploy/backup.sh --prove, inside the throwaway database the monthly proof starts;
#   - by deploy/restore.sh, inside the production database itself.
# The production database has no folder of ours mounted and must not get one, and a dump copied
# INTO its container would be written to the container's layer, which is a disk. So the dump
# travels on standard input and the script travels as an argument; the script carries no secret.
#
# It reads the role and the database from the container's own environment, POSTGRES_USER and
# POSTGRES_DB, the copy deploy/README.md calls the only one that cannot be stale.
#
# WHAT IT REFUSES: a database that already holds anything in the schema `public`. The dump carries
# the whole schema and flyway_schema_history with it, so it is restored into nothing, never over
# something: a restore over a migrated database would fail on the first table, and a restore over
# a used one would be a merge nobody decided. Emptying it is a step of its own, in deploy/README.md.
#
# HOW: `--exit-on-error --single-transaction`, so the restore lands whole or not at all, and the
# exit status says which. `--no-owner --no-acl`, so the objects belong to the role that restores
# them: on production that is the same role that made the dump, and in the throwaway it is
# `postgres`, where the production role does not exist and an ALTER ... OWNER TO it would stop the
# restore. A constraint that was NOT VALID in the dump comes back NOT VALID (pg_dump writes it after
# the data, with the words NOT VALID; BackupCopyTest measures it on the owner's own membership row,
# which predates the two constraints V35 added that way).

set -eu

in_public=$(psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA \
  -c "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'")
if [ "$in_public" != 0 ]; then
  printf 'REFUSED: the database %s already holds %s objects in the schema public; a copy is restored into an empty one\n' \
    "$POSTGRES_DB" "$in_public" >&2
  exit 4
fi

exec pg_restore --exit-on-error --single-transaction --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"
