# Production deployment

The production host (`btl-prod`) serves several unrelated sites, so TLS and
public routing are owned by a **shared edge proxy that lives outside this
repository**, at `/opt/edge` on the host. This repository ships only the
application container; it must never bind ports 80 or 443.

```
internet ──▶ edge-caddy (host: /opt/edge, owns :80 and :443)
                 │  reverse_proxy frontend:80
                 ▼
           deploy-frontend-1  (this repo: deploy/compose.prod.yml)
```

## Deploying a new version

```bash
ssh root@btl-prod
cd /opt/btl && git pull
cd deploy && docker compose -f compose.prod.yml up -d --build frontend
```

Naming the `frontend` service explicitly keeps the command honest even if a
second service is added later. Recreating the container causes a brief 502 at
the edge (there is no healthcheck gate yet).

**Never run `docker compose down` on this project.** The Compose network of
this project, `deploy_default`, is the network the edge proxy attaches to as
an external network. `down` takes the site offline and tries to delete that
network; if the edge proxy is ever stopped first, the network really is
removed and the edge then refuses to start with
`network deploy_default declared as external, but could not be found`.
To restart, use `docker compose -f compose.prod.yml restart frontend`.

## The contract with the edge proxy

Two things must stay true, or public routing silently breaks with a 502:

1. **The Compose network must be named `deploy_default`.** Compose derives it
   from the project name, which defaults to the directory holding the compose
   file (`deploy`). It changes if anyone renames that directory, adds a
   top-level `name:` to the compose file, or deploys with `-p` /
   `--project-name` / `--project-directory` / `COMPOSE_PROJECT_NAME`.
2. **The service must stay reachable as `frontend` on port 80**, because that
   is the upstream the edge proxy dials.

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

QA runs three services: `frontend`, `backend` and `postgres`. Production still
runs only `frontend`; it gets a database once QA has proved this arrangement.

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
deploy command runs from, and that is `deploy/`. Copy the three `QA_*` lines out
of `.env.example` in the repository root and set a real password:

```bash
cd /opt/btl-qa/deploy
cp ../.env.example .env      # then edit: keep the QA_* lines, set the password
chmod 600 .env
```

The names are `QA_POSTGRES_DB`, `QA_POSTGRES_USER` and `QA_POSTGRES_PASSWORD`,
deliberately different from the `POSTGRES_*` names the root `docker-compose.yml`
uses, so that QA and production cannot end up on the same database, role or
password by someone copying one env file over the other on this shared host.
`QA_POSTGRES_PASSWORD` has no default: with it unset, Compose refuses to do
anything and names the variable, rather than starting a database without one.

### Deploying

```bash
cd /opt/btl-qa && git checkout main && git pull
cd deploy
docker compose -f compose.qa.yml build backend
docker compose -f compose.qa.yml up -d --build frontend backend
```

The build is split in two on purpose. `up --build` builds services in parallel,
and the Maven build and the npm build together peak at more memory than this
4 GB host has to spare next to the running site. Building the backend first
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

Until the first migration is merged, the only table there is
`flyway_schema_history`, and the backend log says `No migrations found` followed
by `Schema "public" is up to date`. An empty schema is the expected state, not a
failure: Flyway runs at backend startup, so a migration merged to `main` is
applied by the next `up -d --build backend`, with no separate step.

### What QA costs in memory

The host has 4 GB in total and already carries the edge proxy, the production
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
   that nothing in this file reports. Note that because the edge container also
   sits on `qa_default`, the names `backend` and `postgres` are now visible to
   it; when production grows the same two services, they must not be dialled by
   bare name from the edge, or Docker DNS will answer with whichever it likes.

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

- `frontend/nginx.conf` proxies `/api/` to `backend:8080`, which no service in
  `compose.prod.yml` provides yet. API calls in production return 502 until the
  backend is deployed there too. QA has provided it since this file grew its
  `backend` and `postgres` services; production is deliberately left behind
  until QA has run that arrangement.
- The production database of decision O19 does not exist yet, and neither does
  the daily `pg_dump` it calls for. QA holds nothing that needs restoring, so
  the QA volume `qa_postgres-data` is backed up by nothing on purpose; it is
  rebuilt by dropping it and letting Flyway run again.
- Security headers are set only at the edge. Setting the non-TLS ones
  (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) in
  `frontend/nginx.conf` as well would keep them if the edge config is ever
  rewritten.
