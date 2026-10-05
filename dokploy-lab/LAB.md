# Dokploy team lab: every tab, every role, A to Z

You play five people at a startup and run a whole company's platform on Dokploy. Each exercise says **who** does it, **where** in Dokploy, **what to do**, and **what you should see**. Tick the boxes as you go.

Dokploy changes between versions. If a tab or field has a slightly different name, use the closest match. If a feature doesn't exist in your version, note it and move on.

**Addresses used below.** Your server is `192.168.234.128`. Every domain uses sslip.io, which points any name containing that IP back to your server:

| Service | Address |
|---|---|
| Dokploy panel | `http://192.168.234.128:3000` |
| API (staging / production) | `http://api-staging.192.168.234.128.sslip.io` / `http://api.192.168.234.128.sslip.io` |
| Web (staging / production) | `http://shop-staging.192.168.234.128.sslip.io` / `http://shop.192.168.234.128.sslip.io` |
| Fleet dashboard (sim / production) | `http://fleet-sim.192.168.234.128.sslip.io` / `http://fleet.192.168.234.128.sslip.io` |
| MinIO console / S3 API | `http://minio.192.168.234.128.sslip.io` / `http://s3.192.168.234.128.sslip.io` |
| Uptime Kuma | `http://status.192.168.234.128.sslip.io` |

Dokploy shows a red "DNS" warning for these names because the IP is private. You can ignore it in the lab.

---

## The five roles

| Role | Dokploy role | Access | You'll practise |
|---|---|---|---|
| **Head of Software** (you, the first account) | Owner | Everything | People, approvals, production releases, audits |
| **DevOps / IT** | Admin | Everything except ownership | Servers, settings, Traefik, backups, cleanup |
| **Backend engineer** | Member | `product`, `robotics` | API, worker, databases, jobs |
| **Frontend engineer** | Member | `product` | Web app, previews |
| **Robotics engineer** | Member | `robotics` | Fleet stack, MQTT, robot data |

To switch roles, use a different browser profile or private window for each person.

---

## Phase 0: Prepare (Head of Software, 20 min)

- [ ] **0.1 Push the lab to GitHub.** Create an empty repo `dokploy-lab`, then from the unzipped folder:
  ```bash
  git init && git add . && git commit -m "Dokploy lab"
  git branch -M main
  git remote add origin https://github.com/<you>/dokploy-lab.git
  git push -u origin main
  git checkout -b staging && git push -u origin staging
  ```
  *Expect:* both `main` and `staging` branches on GitHub, with `apps/`, `robotics/` and `platform/` at the top level.
- [ ] **0.2 Prepare four email addresses** for the other roles. Gmail plus-addresses work: `you+devops@gmail.com`, `you+backend@gmail.com`, `you+frontend@gmail.com`, `you+robotics@gmail.com`.
- [ ] **0.3 Create a Discord server** (or a Telegram bot) for alerts. In Discord: channel settings, then Integrations, then Webhooks, then copy the URL.
- [ ] **0.4 Optional:** a second VM (Ubuntu, 2 GB RAM or more) to act as the VPS or a build server. Without it, skip the parts marked *needs second server*.

---

## Phase 1: People and organisation (Head of Software)

- [ ] **1.1 Profile.** Settings → **Profile**. Set your name, a strong password, and enable two-factor login. Create an API token and store it in a password manager.
  *Expect:* the next login asks for a 2FA code.
- [ ] **1.2 License.** Settings → **License**. Note your plan and which features are locked (often SSO, white-labeling, some audit features).
  *Decision to record:* "Free plan is enough for now" or "We need X".
- [ ] **1.3 SSO.** Open the **SSO** page if your version has it. Read which providers it supports (Google, Microsoft, OIDC).
  *Decision:* "Turn on when we pass N people" or "Not needed yet". Don't configure it unless you have a license and a test identity provider.
- [ ] **1.4 White-labeling.** Open **Enterprise Whitelabeling** if present.
  *Decision:* only useful if customers will use the panel. Record "Not needed".
- [ ] **1.5 Users: invite the team.** Settings → **Users** → invite:
  - `you+devops` as **Admin**
  - `you+backend`, `you+frontend`, `you+robotics` as **Member**

  Copy each invitation link and open it in that person's browser profile to accept.
  *Expect:* five users in the list.
- [ ] **1.6 Tags.** Settings → **Tags**. Create `team:product`, `team:robotics`, `team:platform`, `critical`, `public`, `internal`.
- [ ] **1.7 Each teammate enables 2FA** in their own Profile (log in as each one).

---

## Phase 2: Platform settings (DevOps)

Log in as **DevOps**.

- [ ] **2.1 Web Server.** Settings → **Web Server**. Look at server info, the Traefik controls, and the update check. Don't update during the lab; just note the version.
  - Open the **Docker cleanup** option for this server and **turn it on** (daily removal of unused images).
  - *Expect:* a cleanup schedule shown as active.
- [ ] **2.2 Deployments (settings).** Settings → **Deployments**. Set concurrent builds for the Dokploy server to **2**. You'll test it in 4.9.
- [ ] **2.3 SSH Keys.** Settings → **SSH Keys** → generate a key named `vps-deploy`. Copy the public key.
  - *Needs second server:* on the second VM, add it to `~/.ssh/authorized_keys` for root (or a sudo user).
  - Generate a second key, `github-deploy-key`. Add its public key in GitHub, under repo Settings → Deploy keys, read-only.
- [ ] **2.4 Remote Servers.** *Needs second server.* Settings → **Remote Servers** → Add. Use the VM's IP (in real life, its **Tailscale IP**), user `root`, key `vps-deploy`. Choose the server type:
  - **Deploy server:** runs apps. This is the VPS role.
  - **Build server:** only builds images; it never appears as a deploy target. Try this type on a second test entry if you want to see the difference.

  Run the setup action Dokploy offers, then turn on Docker cleanup for this server too.
  *Expect:* server shows as ready.
- [ ] **2.5 Git.** Settings → **Git** → GitHub → create or install the Dokploy GitHub App on your account, and give it access to `dokploy-lab` only.
  *Expect:* the repo appears in a dropdown when creating services. Webhooks won't reach a private server yet; Phase 9 fixes that.
- [ ] **2.6 Registry.** Settings → **Registry** → add GitHub Container Registry:
  - URL `ghcr.io`
  - username: your GitHub user
  - password: a GitHub token with `write:packages` and `read:packages`

  Use **Test** if available. This is needed for build servers, remote deploy servers, and (in many versions) rollbacks.
- [ ] **2.7 Secrets.** Settings → **Secrets** (or project-level shared variables in your version). Create `LAB_SECRET_KEY` with a long random value. You'll reference it from services instead of retyping it.
- [ ] **2.8 Notifications.** Settings → **Notifications** → add Discord (or Telegram) with your webhook. Turn on: app deploy, app build error, database backup, Docker cleanup, Dokploy restart, and server threshold alerts if offered. Click **Test**.
  *Expect:* a test message in Discord.
- [ ] **2.9 Certificates.** On your computer:
  ```bash
  cd infra/certs && ./make-lab-cert.sh secure.192.168.234.128.sslip.io
  ```
  Settings → **Certificates** → add, paste `lab.crt` and `lab.key`, name it `lab-selfsigned`.
  *Expect:* certificate listed with its expiry date (90 days). In real life this would be a Cloudflare Origin Certificate.
- [ ] **2.10 DNS Providers.** Settings → **DNS Providers**. *Needs a Cloudflare domain.* Add Cloudflare with an API token limited to "Zone DNS Edit" on one zone. Without a domain, just read the form and note what's required.
- [ ] **2.11 AI.** Settings → **AI** → add a provider key (OpenAI, Anthropic and others). Optional, because it costs API credits. Used in 3.6.
- [ ] **2.12 Audit Logs.** Settings → **Audit Logs**.
  *Expect:* entries for everything above (users invited, keys created, settings changed).

---

## Phase 3: Projects and shared platform (DevOps)

- [ ] **3.1 Home.** Open **Home**. Note the shortcuts and the summary of projects and servers.
- [ ] **3.2 Projects.** **Projects** → create:
  - `platform` (environment: production)
  - `product` (environments: staging, production)
  - `robotics` (environments: sim, production)

  Add tags: `team:platform`, `team:product`, `team:robotics`.
- [ ] **3.3 User permissions.** Back in Settings → **Users**, edit each Member:
  - **Backend:** `product` + `robotics`; can create and deploy services, can't delete, no Docker or Traefik access
  - **Frontend:** `product` only
  - **Robotics:** `robotics` only
- [ ] **3.4 MinIO (local S3).** `platform` → production → Create Service → **Compose**.
  - Provider GitHub, repo `dokploy-lab`, branch `main`, compose path `./platform/minio/docker-compose.yml`
  - **Environment:** `MINIO_ROOT_PASSWORD=<strong password>`
  - **Domains:** `minio.192.168.234.128.sslip.io` → service `minio`, port `9001`; and `s3.192.168.234.128.sslip.io` → service `minio`, port `9000`
  - Deploy. Open the console, log in, create buckets `db-backups` and `volume-backups`, and create an access key.

  If the image won't pull, use Cloudflare R2 instead (free tier): create a bucket and an API token in Cloudflare.
- [ ] **3.5 S3 Destinations.** Settings → **S3 Destinations** → add `lab-minio`:
  - endpoint `http://s3.192.168.234.128.sslip.io`
  - region `us-east-1`
  - bucket `db-backups`
  - your access key and secret

  Click **Test connection**. Add a second one for `volume-backups`.
- [ ] **3.6 Uptime Kuma.** `platform` → production → Create Service → **Template** → Uptime Kuma (or Compose with `./platform/uptime-kuma/docker-compose.yml`).
  - Domain `status.192.168.234.128.sslip.io` → port `3001`
  - Deploy, create the admin account, and add monitors later in 4.12.
  - If you set up AI in 2.11: try Create Service → AI, ask for "Adminer database UI", review the compose it suggests, deploy it, then **delete** it. This shows you reviewing AI output before trusting it.
- [ ] **3.7 Overview.** Open **Overview**.
  *Expect:* the platform services, with resource use.

---

## Phase 4: Product staging (Backend engineer)

Log in as **Backend**.

- [ ] **4.1 Database: Postgres.** `product` → staging → Create Service → **Database → PostgreSQL**. Name `product-db`, version 16. Deploy.
  - **General:** copy the **Internal connection URL**. Leave the external port empty, so the database stays private.
- [ ] **4.2 Database: Redis.** Same steps: **Redis**, name `product-redis`. Copy its internal URL.
- [ ] **4.3 API: General.** Create Service → **Application**, name `api`.
  - Provider: GitHub, `dokploy-lab`, branch `staging`
  - Build type: **Dockerfile**
  - Dockerfile path `apps/api/Dockerfile`, Docker context path `apps/api`
  - **Watch paths:** `apps/api/**`
  - **Auto Deploy:** on

  Save.
- [ ] **4.4 API: Environment.**
  ```
  DATABASE_URL=<product-db internal URL>
  REDIS_URL=<product-redis internal URL>
  APP_ENV=staging
  SECRET_KEY=<your secret, or a reference to LAB_SECRET_KEY>
  FAIL_MODE=none
  DATA_DIR=/data
  ```
  **Build-time arguments:** `BUILD_VERSION=1.0.0`
- [ ] **4.5 API: Advanced → Volumes.** Add a **volume** mount: name `api-staging-data`, path `/data`.
- [ ] **4.6 API: Domains.** `api-staging.192.168.234.128.sslip.io`, port `3000`, HTTPS off.
- [ ] **4.7 API: Deploy, then Deployments.** Click Deploy, then open **Deployments → View** and read the build log.
  *Expect:* "Done". Open `http://api-staging.192.168.234.128.sslip.io/api/info`: database `ok`, redis `ok`, worker `null` (not built yet), volume `ok`.
- [ ] **4.8 Worker.** Create Service → Application, name `worker`.
  - Dockerfile `apps/worker/Dockerfile`, context `apps/worker`, branch `staging`, watch paths `apps/worker/**`
  - Environment: `DATABASE_URL`, `REDIS_URL` (same as the API), `WORK_DELAY_MS=1500`
  - No domain. Deploy.
- [ ] **4.9 Concurrent builds test.** Click **Rebuild** on `api` and `worker` within a few seconds of each other.
  *Expect:* both build at once, because DevOps set 2 in 2.2. Ask DevOps to set it to 1 and repeat: the second build waits in the queue.
- [ ] **4.10 Containers.** On `api` → **Containers**: see the running container, its health and ID. Open **Terminal** and run:
  ```sh
  ls /data/notes && cat /data/boots.log
  ```
- [ ] **4.11 Logs.** On `api` → **Logs**. Call `/api/info` a few times in the browser.
  *Expect:* lines like `GET /api/info 200 4ms`.
- [ ] **4.12 Uptime monitoring.** In Uptime Kuma, add HTTP monitors for `/health` on the API, and later for the web and fleet dashboards. Point notifications at the same Discord webhook.
- [ ] **4.13 Database backups.** `product-db` → **Backups** → add:
  - destination `lab-minio` (db-backups), database `postgres` (or the name in the URL)
  - schedule `0 2 * * *`, keep latest 7

  Click **Run now**.
  *Expect:* a backup file in the MinIO bucket and a "backup done" message in Discord.
- [ ] **4.14 Volume Backups.** On `api` (or wherever your version shows **Volume Backups**): back up volume `api-staging-data` to `volume-backups`, every 6 hours. Run it once.
- [ ] **4.15 Schedules (service).** On `api` → **Schedules** → add `Daily report`:
  - command `node jobs/daily-report.js`
  - cron `*/10 * * * *`

  Run it manually once.
  *Expect:* the run's log shows `[report] total=...`, and `/api/info` shows `reports: 1`.
- [ ] **4.16 Monitoring (service).** On `api` → **Monitoring**. From your computer:
  ```bash
  ./scripts/traffic.sh http://api-staging.192.168.234.128.sslip.io 300
  ```
  *Expect:* CPU and network rise while the script runs. Orders appear and turn `done` (the worker is working).

---

## Phase 5: Product web (Frontend engineer)

Log in as **Frontend**. Check that you **can't** see the `robotics` project.

- [ ] **5.1 Web app.** `product` → staging → Create Service → Application, name `web`.
  - Dockerfile `apps/web/Dockerfile`, context `apps/web`, branch `staging`, watch paths `apps/web/**`
  - **Build-time arguments:** `BUILD_VERSION=1.0.0`
  - **Environment** (runtime):
    ```
    API_URL=http://api-staging.192.168.234.128.sslip.io
    APP_ENV=staging
    BANNER=Test data only
    ```
  - **Domains:** `shop-staging.192.168.234.128.sslip.io`, port **80**
  - Deploy.

  *Expect:* the shop opens with a yellow "Environment: staging" bar and "Web build 1.0.0". Placing an order shows it as `pending`, then `done`.
- [ ] **5.2 Build-time vs runtime.**
  - Change `BANNER` and **Deploy**. The bar text changes without a rebuild being needed, because it's runtime config.
  - Change `BUILD_VERSION` to `1.0.1` and Deploy. The build info changes, because it was baked in at build time.
- [ ] **5.3 Ship a change through Git.** Edit `apps/web/site/index.html` (for example, change the `<h1>`), commit and push to `staging`.
  - Without a public webhook (Phase 9), click **Deploy** yourself. With it, watch it deploy automatically.

  *Expect:* the change is live. Discord posts the deploy.
- [ ] **5.4 Preview Deployments.** *Needs Phase 9.* On `web` → **Preview Deployments** → enable, with wildcard domain `*.192.168.234.128.sslip.io` (or your real domain). Open a pull request from a feature branch into `staging`.
  *Expect:* Dokploy comments a preview URL on the PR. Merging or closing it removes the preview.
- [ ] **5.5 Try something you shouldn't.** Try to delete the `api` service, or open Settings → Traefik File System.
  *Expect:* blocked or not visible. That's the permissions from 3.3 working.

---

## Phase 6: Robot fleet (Robotics engineer)

Log in as **Robotics**.

- [ ] **6.1 Sim fleet.** `robotics` → sim → Create Service → **Compose**, name `fleet`.
  - branch `staging`, compose path `./robotics/docker-compose.yml`
  - Environment:
    ```
    FLEET_NAME=Warehouse A (simulation)
    MQTT_PORT=1884
    MQTT_BIND=127.0.0.1
    ROBOT_COUNT=5
    FAULTY_ROBOT=R-03
    TELEMETRY_DB_PASSWORD=ChangeMe123
    ```
  - Domain: service `fleet-api`, port `3000`, host `fleet-sim.192.168.234.128.sslip.io`
  - Deploy.

  *Expect:* the dashboard shows 5 robots with moving positions and falling batteries. R-03 drops **offline** for 30 seconds every 2 minutes.
- [ ] **6.2 Send commands.** Click **Dock** on R-01.
  *Expect:* its status goes `returning`, then `charging`, then back to `working` at 100%. The fleet-api **Logs** show `sent "dock"` and `acknowledged`.
- [ ] **6.3 Containers → Terminal (broker).** Open a terminal on the `broker` container and watch raw robot traffic:
  ```sh
  mosquitto_sub -t 'fleet/#' -v -C 10
  ```
  Then pretend to be a new robot:
  ```sh
  mosquitto_pub -t fleet/R-99/telemetry -m '{"battery":42,"x":3,"y":4,"status":"working"}'
  ```
  *Expect:* R-99 appears on the dashboard, then goes offline after 15 seconds because it stops sending.
- [ ] **6.4 Logs per container.** **Logs** → switch between `robot-sim`, `fleet-api` and `broker`. Find the line where R-03 or another robot says "battery low".
- [ ] **6.5 Compose Backups.** On `fleet` → **Backups** → add a backup for service `telemetry-db` (Postgres, user `fleet`, database `fleet`) to `db-backups`, nightly. Run it once.
- [ ] **6.6 Volume Backups.** Back up the `fleet-data` volume (it holds `fleet-config.json`, the stand-in for maps and calibration) every 6 hours. Run it once.
- [ ] **6.7 Schedules.** On `fleet` → **Schedules** → service `fleet-api`, command `node prune.js`, cron `0 * * * *`. Run it now.
  *Expect:* `[prune] removed 0 telemetry rows older than 24h`. Set `PRUNE_HOURS=0` temporarily, deploy, and run it again to see rows removed.
- [ ] **6.8 Monitoring.** `fleet` → **Monitoring**: per-container memory and CPU. Set `ROBOT_COUNT=40`, deploy, and watch telemetry-db and fleet-api load rise. Set it back to 5.
- [ ] **6.9 Production fleet.** `robotics` → production → Compose `fleet`.
  - branch `main`, `MQTT_PORT=1883`, `FLEET_NAME=Warehouse A`, `FAULTY_ROBOT=` (empty), a new DB password
  - domain `fleet.192.168.234.128.sslip.io`
  - **Auto Deploy off**

  Ask the Head of Software to deploy it (Phase 7).

---

## Phase 7: Production release (Head of Software, with DevOps)

- [ ] **7.1 Production databases.** DevOps creates `product-db` and `product-redis` in `product` → production. *Needs second server:* choose the remote server as the target. Add backups like 4.13.
- [ ] **7.2 Production API.** Same as 4.3 to 4.6, with these differences:
  - branch `main`, **Auto Deploy off**
  - `APP_ENV=production`, its own `SECRET_KEY`
  - domain `api.192.168.234.128.sslip.io`
  - **Registry:** choose the GHCR registry so the image is stored and can be rolled back. This is required if deploying to a remote server.
  - **Advanced → Cluster/Swarm:** replicas **2**
  - **Advanced → Resources:** memory limit 256 MB (some versions want bytes: `268435456`), CPU limit 0.5
  - **Advanced → Health check:** confirm the image health check is used, or set `/health`
  - tag `critical`
- [ ] **7.3 Production worker and web.** As in 4.8 and 5.1, on branch `main`. The web gets `API_URL=http://api.192.168.234.128.sslip.io`, `APP_ENV=production`, and an empty `BANNER`, on domain `shop.192.168.234.128.sslip.io`.
- [ ] **7.4 Release.** Merge `staging` into `main` on GitHub (open a PR and approve it as the Head). Then click **Deploy** on the production services, one at a time: api, worker, web, fleet.
  *Expect:* a green production bar on the shop. Discord gets one message per deploy. `/api/info` refreshed several times shows **two different hosts** (the 2 replicas).
- [ ] **7.5 Overview and Monitoring (server).** Left menu → **Overview** and **Monitoring**: the whole server now runs about 15 containers. Note RAM use. This is your capacity baseline.

---

## Phase 8: Drills (everyone)

Run these on **staging** first. Each one ends with a short note in your wiki: what happened, what you saw, how you fixed it.

- [ ] **D1. Bad release and rollback.** *Backend, then Head.*
  1. In `apps/api/release.json`, set `"version": "1.1.0", "broken": true`. Push to `staging` and deploy.
  2. **Deployments:** the deploy says done, but **Containers** shows the API restarting. **Logs** show `FATAL: migration failed`. Discord or Uptime Kuma alerts.
  3. Fix it with **Rollbacks** if your version has it: pick the previous deployment and roll back. Otherwise, run `git revert HEAD` and push, then Deploy.
  4. *Expect:* healthy again within about a minute. Write down which method you used and how long it took.
- [ ] **D2. Slow API.** *Backend.* Set `FAIL_MODE=slow`, deploy, and run `traffic.sh`.
  - Left menu → **Requests** (activate request logging if asked): request durations of 2 to 4 seconds.
  - **Monitoring:** CPU stays low. The service is slow but not busy, which points to a waiting problem rather than a CPU problem.
  - Set `FAIL_MODE=none` and deploy.
- [ ] **D3. Error spike.** *Backend.* Set `FAIL_MODE=errors`, deploy, and run `traffic.sh`.
  *Expect:* about half `HTTP 500`. **Requests** shows the 500s, and **Logs** show `500` lines. Reset afterwards.
- [ ] **D4. Memory leak and limits.** *DevOps + Backend.* On staging `api`, set an **Advanced → Resources** memory limit of 256 MB and `FAIL_MODE=leak`, then deploy and run `traffic.sh ... 200`.
  *Expect:* **Monitoring** shows memory climbing in steps, then the container is killed and restarted (Containers shows a fresh uptime). The limit protected the rest of the server. Reset afterwards.
- [ ] **D5. Redis outage.** *Backend.* Stop `product-redis` from its General tab. Place an order in the shop.
  *Expect:* `/api/info` shows redis `error`, and new orders stay `pending` with a "Redis down" note. Start Redis again. New orders flow again. (Pending ones from the outage stay pending, which is a real design gap worth discussing.)
- [ ] **D6. Database restore.** *DevOps.*
  1. Place 3 orders.
  2. Run a backup (4.13).
  3. Delete orders in the DB terminal: `product-db` → Containers → Terminal → `psql -U <user> -d <db> -c "DELETE FROM orders;"`.
  4. **Backups → Restore** the latest backup.

  *Expect:* the orders are back. Record how long the restore took.
- [ ] **D7. Volume restore.** *Robotics.* In the fleet-api terminal, run `rm /data/fleet-config.json`, then restart the service.
  *Expect:* a new config is created with a new `createdAt` (visible in Fleet details). Restore the volume backup from 6.6, restart, and the original `createdAt` is back.
- [ ] **D8. Traefik rules.** *DevOps.*
  1. Left menu → **Traefik File System** → `dynamic/` → create `lab-middlewares.yml` with the content of `infra/traefik/lab-middlewares.yml`.
  2. Open the staging API's router file in the same place and add `middlewares: ["lab-ratelimit@file"]` under its router. Some versions offer this under the app's Advanced → Traefik instead.
  3. Run `./scripts/burst.sh http://api-staging.192.168.234.128.sslip.io 60`.

  *Expect:* a mix of `200` and `429`. Then swap to `lab-tailscale-only@file` and reload the page from your LAN: `403`, because you're not on Tailscale. Remove the middleware when done.
- [ ] **D9. HTTPS with your own certificate.** *DevOps.* Add domain `secure.192.168.234.128.sslip.io` to the staging web with HTTPS on and certificate provider "None" or custom. Traefik picks `lab-selfsigned` from 2.9, and the browser warns because it's self-signed. Open the certificate details to confirm it's yours. Remove afterwards.
- [ ] **D10. Disk full prevention.** *DevOps.* Left menu → **Docker**: list images, volumes and containers. Find unused images and volumes from deleted services, then clean them. Note the space freed. Check that the scheduled cleanup (2.1) ran in **Schedules** or the server logs.
- [ ] **D11. Server-level schedule.** *DevOps.* Left menu → **Schedules** → add a server script, daily:
  ```sh
  df -h / && docker system df
  ```
  Run it now and read the output.
- [ ] **D12. Robot goes silent.** *Robotics.* Set `FAULTY_ROBOT=R-02` in sim and deploy. Use the dashboard, **Logs** (robot-sim) and the broker terminal to show the robot is missing messages, not stuck. In real life the next step is checking that robot's Tailscale connection.
- [ ] **D13. Permissions check.** *Head.* Log in as each Member and confirm what they can and can't see:
  - Frontend: product only
  - Robotics: robotics only
  - Backend: no Settings or Traefik
- [ ] **D14. Offboarding.** *Head.* "Frontend engineer leaves today."
  1. **Sessions:** see their active session, and revoke it. Their browser gets logged out.
  2. **Users:** remove them.
  3. **Secrets / Environment:** rotate anything they knew, such as `SECRET_KEY`, and redeploy.
  4. **Audit Logs:** filter by that user and review their last actions.

  Re-invite them afterwards if you want to keep practising.
- [ ] **D15. Audit review.** *Head.* **Audit Logs:** answer "who deployed production API last, and when?" and "who changed the API's environment?" This is the monthly governance check.

---

## Phase 9: Going public (optional; needs a Cloudflare domain)

This unlocks GitHub auto-deploy webhooks, Preview Deployments, real HTTPS and DNS automation.

- [ ] **9.1 Cloudflare Tunnel.** In Cloudflare Zero Trust, create a tunnel and copy its token. In `platform`, create Compose `cloudflared` with `./platform/cloudflared/docker-compose.yml` and `TUNNEL_TOKEN`. Deploy.
- [ ] **9.2 Public hostnames** (in Cloudflare, on the tunnel):
  - `hooks.yourdomain.com` → `http://dokploy:3000`
  - `*.lab.yourdomain.com` → `http://dokploy-traefik:80`
- [ ] **9.3 Cloudflare Access.** Protect `hooks.yourdomain.com` with a login, plus a **bypass** rule for the path `/api/deploy/*`. GitHub can then reach the webhook, but nobody can reach the panel.
- [ ] **9.4 Webhooks.** Set Dokploy's GitHub app or webhook URLs to the `hooks` hostname. Push to `staging`.
  *Expect:* automatic deploy, with no clicks.
- [ ] **9.5 DNS Providers + real HTTPS.** Use the Cloudflare token from 2.10 so Dokploy can create records and issue certificates by DNS challenge. Switch domains to `*.lab.yourdomain.com` with HTTPS on.
- [ ] **9.6 Preview Deployments.** Now do 5.4.
- [ ] **9.7 Tailscale.** Install Tailscale on the server and your laptop. Apply `infra/tailscale/acl.hujson` (adapted). Set robotics production `MQTT_BIND=<server Tailscale IP>`, redeploy, and connect a laptop MQTT client over Tailscale only:
  ```bash
  mosquitto_sub -h <server-tailscale-ip> -p 1883 -t 'fleet/#' -v
  ```

---

## Phase 10: Monthly routine (rehearse once)

| Task | Where | Who |
|---|---|---|
| Update Dokploy (after reading release notes and taking a backup) | Web Server | DevOps |
| Check certificate expiry | Certificates | DevOps |
| Restore-test one database and one volume | Backups, Volume Backups | Backend, Robotics |
| Review users, permissions and sessions | Users, Sessions | Head |
| Review the audit trail | Audit Logs | Head |
| Clean Docker, check disk | Docker, Schedules | DevOps |
| Review capacity trends | Overview, Monitoring | DevOps + Head |
| Rotate tokens (GitHub registry, Cloudflare, API) | Profile, Registry, DNS Providers, Secrets | DevOps |
| Review plan and paid features | License, SSO, Whitelabeling | Head |

---

## Tab coverage checklist

Every tab is used at least once:

| Tab | Exercises |
|---|---|
| **Settings:** Web Server | 2.1, monthly |
| Profile | 1.1, 1.7 |
| Sessions | D14 |
| Remote Servers (deploy and build servers) | 2.4, 7.1 |
| Deployments (concurrent builds) | 2.2, 4.9 |
| Users | 1.5, 3.3, D13, D14 |
| Audit Logs | 2.12, D14, D15 |
| SSH Keys | 2.3 |
| AI | 2.11, 3.6 |
| Tags | 1.6, 3.2, 7.2 |
| Git | 2.5, 9.4 |
| Registry | 2.6, 7.2 |
| Secrets | 2.7, 4.4, D14 |
| DNS Providers | 2.10, 9.5 |
| S3 Destinations | 3.5 |
| Certificates | 2.9, D9 |
| Notifications | 2.8 |
| License, SSO, Whitelabeling | 1.2 to 1.4 |
| **Left menu:** Home | 3.1 |
| Projects | 3.2 onwards |
| Overview | 3.7, 7.5 |
| Monitoring (server) | 7.5 |
| Schedules (server) | D10, D11 |
| Traefik File System | D8 |
| Docker | D10 |
| Requests | D2, D3 |
| **Service:** General | 4.3, D5 |
| Environment | 4.4, 5.1, 5.2 |
| Domains | 4.6, 5.1, 6.1, D9 |
| Deployments | 4.7, D1 |
| Containers | 4.10, 6.3, D4 |
| Logs | 4.11, 6.4, D1 |
| Monitoring | 4.16, 6.8, D4 |
| Backups (database and compose) | 4.13, 6.5, D6 |
| Volume Backups | 4.14, 6.6, D7 |
| Schedules (service) | 4.15, 6.7 |
| Advanced (volumes, resources, replicas, health) | 4.5, 7.2, D4 |
| Preview Deployments | 5.4, 9.6 |
| Rollbacks | D1 |

---

## Reset the lab

To start over: delete the projects in Dokploy (choose to delete volumes), remove the lab users, and clean images in **Docker**. Keep Settings (keys, registry, S3, notifications) if you want to repeat only the team phases.
