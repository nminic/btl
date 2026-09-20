# Production deployment

The production host (`btl-prod`) serves several unrelated sites, so TLS and
public routing are owned by a **shared edge proxy that lives outside this
repository**, at `/opt/edge` on the host. This repository ships the application
containers; none of them must ever bind ports 80 or 443.

Production runs three services, the same three as QA: `frontend`, `backend` and
`postgres`.

```
internet ──▶ edge-caddy (host: /opt/edge, owns :80 and :443)
                 │  reverse_proxy frontend:80
                 ▼
           deploy-frontend-1  (nginx, this repo)
                 │  /api/ ──▶ backend:8080
                 ▼
           deploy-backend-1   (Spring Boot, Flyway on startup)
                 │  jdbc ──▶ postgres:5432
                 ▼
           deploy-postgres-1  (postgres:18, volume deploy_postgres-data)
```

**Nothing but the frontend is reachable from outside the Compose network.**
Neither the backend nor the database publishes a host port, which is also how
the frontend reaches them, so the edge proxy needs no change for either.

## Deploying a new version

**The first time, `/opt/btl/deploy/.env` has to exist before any of this runs.**
Without `PROD_POSTGRES_PASSWORD` in it, every `docker compose` command against
this file refuses and names the variable. See "What the owner must put in `.env`"
below.

```bash
ssh root@btl-prod
cd /opt/btl && git pull
cd deploy
docker compose -f compose.prod.yml build backend
docker compose -f compose.prod.yml up -d --build frontend backend
```

The build is split in two on purpose, exactly as on QA. `up --build` builds
services in parallel, and the Maven build and the npm build together peak at
more memory than this 3.7 GB host has to spare next to the running site. Building
the backend first makes the two peaks consecutive; the second command then finds
the backend image already built and only builds the frontend.

`postgres` is not named in either command because `backend` depends on it and
Compose starts it first, waiting for its healthcheck before the backend is even
created.

Naming the services explicitly keeps the command honest. Recreating the frontend
container causes a brief 502 at the edge (there is no healthcheck gate yet).

Deploying only the frontend, the way it worked before there was a backend, still
works and still touches nothing else:

```bash
docker compose -f compose.prod.yml up -d --build frontend
```

### Never run `docker compose down` on this project

It was already the rule before there was a database. The database adds a second
way for it to go wrong, and that one is not an outage but a loss.

**It takes the network with it.** The Compose network of this project,
`deploy_default`, is the network the edge proxy attaches to as an external
network. `down` takes the site offline and tries to delete that network; if the
edge proxy is ever stopped first, the network really is removed and the edge then
refuses to start with `network deploy_default declared as external, but could not
be found`.

**And `down -v` takes the production database with it.** The rows live in the
named volume `deploy_postgres-data`, and `-v` deletes exactly that. There is no
backup yet (see "Known gaps"), so there is nothing to restore from. A plain
`down` leaves the volume alone; the flag is the difference between an outage and
a loss.

Everything an operator needs is reachable without it:

| to do this | run |
|---|---|
| restart one service | `docker compose -f compose.prod.yml restart backend` |
| restart all three | `docker compose -f compose.prod.yml restart` |
| pick up new code | `up -d --build <service>`, as above |
| stop one service | `docker compose -f compose.prod.yml stop backend` |
| start it again | `docker compose -f compose.prod.yml start backend` |

`restart` and `up -d --build` both leave the network and the volume in place.
`up -d --build` replaces the container, which is the point, and the rows survive
because they are in a named volume rather than in the container's own layer.

### What the owner must put in `.env`

`/opt/btl/deploy/.env` is gitignored and never committed. Compose reads the
`.env` of the directory the deploy command runs from, and that is `deploy/`.
It is **not** the same file as the QA one, which lives in `/opt/btl-qa/deploy/`.

```bash
cd /opt/btl/deploy
# umask first, so the file is never world readable, not even for a moment
(umask 077; cp ../.env.example .env)   # then edit: keep the PROD_* lines AND BTL_SUPERADMIN_EMAIL, set real values
```

**BEFORE that address goes into `.env`, REGISTER IT AND CONFIRM IT.** Owner decision,
20.09.2026 (PDL P21). Raise the stack with `BTL_SUPERADMIN_EMAIL` still empty, register
through the portal like any member, click the link in the mail, and only then put the
address into `.env` and restart. The role is derived, so it attaches to that account the
moment the setting names it.

The order is the whole protection, and it was measured rather than assumed: with the
setting already in place, anyone who knows the address can register it FIRST with his own
password. The portal then mails the confirmation to the owner, who clicks it because he is
expecting exactly that mail - and the attacker signs in as superadmin with the password he
chose. Confirming proves somebody READS that mailbox, not that whoever holds the password
owns it.


Eight names, and no value of any of them belongs in this repository or in any
message:

| name | what it is | required |
|---|---|---|
| `PROD_POSTGRES_DB` | production database name | no, defaults to `btl` |
| `PROD_POSTGRES_USER` | production role | no, defaults to `btl` |
| `PROD_POSTGRES_PASSWORD` | that role's password | **yes** |
| `PROD_MAIL_HOST` | relay host | no, defaults to `smtp-relay.brevo.com` |
| `PROD_MAIL_PORT` | relay port | no, defaults to `587` |
| `PROD_MAIL_USERNAME` | Brevo SMTP login | not to START, but see below |
| `PROD_MAIL_PASSWORD` | Brevo SMTP key | not to START, but see below |
| `BTL_SUPERADMIN_EMAIL` | address that carries the superadmin role (PDL P21) | not to START, but the portal has no superadmin without it |

**The two mail variables are the pair that fails quietly.** They are empty by default ON PURPOSE:
a missing relay key must never keep the public site down, so the stack starts without them. What it
does not do is send. No address is ever confirmed and no password is ever reset.

**FOUR ENDPOINTS NOW SEND, so an empty key is no longer harmless.** This paragraph used to say
`Postman` had no caller in `backend/src/main`; measured on 20.09.2026 it has **four** -
`RegistrationApi`, `EmailConfirmationApi`, `PasswordResetApi` and `ModeratorWriteApi`. The
sentence was true when it was written and is not any more.

What that changes for you: `RegistrationApi.send` catches `MailException` and writes
`LOG.warn` rather than failing the request, so with the key blank a member registers,
gets 204, and waits for a message that never arrives. His address stays unconfirmed - and
since the superadmin role hangs on a CONFIRMED address (PDL P21), raising production with
these two blank leaves the portal with **no superadmin** and no screen saying why. **Both or
neither** still holds, but now it has to be done BEFORE the owner registers, not after. **Both or neither:** the key is shown by Brevo exactly once, so the moment to paste
it is also the moment to paste the login beside it.

`PROD_POSTGRES_PASSWORD` has no default: with it unset, Compose refuses to do
anything and names the variable, rather than starting the production database
without one. Measured with the file as committed:

```
error while interpolating services.postgres.environment.POSTGRES_PASSWORD:
required variable PROD_POSTGRES_PASSWORD is missing a value:
set PROD_POSTGRES_PASSWORD in deploy/.env, copied from .env.example
```

The two mail credentials are deliberately **not** required. Making them required
would keep the public site from coming up until somebody had pasted a key in, and
a portal that serves every page but cannot send a confirmation mail is a smaller
failure than a portal that is down. With them unset the relay refuses the login
and the send throws, loudly, to whoever asked for the message.

The Brevo key is generated in that panel under SMTP & API, is shown **exactly
once**, and belongs in the owner's password manager. It is a different key from
the QA one: one key shared between the two stacks would mean a key leaked from QA
sends mail as the real portal.

### Checking that production really came up

```bash
cd /opt/btl/deploy
docker compose -f compose.prod.yml ps
```

All three must read `Up`. `deploy-postgres-1` and `deploy-backend-1` carry a
healthcheck and must read `Up (healthy)`; `deploy-frontend-1` has none and reads
a plain `Up`. That is the same question the backend's own healthcheck asks rather
than a second opinion: it curls `/actuator/health`, whose aggregate status
includes Spring's DataSource indicator, so it goes red when the database is
unreachable and not only when the process has died.

**`healthy` is not enough by itself, and this is where production differs from
QA.** A backend that came up against an *empty* schema also answers `UP`, because
the database is reachable and that is all that indicator asks. On QA the `db`
component can be read out of the endpoint, because `compose.qa.yml` sets
`MANAGEMENT_ENDPOINT_HEALTH_SHOW_DETAILS=always`; `compose.prod.yml` must not
copy that line, so the question is put to the database instead, which is the
better floor anyway:

```bash
docker compose -f compose.prod.yml exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
   "select count(*) from flyway_schema_history where success"'
ls ../backend/src/main/resources/db/migration/V*__*.sql | wc -l
```

**The two numbers must be equal.** They are the count of migrations Flyway has
applied and the count of migration files this checkout carries; a number written
on this page instead would be wrong the first time somebody merged a migration.
The role and the database are read out of the container's own environment for the
same reason, rather than written here: whatever `PROD_POSTGRES_USER` and
`PROD_POSTGRES_DB` were set to on this host is what the container was started
with, and that is the only copy that cannot be stale. If
the first command errors because `flyway_schema_history` does not exist, Flyway
never ran, and the backend log says why:

```bash
docker compose -f compose.prod.yml logs backend | head -50
```

**An empty schema is a fault, not a resting state.** It means Flyway found
nothing on the classpath and the migrations were not packaged into the jar.

Flyway runs at backend startup, so a migration merged to `main` is applied by the
next `up -d --build backend`, with no separate step.

Finally, that the site itself answers, which is the only check that goes through
the edge proxy:

```bash
curl -sI https://balkanskatrkackaliga.net | head -1
curl -sS -o /dev/null -w '%{http_code}\n' https://balkanskatrkackaliga.net/api/
# 401 means healthy: the backend answered, and nothing under /api/ is open by name.
# 502 means nginx reached nobody, so the backend is down or was never started.
# 200 would mean this path had been opened to anybody, which it is not.
```

### When a member says they cannot sign in

Before looking at the backend at all, rule out the rate limit. Since 13.09.2026
`frontend/nginx.conf` answers **429** to the seventh sign-in attempt in quick succession
from one visitor, and it does so **without ever reaching the backend**.

That makes the state look worse than it is: `docker compose ps` shows the backend and the
database `Up (healthy)` and the frontend a plain `Up` (it carries no healthcheck, see above),
and `docker compose logs backend` shows nothing at all, because the request never got there.
Healthy containers and a silent log is the picture that looks most like a deep fault and is
not one.

```bash
docker compose -f compose.prod.yml logs frontend --since 30m | grep 'limiting requests'
```

Nothing in that output means the limit is not what stopped them. A line there names the
address that was limited.

**One member refused is the limit doing its job. Every member refused at once is not.** The
limit is keyed on the address the edge proxy forwards, so visitors are counted apart from
each other - as long as they really arrive apart. Two ways they do not, and both point at
`frontend/nginx.conf` rather than at the backend: the forwarded address stopped arriving at
all, so everybody fell into one bucket; or many visitors share one rightmost forwarded
address, which is what a CDN in proxy mode or a large NAT looks like from here. **The second
has not been measured against this deployment** and is written down so that whoever meets it
does not spend the night in the database.

### What production costs in memory

The host has 3.7 GB in total and carries the edge proxy, the whole QA stack and
this one. The two services added here therefore carry an explicit `mem_limit`,
the same numbers QA measured at rest, so a runaway JVM cannot take the public
site down with it. The JVM reads that limit, not the host's total, and sizes its
heap from it.

| | limit |
|---|---|
| `deploy-postgres-1` | 512 MB |
| `deploy-backend-1` | 640 MB (352 MB max heap) |

That is 1152 MB of ceiling here and another 1152 MB on QA, against roughly
450 MB for the OS and Docker and some 55 MB for the edge proxy and the nginx
containers: about 2.8 GB of 3.7 GB if every limit were reached at once, which they
are not, since QA measured 350 MB at rest for the same pair. The limits are
ceilings, not reservations.

**If the host ever gets tight, QA is the one that shrinks.** Production is the
site; QA is a rehearsal of it.

The tight moment is not the running stack but the build, which is why the deploy
above builds the backend on its own. Whether the host has any swap has not been
checked; `free -h` on `btl-prod` answers it.

## The contract with the edge proxy

Three things must stay true. Two of them break loudly, with a 502. **The first
one can break silently and cost data**, so read it as the expensive one:

1. **The Compose network must be named `deploy_default`.** Compose derives it
   from the project name, which defaults to the directory holding the compose
   file (`deploy`). It changes if anyone renames that directory, adds a
   top-level `name:` to the compose file, or deploys with `-p` /
   `--project-name` / `--project-directory` / `COMPOSE_PROJECT_NAME`.
   `compose.qa.yml` pins its project name with a top-level `name: qa` for exactly
   the opposite reason; **`compose.prod.yml` must never grow one.**

   **What actually happens when it changes is worse than a 502.** The project
   name also names the VOLUME. `docker compose -f compose.prod.yml -p btl up -d`
   is a natural thing to type while chasing a 502, and it starts a stack on
   `btl_postgres-data`: a brand new, empty database. Flyway builds the schema,
   the portal looks healthy, members register into it, and the real data sits in
   an orphaned volume that `docker volume prune` will eventually take. Measured:
   `-p prod` gives `prod_postgres-data` and `prod_default`; the default gives
   `deploy_postgres-data` and `deploy_default`. **If the site is 502, fix the
   routing; never reach for `-p`.**
2. **The service must stay reachable as `frontend` on port 80**, because that
   is the upstream the edge proxy dials.
3. **The backend service must stay named `backend` and stay on port 8080**,
   because `frontend/nginx.conf` proxies `/api/` to `http://backend:8080` and
   resolves that name through Docker DNS at request time. Renaming the service is
   a 502 that nothing in this file reports. That contract is with nginx rather
   than with the edge, but it breaks the same way.

**And the edge must never dial `backend` or `postgres` by bare name.** The edge
container sits on `deploy_default` *and* on `qa_default`, and both projects now
carry services under those two names, so Docker DNS would answer with whichever
it likes.

**`frontend` is not distinct either, and that is measured rather than assumed.**
Both projects name the service `frontend`; QA additionally answers to
`qa-frontend`, but a declared alias does not replace the service name. A
container attached to both networks resolves `frontend` to exactly one address
and gives no hint which, and which one wins is decided by the NETWORK NAME
rather than by anything in this repository: `deploy_default` sorts before
`qa_default`, so production wins today by the letter `d`. Add a third project
whose network sorts earlier and it takes the name.

So the edge dials `qa-frontend` for QA, and for production it relies on that
sort order. Point 1 above is therefore not only about a 502: rename the
production project and the edge may quietly serve the QA bundle, which is built
with `VITE_DEV_TOOLS: "1"` and carries the role switch and the date switch.

Verify after a deploy:

```bash
docker inspect -f '{{json .NetworkSettings.Networks}}' deploy-frontend-1
curl -sI https://balkanskatrkackaliga.net | head -1
```

## What the edge proxy holds (copy for disaster recovery)

`/opt/edge` is not in this repository. If the host is ever rebuilt, recreate it
before this stack is publicly reachable. As of July 2026 its BTL parts are:

`/opt/edge/compose.yml` (project name `edge`) runs `caddy:2-alpine` as
`edge-caddy`, publishes `80:80` and `443:443`, mounts `./Caddyfile`, `./sites`
and `/srv` read-only plus its own `caddy-data` / `caddy-config` volumes, and
joins two networks: its own default and `deploy_default` (declared external).

`/opt/edge/Caddyfile` is a one-liner that imports every site file:
`import /etc/caddy/sites/*.caddy`.

`/opt/edge/sites/btl.caddy` holds the BTL vhost, the www redirect and the
security headers:

```caddy
www.balkanskatrkackaliga.net {
	redir https://balkanskatrkackaliga.net{uri} permanent
}

balkanskatrkackaliga.net {
	reverse_proxy frontend:80
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
	}
}
```

Certificates are issued and renewed automatically by the edge proxy, so
nothing here needs a certificate mount.

## QA environment

`qa.balkanskatrkackaliga.net` runs everything being prepared before it goes to
production. It is a **second working copy**, `/opt/btl-qa`, with its own Compose
project, so pulling on QA never moves production.

QA runs the same three services as production, `frontend`, `backend` and
`postgres`. It had them first: production was deliberately left on `frontend`
alone until QA had run this arrangement, and it grew the other two once QA had.

```
internet ──▶ edge-caddy ──▶ qa-frontend  (nginx, this repo)
                                 │  /api/ ──▶ backend:8080
                                 ▼
                            qa-backend   (Spring Boot, Flyway on startup)
                                 │  jdbc ──▶ postgres:5432
                                 ▼
                            qa-postgres  (postgres:18, volume qa_postgres-data)
```

Only `frontend` publishes a host port, and only on loopback. The backend and
the database are reachable **inside the `qa_default` network and nowhere else**,
which is also how the frontend reaches them, so the edge proxy needs no change
for either of them.

### Secrets

The database name, role and password come from `/opt/btl-qa/deploy/.env`, which
is gitignored and never committed. Compose reads the `.env` of the directory the
deploy command runs from, and that is `deploy/`. Copy the seven `QA_*` lines (three `QA_POSTGRES_*` and four `QA_MAIL_*`) out
of `.env.example` in the repository root and set a real password:

```bash
cd /opt/btl-qa/deploy
# umask first, so the file is never world readable, not even for a moment
(umask 077; cp ../.env.example .env)   # then edit: keep the QA_* lines AND BTL_SUPERADMIN_EMAIL, set the password
```

**ON QA THIS ORDER DOES NOT PROTECT YOU, and the decision says so.** PDL P21 records the
cost the owner accepted: the measure "leans on discipline at every new stack and does NOT
protect QA, where the database is wiped". Refreshing QA drops `qa_postgres-data` and replays
Flyway (see below) WITHOUT touching `.env`, so the moment the database is empty the setting
already names an address that no account holds - which is the open window itself. Doing the
order here means raising QA with the setting blank, registering, confirming, and only then
putting the address back; the refresh procedure below does not do that on its own.


The names are `QA_POSTGRES_DB`, `QA_POSTGRES_USER` and `QA_POSTGRES_PASSWORD`,
deliberately different from the `POSTGRES_*` names the root `docker-compose.yml`
uses, so that QA and production cannot end up on the same database, role or
password by someone copying one env file over the other on this shared host.
`QA_POSTGRES_PASSWORD` has no default: with it unset, Compose refuses to do
anything and names the variable, rather than starting a database without one.

**Four more names this stack reads, and they were missing from this paragraph until
20.09.2026:** `QA_MAIL_HOST`, `QA_MAIL_PORT`, `QA_MAIL_USERNAME` and `QA_MAIL_PASSWORD`.
They behave like their `PROD_MAIL_*` counterparts - empty by default on purpose, so a
stack raised without them comes up and simply sends nothing. They were not listed here
while Compose asked for them, which is the same quiet gap `BTL_SUPERADMIN_EMAIL` fell
into; the case `everySettingEveryStackAsksForIsNamedInTheRunbookThatTellsTheOwnerWhatToKeep`
now fails the build for any name a stack reads and this file does not mention.

### Deploying

```bash
cd /opt/btl-qa && git checkout main && git pull
cd deploy
docker compose -f compose.qa.yml build backend
docker compose -f compose.qa.yml up -d --build frontend backend
```

The build is split in two on purpose. `up --build` builds services in parallel,
and the Maven build and the npm build together peak at more memory than this
3.7 GB host has to spare next to the running site. Building the backend first
makes the two peaks consecutive; the second command then finds the backend image
already built and only builds the frontend.

`postgres` is not named in either command because `backend` depends on it and
Compose starts it first, waiting for its healthcheck before the backend is even
created.

Deploying only the frontend, the way it worked before there was a backend, still
works and still touches nothing else:

```bash
docker compose -f compose.qa.yml up -d --build frontend
```

### Checking that the backend really sees the database

```bash
docker compose -f compose.qa.yml ps
docker exec qa-backend curl -fsS http://127.0.0.1:8080/actuator/health
```

`ps` must show `qa-backend` as `Up (healthy)`, which is the same question asked
by the container healthcheck rather than a second opinion: it curls
`/actuator/health`, whose aggregate status includes Spring's DataSource
indicator, so it goes red when the database is unreachable and not only when the
process has died. Reaching for the health endpoint by hand adds the detail, and
the part that answers this heading is the `db` component:

```json
{"components":{"db":{"details":{"database":"PostgreSQL",
 "validationQuery":"isValid()"},"status":"UP"}, ...},"status":"UP"}
```

Details are shown because `compose.qa.yml` sets
`MANAGEMENT_ENDPOINT_HEALTH_SHOW_DETAILS=always`. That is a QA-only line: the
endpoint is not routed from the edge and the whole site is behind basic auth,
but `compose.prod.yml` must not copy it. `/actuator/health` is the only thing on
the backend that answers without credentials; every other path under `/actuator`
returns 401, because Spring Security is on the classpath and only the health
endpoint is exempt by default.

When the database is genuinely gone, the failure reads as
`Health check exceeded timeout (5s)` rather than as a body saying `db: DOWN`.
That is the connection pool waiting out its own 30 second timeout, which is
longer than the healthcheck's patience. The container still goes `unhealthy`,
which is the point, and it returns to `healthy` on its own once the database is
back, with no restart. Measured both ways.

To see the same thing from the database side, which also shows that Flyway ran:

```bash
docker exec qa-postgres psql -U btl_qa -d btl_qa -c '\dt'
```

It must list **every table the migrations create**, plus Flyway's own
`flyway_schema_history`. The number is not written here on purpose: `main` carried four migrations
when this was first written and carries twenty one now, and a number in a runbook is wrong the
first time somebody adds one. What the backend log says is `Migrating schema "public" to version
"1"` and so on up to the highest `V` file in
`backend/src/main/resources/db/migration`, which is where to look for the number rather than here.

**An empty schema is a fault, not a resting state.** It means Flyway found
nothing on the classpath, and the migrations that `main` carries were not
packaged into the jar. Read the log before anything else; a backend that came
up against an empty schema will still answer `/actuator/health` with `UP`,
because the database is reachable and that is all that indicator asks.

Flyway runs at backend startup, so a migration merged to `main` is applied by
the next `up -d --build backend`, with no separate step.

### What QA costs in memory

The host has 3.7 GB in total and already carries the edge proxy, the production
frontend and the QA frontend. Both new services therefore carry an explicit
`mem_limit`, so a runaway JVM cannot take the public site down with it. The JVM
reads that limit, not the host's total, and sizes its heap from it.

Whether the host has any swap has not been checked; `free -h` on `btl-prod`
answers it. Hetzner cloud images generally ship without, and if that holds here
then the build peak below is a hard ceiling rather than a slow patch.

| | limit | measured at rest |
|---|---|---|
| `qa-postgres` | 512 MB | 88 MB |
| `qa-backend` | 640 MB (352 MB max heap) | 264 MB |

Measured on an idle stack with an empty schema, so the database figure will grow
with the data; the limit is what it may not pass. Together the two sit around
350 MB at rest and cannot exceed 1152 MB, against roughly 450 MB for the OS and
Docker and some 55 MB for the edge proxy and the two nginx containers. The
running stack is comfortable; the tight moment is the build, which is why the
deploy above builds the backend on its own.

Four things hold it together, and all four are easy to break:

1. The edge proxy dials `qa-frontend:80`. That name is both the container name
   and a network alias in `compose.qa.yml`; production answers to `frontend` on
   its own network, and the two must not collide.
2. The edge container is attached to the `qa_default` network as well as
   `deploy_default`. It is declared in `/opt/edge/compose.yml`; attaching a
   running container with `docker network connect` avoids restarting the edge
   and taking production down for a few seconds.
3. QA is behind basic auth, is never cached and is never indexed. Those live in
   `/opt/edge/sites/qa.caddy`.
4. The backend service must stay named `backend` and stay on port 8080, because
   `frontend/nginx.conf` proxies `/api/` to `http://backend:8080` and resolves
   that name through Docker DNS at request time. Renaming the service is a 502
   that nothing in this file reports. Note that because the edge container sits
   on `qa_default` as well as on `deploy_default`, and **both** projects now
   carry a `backend` and a `postgres`, neither may be dialled by bare name from
   the edge, or Docker DNS will answer with whichever it likes.

### Reviewing QA when TLS is broken on the reviewer's machine

Antivirus software and corporate proxies that inspect HTTPS replace the
certificate with one signed by their own authority. When that authority is not
trusted, every site fails with `ERR_CERT_AUTHORITY_INVALID`, including this
one, and no server-side change can repair it. HSTS with `includeSubDomains`
from the apex also means the browser will not offer a way through.

The way around it is a tunnel, which carries no TLS at all:

```bash
ssh -N -L 8080:127.0.0.1:8081 btl-prod
```

Then open `http://localhost:8080`. The QA container binds `127.0.0.1:8081` on
the host for exactly this; loopback only, so nothing outside the host can reach
it. There is no basic auth on this path, because the authentication is the SSH
key.

The same hard rules apply as in production: never bind ports 80 or 443, and
never run `docker compose down`, because it deletes the network the edge proxy
is attached to.

## Known gaps

- **The production database has no backup.** Decision O19 calls for a daily
  `pg_dump` and there is none: `deploy_postgres-data` is a named volume on one
  host, with no copy anywhere. Until that exists, the only thing standing between
  the portal and a total loss of members, results and payments is that nobody
  runs `docker compose down -v` and that the host does not die. This was a
  sentence about something that did not exist yet; it is now a live risk and the
  next thing this directory needs.
  QA is different and stays different: it holds nothing that needs restoring, so
  `qa_postgres-data` is backed up by nothing on purpose and is rebuilt by
  dropping it and letting Flyway run again.
- **`compose.prod.yml` is measured, and it took a hole to get there.** `PostmanTest`
  read `compose.qa.yml` BY NAME, so when this directory grew a second stack the new
  one was covered by nothing: measured, deleting
  `SPRING_MAIL_PROPERTIES_MAIL_SMTP_STARTTLS_REQUIRED` from `compose.prod.yml` left
  the whole backend suite green. It now reads every `deploy/compose*.yml` off the
  directory, with a floor that there are at least two of them, so the next stack is
  covered the day it is added rather than the day somebody remembers. Measured after
  the change: deleting that line from either stack turns the suite red and the message
  names the file.
- **`proveri-qa.sh` has no production counterpart.** It asks the running QA stack
  what it is really serving, and compares the live schema against a reference
  database it builds from the migrations. Production is where a schema that has
  drifted actually costs data, so it needs the same check more than QA does, not
  less. It is not a copy of that script: a second copy would drift from the first,
  and the honest form is one script that takes the stack as a parameter, measured
  on the host rather than here. The reference database it builds is a throwaway
  `postgres:18` container, which on this 3.7 GB host next to the live site is a
  decision of its own.
- Security headers are set only at the edge. Setting the non-TLS ones
  (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) in
  `frontend/nginx.conf` as well would keep them if the edge config is ever
  rewritten.
