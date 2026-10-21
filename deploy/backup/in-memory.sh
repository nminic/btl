# WHERE THE BACKUP KEEPS WHAT IT HAS IN PLAIN TEXT, WHO MAY READ IT, WHAT REMOVES IT, AND WHO IS
# TOLD WHEN A RUN FAILS.
#
# SOURCED by deploy/backup.sh and deploy/restore.sh, never run by itself, and run on its own -
# under signals, in a real Linux - by BackupLeavesNothingBehindTest. It is a file of its own for
# the reason deploy/pour-from-qa/leaves-nothing-behind.sh gives for itself: what a shell does on a
# signal is a fact about the shell, held by sending the signal and looking, and the scripts that
# source this need a live production stack.
#
# IT NEEDS FOUR THINGS from the shell that sources it, and says so rather than hoping:
#   fail       prints its argument and exits non-zero
#   say        prints its argument
#   THROWAWAY  the name of the throwaway container that has to go on the way out (may name
#              nothing that exists; `docker rm -f` of a name nobody holds is a no-op)
#   alert      what to do when the run ends with a non-zero status: deploy/backup.sh mails the
#              superadmin through the relay (ADL O19, owner 20.10.2026, "skripta salje mejl preko
#              Breva kad padne"). It is called with the status, BEFORE the work folder goes,
#              because the relay's settings are in it.
#
# ---------------------------------------------------------------------------------------------
# WHY THE WORK FOLDER IS IN MEMORY.
#
# It holds the dump of the production database in plain text (every member's address, birth
# date, document number, password hash and live session), the passphrase that encrypts every copy,
# and the R2 and relay keys. A folder on a disk keeps all of it after a SIGKILL, which no trap can
# catch. In memory the same leftover is gone at the next reboot and has never been on a disk.
#
# THE FILESYSTEM IS ASKED WHAT IT IS, and the name of the folder is not trusted: `stat -f` says
# tmpfs or it says something else, and this refuses on something else. The decision behind it is
# the owner's of 20.10.2026 as recorded in ADL O19 in the proposal's words: "otvoren tekst samo u
# tmpfs".
#
# WHAT THIS DOES NOT CLOSE, written down rather than left to be found, and it is the same sentence
# as in the pour's helper: tmpfs pages can be swapped out, so on a host with swap and without
# encrypted swap a page of the dump could still reach a disk.
#
# `umask 077` goes first because nothing this writes may be readable by another user.
#
# ---------------------------------------------------------------------------------------------
# WHY EACH SIGNAL ENDS THE SCRIPT ITSELF, and why the EXIT trap carries the status on.
#
# A trap on a SIGNAL runs and then the shell carries on with the next line, so a handler that only
# cleaned up would remove the work folder and let the run go on without it. Each one therefore
# ends the script with 128 plus the signal number, which runs the EXIT trap once. The EXIT trap
# reads the status first - it is `$?` on entry and nothing else gives it - mails when it is not
# zero, removes the throwaway container and the folder, and exits with that same status, so that
# systemd records the run as failed.

umask 077

MEMORY=/dev/shm
[ -d "$MEMORY" ] && [ -w "$MEMORY" ] \
  || fail "there is no writable $MEMORY on this host. The dump of the database goes to memory and never to a disk, so this does not run without it."
memory_kind=$(stat -f -c %T "$MEMORY" 2>/dev/null) || memory_kind=unknown
[ "$memory_kind" = tmpfs ] \
  || fail "$MEMORY is '$memory_kind' and not tmpfs, so a file written there can reach a disk, and the dump of the database is written there in plain text. This will not."

WORK=$(mktemp -d "$MEMORY/btl-backup.XXXXXX")

# Where the ENCRYPTED copy is kept, and nothing else: on a disk, outside memory (below says why).
# Empty until the traps are set, so a failure to make it still removes the work folder.
SPOOL_PARENT=/var/tmp
SPOOL=

# The label every container of this run carries, so that the way out can find and remove them
# whatever state the docker client that started them is in (container, below).
STEP_LABEL="btl-backup-run=$$"
# The docker client of the step in flight, empty between steps (step, below).
STEP=

finish() {
  status=$?
  trap - EXIT
  stop_the_step
  if [ "$status" -ne 0 ]; then
    alert "$status" || say "and the alert could not be sent either; nothing but this output says the run failed"
  fi
  docker rm -f "$THROWAWAY" >/dev/null 2>&1 || true
  rm -rf "$WORK"
  if [ -n "$SPOOL" ]; then
    rm -rf "$SPOOL"
  fi
  exit "$status"
}
trap finish EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

SPOOL=$(mktemp -d "$SPOOL_PARENT/btl-backup-copy.XXXXXX")

# ---------------------------------------------------------------------------------------------
# WHY THE ENCRYPTED COPY IS NOT IN MEMORY, and the plain text still is.
#
# The copy is the dump AND every photograph (a member's picture runs to several megabytes),
# encrypted. Held in memory it was one more copy of the whole of production in the host's RAM,
# outside every limit the stack declares, on a host of 3.7 GB that also carries the site
# (deploy/README.md, "What production costs in memory"). It is ciphertext, so the reason the work
# folder is in memory, plain text that must never reach a disk, does not apply to it. It goes to
# SPOOL, which the containers that make, open, send and unpack it have at /copy, and which is
# removed on every way out as the work folder is. The dump, the passphrase and every key stay in
# the work folder, which is still refused unless the filesystem says tmpfs.
#
# WHY A STEP IS RUN IN THE BACKGROUND AND WAITED FOR.
#
# A shell that is running a command in the foreground runs a trap only after that command exits.
# The copy spends nearly all of its time in such commands (the container that packs, the one that
# sends), so a SIGTERM that arrived then did nothing until the step ended, and a step that hangs
# does not end. Measured 21.10.2026 in dash with the docker client of the host: the trap had not
# run after 6 seconds of waiting, and the work folder, with the dump and the passphrase in it, was
# still there. `wait` is the built-in that a trapped signal interrupts at once.
#
# WHY A CONTAINER HAS --init AND IS REMOVED BY LABEL.
#
# The docker client forwards SIGTERM to the container, whose process 1 is `sh transfer.sh`, and a
# process 1 ignores a signal it has no handler for. Measured the same day: the container was still
# running after its client had been sent SIGTERM, and curl with it. `--init` puts a reaper in front
# of it that passes the signal on (measured: the container then ended at once). That helps only
# when somebody signals the client, so the way out also removes every container that carries this
# run's label, which needs nothing from the client.

# One docker command, in the foreground as far as its caller can tell: waits for it, returns its
# status, takes its standard input from where the caller's comes from, and gives the shell back to
# a trapped signal at once. The input goes through descriptor 4 because dash replaces the standard
# input of a command started with & by /dev/null BEFORE it looks at that command's own
# redirections (measured 21.10.2026: `cmd <&0 &` reads /dev/null as well), and the restore reads a
# whole dump through this.
step() {
  { "$@" <&4 & } 4<&0
  STEP=$!
  step_status=0
  wait "$STEP" || step_status=$?
  STEP=
  return "$step_status"
}

# A container of this run, in the foreground. --rm so that none is left by a run that ends
# normally; --init and the label for the reasons above.
container() {
  step docker run --rm --init --label "$STEP_LABEL" "$@"
}

# What the way out does about a step that was still running: stops its docker client, and removes
# every container that carries this run's label.
stop_the_step() {
  if [ -n "$STEP" ]; then
    kill -TERM "$STEP" 2>/dev/null || true
  fi
  leftovers=$(docker ps -q --filter "label=$STEP_LABEL" 2>/dev/null) || leftovers=''
  for one in $leftovers; do
    docker rm -f "$one" >/dev/null 2>&1 || true
  done
}

# The lines of a complaint that may be shown: the server's ERROR line and nothing around it. A
# failed COPY in pg_restore prints the offending row on a CONTEXT line and in a DETAIL, and what
# this script prints lands in the journal of the timer that ran it, which is a disk. The rest stays
# in the work folder, which is removed on the way out. `-a` because the log can carry bytes that are
# not text.
show_errors() {
  shown=$(grep -aE '^(psql:[^ ]*:[0-9]+: |pg_restore: |pg_dump: )?(ERROR|error):' "$1" | sed 's/^/  /' || true)
  if [ -n "$shown" ]; then
    printf '%s\n' "$shown"
  else
    say '  (there is no ERROR line in it)'
  fi
}
