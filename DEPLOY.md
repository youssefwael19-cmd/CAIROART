# Deploying Cairo Art Operations AI

One Node process serves the React build and the `/api` routes. It reads `PORT`
(8787 locally), binds `0.0.0.0`, keeps its data in **Postgres** when
`DATABASE_URL` is set, and keeps uploads, the share secret, the one-time manager
password and daily backups under `DATA_DIR`.

Native modules (`sharp`, `better-sqlite3`) mean a container or a normal VPS —
not a static/edge host. `better-sqlite3` is only used when `DATABASE_URL` is
absent; a deployment with `DATABASE_URL` set refuses to open a SQLite file.

---

## Option A — ProductEcho Cloud (managed)

### 1. Create the app and database

1. Create the application in the ProductEcho console (or with the MCP
   `deploy_application` tool) with deployment target **container**.
2. Create a Postgres database for it. ProductEcho injects the connection string
   as `DATABASE_URL` when a `db_identifier` is attached; otherwise copy it from
   the database page into the app's environment.

### 2. Settings

| Setting | Value |
| --- | --- |
| Build command | `npm install && npm run build` (the buildpack runs `npm install` itself; `npm run build` produces `dist/`) |
| Start command | `npm start` |
| Container port | `8080` |
| Storage path | `/data` |
| Node engine | `>=20` (declared in `package.json`) |
| Instances | **1** — the app keeps the working copy in memory and writes it through one queue; two replicas would overwrite each other's changes |

`npm start` runs `tsx server/index.ts`. The server compiles TypeScript on the fly
and serves `dist/` when it exists, so the build step must run before start.

### 3. Environment

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (injected or pasted) |
| `DATA_DIR` | `/data` — the mounted storage path |
| `NODE_ENV` | `production` |
| `PORT` | `8080` (the host usually injects this) |
| `TRUST_PROXY` | `1` — the edge terminates TLS and sets `X-Forwarded-For` |
| `SHARE_SECRET` | 64 random hex characters (`openssl rand -hex 32`) |
| `INITIAL_MANAGER_PASSWORD` | optional; at least 10 characters. The first manager's starting password, so a host with no shell to read `DATA_DIR` still has a way in. It is applied at boot only while that manager has never signed in, and that manager must still choose a new password. Remove the variable after the first sign-in. |
| `SEED_DEMO` | `1` for a demonstration deployment; leave unset for the real business |
| `DEMO_ACCOUNTS` | **never set in production** |
| `OPENAI_API_KEY` | optional; without it the bilingual rules engine runs |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | optional; all four are needed for live WhatsApp |

`PGSSL=1` forces TLS if the provider's URL does not carry `sslmode=require`.

#### Free baseline

The app needs no paid key to run: without `OPENAI_API_KEY` every reply, analysis
and audit comes from the built-in bilingual rules engine, without `WHATSAPP_*`
the inbox runs in simulated mode with the same qualification flow, and
`SHARE_SECRET` is generated into `DATA_DIR` on first boot. `INITIAL_MANAGER_PASSWORD`
is free — it is only the password you choose to sign in the first time.

Where each optional value comes from:

| Variable | Where to get it |
| --- | --- |
| `INITIAL_MANAGER_PASSWORD` | You invent it (10+ characters) |
| `SHARE_SECRET` | `openssl rand -hex 32`, or leave empty to auto-generate |
| `OPENAI_API_KEY` (AI) | Google AI Studio → https://aistudio.google.com/apikey (free, no card, starts with `AIza`); the template already sets `AI_BASE_URL`/`AI_MODEL` for that free tier. Freebuff's paid API instead: `https://freebuff.com/api/v1/paid` + `gpt-4o-mini` |
| `WHATSAPP_TOKEN` | Meta app → WhatsApp → API Setup (temporary token) or a System User token for a permanent one |
| `WHATSAPP_PHONE_NUMBER_ID` | Same page: the numeric **Phone number ID**, not the phone number |
| `WHATSAPP_VERIFY_TOKEN` | You invent any phrase without spaces; enter it again in Meta → WhatsApp → Configuration |
| `WHATSAPP_APP_SECRET` | Meta app → App settings → Basic → App secret (32 hex) |

`node scripts/pe-env.mjs --dry-run` also format-checks every value (password
length, 64-hex share secret, all four WhatsApp vars together, Google key needs
the Google base URL) and refuses to push on a failed check; `--force` overrides.

#### Adding the optional keys without pasting them anywhere

Fill `.productecho/env.local` (gitignored, excluded from deploy archives) with
only the keys you have, then push them to the running app:

```bash
node scripts/pe-env.mjs --dry-run   # show which names would be set, no values
node scripts/pe-env.mjs             # merge them into the app env and restart
```

The script keeps the existing variables (`DATABASE_URL`, `DATA_DIR`, …) and adds
or replaces only the entries you filled in. It prints names, never values. The
same keys can also be entered by hand in the ProductEcho console under the
application's **Environment** tab; use one route or the other, not both.

After signing in, set `INITIAL_MANAGER_PASSWORD=-` (a single dash) and run the
script again to delete that variable from the app.

### 4. Deploy the source

Archive the project root **without** build output, dependencies, data or secrets:

```bash
bash scripts/pack.sh   # writes artifacts/source.zip
```

The script copies the tree to a temporary folder, normalises directory modes to
`755` (the build worker unpacks the source as a different user and cannot read a
`700` directory), drops `node_modules`, `dist`, `data`, `logs`, `.git`,
`.productecho`, env files and logs, then zips the result. A hand-rolled `zip -r`
of the project root fails at the "load build context" step for that reason.

Upload it and deploy. Watch the build log the first time: the two native modules
are the only build risk (`better-sqlite3` needs a compiler; `sharp` downloads a
prebuilt binary). The first boot log line reads:

```
Cairo Art API on 0.0.0.0:8080 · storage: postgres · AI mode: rules
```

### 5. First sign-in

With `DEMO_ACCOUNTS` unset and `SEED_DEMO` unset, the first boot creates one
manager account (`youssef@cairoart.net`). There are two ways to get its first
password:

**A. A password you choose (managed hosts, no shell).** Set
`INITIAL_MANAGER_PASSWORD` to your own value in the app's environment and let the
app restart. The log then reads:

```
[auth] Applied INITIAL_MANAGER_PASSWORD to the first manager; it must be changed at first sign-in.
```

This can be done after the first boot: the value is applied to a manager who has
not signed in yet, and replaces any earlier starting password. Sign in with it,
choose your own password, then delete the variable from the environment.

**B. A generated password.** Without that variable the first boot prints:

```
[auth] Created the first manager (youssef@cairoart.net). A one-time password is in /data/initial-manager-password.txt ...
```

Read it from the file at `DATA_DIR/initial-manager-password.txt` (open a shell on
the app or read the storage file), sign in, choose a new password, then delete
the file.

Then, as that manager:

1. Team → Staff & access → add each real employee (agent or manager).
2. Upload the real catalog, or add it with catalog commands.
3. Set the real channel figures under Channel sales.

### 6. WhatsApp webhook

Register this URL with Meta once the domain is live:

```
https://<your-app-domain>/api/whatsapp/webhook
```

Use `WHATSAPP_VERIFY_TOKEN` as the verify token. Deliveries are rejected unless
`WHATSAPP_APP_SECRET` matches the `X-Hub-Signature-256` header.

---

## Option B — your own VPS with Docker and Caddy

- A Linux VPS (Ubuntu 22.04/24.04, 2 GB RAM, 20 GB disk) with a public IPv4.
- A domain with an `A` record pointing at it (`ops.cairoart.net`); Caddy
  obtains the HTTPS certificate.
- Docker with the Compose plugin.

```bash
apt update && apt install -y docker.io docker-compose-plugin git
git clone <your-repo> /srv/cairo-art && cd /srv/cairo-art

cp .env.example .env
# set DOMAIN=ops.cairoart.net and SHARE_SECRET=<64 hex chars>
# optionally set DATABASE_URL to a Postgres instance; leave it empty to keep
# the database in ./data/cairo-art.sqlite
nano .env

docker compose up -d --build
docker compose logs -f app
```

First sign-in is the same as above; with SQLite the password file is
`data/initial-manager-password.txt` on the host.

---

## Data and backups

**Postgres deployment**: the database lives in Postgres (use the provider's
backups and point-in-time restore). `DATA_DIR` holds the finished product images
(`uploads/`), the share secret and a daily JSON snapshot
(`backups/cairo-art-YYYY-MM-DD.json`, 14 kept). Keep the storage path on a
persistent volume — an app's local disk is wiped on every restart and redeploy.

**SQLite deployment**: everything is in `DATA_DIR`:

- `cairo-art.sqlite` — the database (WAL files alongside it while running)
- `uploads/` — finished product images
- `backups/cairo-art-YYYY-MM-DD.sqlite` — consistent daily copy, 14 kept
- `share-secret.txt` — generated if `SHARE_SECRET` is unset

Copy `data/backups` off the machine regularly. A backup on the same disk is not a
backup. To restore SQLite: stop the app, replace `cairo-art.sqlite` with a backup,
delete any `-wal`/`-shm` files, start again.

## Updating

- ProductEcho: upload a new archive and deploy; the storage path and `DATABASE_URL`
  stay attached.
- Docker: `git pull && docker compose up -d --build`.

Sessions, accounts and data survive a rebuild because they live in Postgres (or
the mounted `data` volume).

## Health and checks

- `GET /api/health` returns `200` with `{ ok, storage, aiMode, whatsapp }`;
  `storage` says `postgres` or `sqlite`, so a misconfigured deploy is obvious.
- Sign in, open the customer desk, upload one product photo, print one
  confirmation and open a customer link in a private window — that exercises
  auth, the database, image processing, print and share links.

## Troubleshooting

- **App boots then dies** — `DATABASE_URL` missing or unreachable. The log shows
  `[boot] the server could not start:` with the driver error.
- **`SQLite was opened while DATABASE_URL is set`** — something forced the SQLite
  path on a deployed host; check that no process clears `DATABASE_URL`.
- **Everyone signed out after a deploy** — sessions are in the database; if the
  database was recreated, that is expected. The account list went with it, and a
  new one-time manager password is logged.
- **Uploads vanish after a deploy** — `DATA_DIR` is not on the persistent volume.
- **Certificate not issued (Docker)** — DNS not pointing at the server, or ports
  80/443 blocked. `docker compose logs caddy`.
- **`SQLITE_BUSY` (Docker + SQLite)** — run exactly one app container.
- **Large photo fails** — uploads are capped at 15 MB; `sharp` needs memory
  headroom on big images.
