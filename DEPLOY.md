# Deploying to Render

One Docker web service: FastAPI serves the API and the built React app on the same URL. Users sign in on the app's own login page.

## What ships

| Ships | Does not ship |
|---|---|
| `backend/app`, `seed/`, built frontend | TOGAF PDFs (`data/togaf/*.pdf`, licensed) |
| `data/index/` (prebuilt TOGAF index, about 5 MB) | `.env` files, local `data/cil.db` |

## Settings (Render → Environment)

| Key | Value | Notes |
|---|---|---|
| `APP_USERS` | `rishi:<pw>,arham:<pw>` | Login accounts. Required: leave it empty and the app is open to anyone with the URL. |
| `SESSION_SECRET` | auto-generated | Signs the login cookie. |
| `SESSION_HOURS` | `12` | Session length. |
| `GEMINI_API_KEY` | optional | Without it, AI buttons use the deterministic fallback. |
| `RAG_DENSE` | `false` | BM25-only retrieval to fit the free 512 MB. Set `true` on a paid plan for hybrid search. |
| `DB_PATH` | `/tmp/cil.db` | SQLite. See Persistence. |

## Steps

1. **Commit and push** (from the repo root):
   ```
   git add -A
   git commit -m "Render deployment: Docker image, login gate, static frontend"
   git push origin main
   ```
   Check that `data/index/` is in the push (`git ls-files data/index`). It is no longer gitignored.
2. **Create the service.** In Render, go to **New → Blueprint**, connect GitHub, and pick `rishietagi/Enterprise_Architecture_Assessment-`. Render reads `render.yaml` and proposes the `cil-ea-assessment` web service (Docker, free plan, Singapore).
3. **Enter the secrets** when prompted: `APP_USERS` (for example `rishi:LongPassword1,arham:LongPassword2`) and, optionally, `GEMINI_API_KEY`. Click **Apply**.
4. **Wait for the first build** (about 5-8 minutes: npm build, then pip install). The deploy goes live when `/api/health` returns `{"ok": true}`.
5. **Open** `https://cil-ea-assessment.onrender.com` (Render shows the exact URL). Sign in, then click Let's Begin and pick the engagement.
6. **Updates:** every push to `main` redeploys automatically (`autoDeploy: true`).

## Free-plan behaviour

- **Sleep:** the service sleeps after 15 minutes idle, and the first visit takes about 30-60 s to wake. The login page says "refresh in a minute" if it loads before the API.
- **Persistence:** the database resets to the demo seed on every restart, deploy or wake from sleep, so edits made in the app are lost. For persistent edits, move to the Starter plan, add a 1 GB **Disk** mounted at `/var/data`, and set `DB_PATH=/var/data/cil.db`.
- **Memory:** about 150 MB with `RAG_DENSE=false`.

## Run the same image locally (optional)

```
docker build -t cil-ea .
docker run -p 8000:8000 -e APP_USERS=demo:demo -e RAG_DENSE=false cil-ea
```
Then open http://localhost:8000.
