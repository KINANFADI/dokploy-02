# Dokploy team lab

A practice company you can deploy on Dokploy to rehearse everything your real team will do: five roles, three projects, two environments, databases, a worker, a robot fleet over MQTT, backups, schedules, monitoring, Traefik rules, incidents and offboarding.

**Start with [LAB.md](LAB.md).** It walks through every Dokploy tab, step by step, as each team member.

## What's inside

```
apps/
  api/          Product API (Node): orders in Postgres, queue in Redis, notes on a volume,
                failure switches (FAIL_MODE), a "bad release" switch (release.json), report job
  worker/       Takes orders from Redis and marks them done
  web/          Shop front-end (nginx): build-time version + runtime config from env vars
robotics/
  docker-compose.yml   MQTT broker + fleet API/dashboard + telemetry Postgres + robot simulator
  broker/              Mosquitto config
  fleet-api/           Stores telemetry, serves the ops dashboard, sends dock/resume/stop commands
  robot-sim/           Simulated robots (battery, movement, charging, an optional faulty robot)
platform/
  minio/        Local S3 storage to test backups without a cloud account
  uptime-kuma/  Uptime monitoring
  cloudflared/  Cloudflare Tunnel (optional, for public webhooks and previews)
infra/
  traefik/      Rate-limit, Tailscale-only and security-header middlewares
  tailscale/    Example ACL policy for staff, servers and robots
  certs/        Script to make a self-signed certificate for the Certificates tab
scripts/
  traffic.sh    Steady traffic for Monitoring, Requests and Logs
  burst.sh      Burst traffic to test the rate limit
```

## The practice company

| Project | Environments | Services | Type in Dokploy |
|---|---|---|---|
| `platform` | production | `minio`, `uptime-kuma` (`cloudflared` optional) | Compose |
| `product` | staging, production | `product-db` (Postgres), `product-redis`, `api`, `worker`, `web` | Database + Application |
| `robotics` | sim, production | `fleet` (broker, fleet-api, telemetry-db, robot-sim) | Compose |

## Branches

- `staging`: deploys to the staging environment (auto-deploy on).
- `main`: deploys to production (manual deploy by the Head of Software).

```bash
git checkout -b staging && git push -u origin staging
```

## API endpoints

| Route | Purpose |
|---|---|
| `GET /health` | Health check used by Docker |
| `GET /api/info` | Version, environment, DB/Redis/worker/volume status |
| `GET/POST /api/orders` | List and create orders |
| `GET/POST /api/notes` | Notes stored as files on the volume |

`FAIL_MODE` on the API: `none`, `slow` (2 to 4 s delay), `errors` (half the requests fail), `leak` (memory grows with every request).
