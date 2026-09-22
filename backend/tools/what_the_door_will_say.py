"""WHAT THE FLOOR AT THE DOOR WILL SAY OVER A BRANCH THAT IS NOT MERGED YET.

    python what_the_door_will_say.py <ref-holding-the-snapshot> <ref> [<ref> ...]

`RightsAtTheDoorTest.everyRouteTheControllersMapEitherNeedsARightOrIsNamedHere`
compares a written snapshot with what the dispatcher maps, EXACTLY and both
ways. That is the right shape for a guard and the wrong shape for finding out,
after a merge, that two branches which were each green apart are red together:
the answer only exists once both are in one working tree, and by then the gate
is red and somebody is writing a paragraph in a hurry.

This works the answer out BEFORE the merge. It reads every controller straight
out of git for a ref it never checks out, pairs each mapping with the guard
annotation beside it, reads `READ_BY_ANYBODY` out of `ApiSecurity` at that same
ref, and prints the (VERB PATH) pairs the floor would list. Nothing is checked
out, nothing is written, no branch is touched.

Measured on 19.09.2026, which is why it exists: over `main` plus two branches in
review it named three entries the snapshot would be missing -
`POST /api/pairs`, `PUT /api/pairs/{id}` and `POST /api/inbox` - each of which
would otherwise have arrived one at a time, on a red gate, after a merge.

IT IS A PREDICTION AND SAYS SO. The authority is the real run, for a reason
written down rather than left to be found: the floor asks
`WebInvocationPrivilegeEvaluator`, a live object built out of the chain, and
this asks no running application anything. Where the floor asks the chain which
verbs an open path grants, this ASSUMES the three in READING below.

WHAT KEEPS THAT ASSUMPTION HONEST IS THE FIRST ARGUMENT. Given the ref whose
snapshot is being carried, the prediction over THAT ref must equal THAT snapshot
exactly, and nothing else is reported until it does. An assumption that is too
wide is caught there rather than in the report: were POST in READING,
`POST /api/teams` would be excused and the control would say a named route has
stopped being a route. The same control is what holds SPRINGS_OWN below.

Neither the snapshot nor the open list is written here. Both are read out of the
ref, because a copy of either in this file would be the very fault the branch
that produced it was written to close.

HOW TO READ A REPORT ON A BRANCH THAT IS BEHIND. Each ref is compared against
the snapshot as it stands on the FIRST argument, so a branch that has not been
brought up to date shows every entry merged since it forked under "named but NOT
A ROUTE" - which says the branch is behind and nothing about its own routes.
Only "would have to be NAMED" is about what that branch ADDS. To read both
halves, bring the branch up to date first, or point this at the merge.
"""
import os
import re
import subprocess
import sys

REPO = os.environ.get("B80_REPO", os.getcwd())

WEB = "backend/src/main/java/com/btl/portal/web/"
DOOR = WEB.replace("/main/", "/test/") + "RightsAtTheDoorTest.java"
SECURITY = WEB + "ApiSecurity.java"

GUARDS = ("@RightIsNeeded", "@OnlyTheSuperadmin")
MAPPING = re.compile(r"@(Get|Post|Put|Delete|Patch|Request)Mapping\s*\(([^()]*)\)", re.S)
QUOTED = re.compile(r'"([^"]+)"')
NAMED_METHOD = re.compile(r"method\s*=\s*(?:RequestMethod\.)?(\w+)")

# What the chain grants on an open path. Assumed, and held by the control above.
READING = ("GET", "HEAD", "OPTIONS")

# ApiSecurity keeps TWO open lists, and they do not grant the same verbs. Reading only
# the first made this tool say `GET /api/photos/{name}` "would have to be NAMED" on a ref
# where the floor is green, which is the control failing on main itself.
#
# The second list is not a copy with a variable segment in it: its own note says so, and
# the chain says so in lines of its own. `READ_BY_ANYBODY` is permitted for GET, HEAD and
# OPTIONS; `READ_BY_ANYBODY_UNDER_A_NAME` for GET and HEAD, and OPTIONS is left out ON
# PURPOSE - an OPTIONS digest of one photograph is a sentence with no reader.
#
# So this is a pair per list and not a union of paths. A union would excuse
# `OPTIONS /api/photos/{name}` as well, and the day a controller maps it this tool would
# fall silent about a route the floor WOULD name - the one failure mode a prediction must
# not have. The verbs live beside their list for the same reason: a third list tomorrow is
# one line here, and a list whose verbs differ cannot be added without saying which.
OPEN_LISTS = (
    ("READ_BY_ANYBODY", READING),
    ("READ_BY_ANYBODY_UNDER_A_NAME", ("GET", "HEAD")),
)

# The one route the portal does not write and therefore cannot be read out of it:
# Spring's own BasicErrorController, mapped with no method condition, which is why
# the floor keys it ANY. Held by the control too - drop it and the control says a
# named route has stopped being a route.
SPRINGS_OWN = "ANY /error"

LIMITS_NO_VERB = "ANY"


def git(*args):
    done = subprocess.run(["git", *args], cwd=REPO, capture_output=True)
    if done.returncode != 0:
        sys.exit("git %s failed: %s" % (" ".join(args), done.stderr.decode()[:400]))
    return done.stdout.decode("utf-8", "replace")


def constantAt(ref, path, name):
    """The quoted strings of a `static final ... NAME = ...;` at that ref."""
    text = git("show", "%s:%s" % (ref, path))
    if (name + " =") not in text:
        sys.exit("%s holds no %s at %s" % (path, name, ref))
    return set(QUOTED.findall(text.split(name + " =", 1)[1].split(";", 1)[0]))


def routesAt(ref):
    """Every mapping the portal's own controllers declare, and whether it is guarded."""
    files = [one for one in git("ls-tree", "-r", "--name-only", ref, WEB).splitlines()
             if one.endswith(".java")]
    if not files:
        sys.exit("no controller found at %s, so this would report an empty portal" % ref)

    out = {}
    for rel in files:
        text = git("show", "%s:%s" % (ref, rel))
        for found in MAPPING.finditer(text):
            verb = found.group(1).upper()
            if verb == "REQUEST":
                named = NAMED_METHOD.search(found.group(2))
                verb = named.group(1).upper() if named else LIMITS_NO_VERB

            paths = QUOTED.findall(found.group(2))
            if not paths:
                sys.exit("a mapping in %s names no literal path at %s, so this cannot"
                         " report on it: %r" % (rel, ref, found.group(0)[:120]))

            # Annotations sit between the end of the javadoc and the method body, so
            # that is the window, on both sides of the mapping itself.
            beside = (text[:found.start()].rsplit("*/", 1)[-1]
                      + text[found.end():].split("{", 1)[0])
            guarded = any(one in beside for one in GUARDS)

            for path in paths:
                key = "%s %s" % (verb, path)
                out[key] = out.get(key, True) and guarded
    return out


def wouldBeListed(ref):
    # One entry per open list, each carrying the verbs THAT list grants. Empty is fatal
    # for the same reason it always was: a list this tool cannot read would quietly excuse
    # nothing, and every open route would be reported as missing from the snapshot.
    excuses = []
    for name, verbs in OPEN_LISTS:
        paths = constantAt(ref, SECURITY, name)
        if not paths:
            sys.exit("%s is empty at %s" % (name, ref))
        excuses.append((paths, verbs))

    listed = {SPRINGS_OWN}
    for key, guarded in routesAt(ref).items():
        verb, path = key.split(" ", 1)
        excused = any(path in paths and verb in verbs for paths, verbs in excuses)
        if not guarded and not excused:
            listed.add(key)
    return listed


def report(ref, carried, label):
    listed = wouldBeListed(ref)
    extra = sorted(listed - carried)
    gone = sorted(carried - listed)
    print("  %-34s %3d pairs" % (git("rev-parse", "--short", ref).strip() + " " + label,
                                 len(listed)))
    print("      would have to be NAMED  : %s" % (", ".join(extra) or "none"))
    print("      named but NOT A ROUTE   : %s" % (", ".join(gone) or "none"))
    return extra, gone


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__.strip().splitlines()[2].strip())

    home, targets = sys.argv[1], sys.argv[2:]
    carried = constantAt(home, DOOR, "ANSWERS_WITHOUT_A_RIGHT")

    if not any(" " in one for one in carried):
        sys.exit("the snapshot at %s is still keyed by bare path, and this reports pairs;"
                 " point the first argument at a ref that carries the verb-keyed one" % home)

    print("CONTROL: the prediction over %s must equal the snapshot it carries" % home)
    extra, gone = report(home, carried, "(control)")
    if extra or gone:
        sys.exit("CONTROL FAILED: this tool disagrees with the floor on the ref the"
                 " snapshot comes from, so nothing it says about any other ref is worth"
                 " reading. Fix the tool, not the report.")
    print("CONTROL PASSED: %d pairs, exactly the snapshot, nothing over and nothing"
          " under.\n" % len(carried))

    print("PREDICTION (the authority is the real run after the merge):")
    for ref in targets:
        report(ref, carried, "")


main()
