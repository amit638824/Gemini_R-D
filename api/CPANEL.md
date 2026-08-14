# cPanel Node.js deploy

## Symptoms
`https://apigemini.techwagger.com/api/health` → **503 Service Unavailable**
= Node app crash / not started / wrong startup file.

## cPanel setup (Setup Node.js App)

1. **Application root:** folder where `package.json` hai (usually `api` or `Gemini_R-D/api`)
2. **Application URL:** `apigemini.techwagger.com` (or subdomain)
3. **Application startup file:** `app.js`  ← important (not `src/index.ts`)
4. **Node version:** 18+ (prefer 20)
5. Click **Run NPM Install**
6. **Environment variables** (cPanel UI mein add karo):
   - `GEMINI_API_KEY` = your key
   - `NODE_ENV` = `production`
   - `PUBLIC_URL` = `https://apigemini.techwagger.com`
   - `CLIENT_ORIGIN` = `https://apigemini.techwagger.com`
   - `PORT` mat force karo — cPanel khud set karta hai
7. **Build:**
   ```bash
   npm run build
   ```
8. **Restart** the Node app

## After deploy test

- `https://apigemini.techwagger.com/` → `{ ok: true, ... }`
- `https://apigemini.techwagger.com/api/health`
- `https://apigemini.techwagger.com/api/docs`

## Common issues

| Issue | Fix |
| --- | --- |
| 503 | App stopped / crash → Restart + check stderr log |
| Cannot find module dist/… | Run `npm run build` on server |
| GEMINI key missing | Set in cPanel Environment variables |
| Startup file galat | Use `app.js` |
| WebSocket fail | cPanel Apache pe `Upgrade`/`Connection` proxy allow hona chahiye; shared hosting pe WS often blocked |
| `npm run dev` on cPanel | Mat use karo — sirf `npm run build` + start via cPanel |

## Local

```bash
npm install
npm run build
npm start
```
