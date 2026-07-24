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

## Known gaps

- `frontend/nginx.conf` proxies `/api/` to `backend:8080`, which no service in
  `compose.prod.yml` provides yet. API calls in production return 502 until the
  backend is deployed.
- Security headers are set only at the edge. Setting the non-TLS ones
  (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) in
  `frontend/nginx.conf` as well would keep them if the edge config is ever
  rewritten.
