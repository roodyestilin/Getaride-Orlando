# Deploy Getaride Orlando as a FULL-STACK WEB APP (with custom domain)

This app is an Expo / react-native-web project. Emergent's **Publish** button deploys
Expo projects as a **mobile** app (EAS / Expo Go), which is why it did NOT give you a
website + "Link domain". To get a real **website** on your custom domain
(`getarideorlando.com`), deploy the **web export** to a static web host. The backend
stays on Emergent (already live at https://fullstack-web-deploy.emergent.host/api).

The web build is already configured to talk to your live production backend.

---

## Option 1 — Netlify from GitHub (recommended, auto-builds)
1. In this chat, click **Save to Github** (top of the chat input) to push the code
   (this repo already contains `netlify.toml`).
2. Go to https://app.netlify.com  ->  **Add new site**  ->  **Import from Git**  ->
   pick this repository.
3. Netlify reads `netlify.toml` automatically (base=`frontend`, build=`expo export`,
   publish=`frontend/dist`, env vars, SPA redirect). Click **Deploy**.
4. When the build finishes you get a live URL (e.g. `your-site.netlify.app`).
5. **Domain settings -> Add a domain -> `getarideorlando.com`**. Netlify shows the DNS
   records (or one-click via your registrar). SSL is issued automatically.

## Option 2 — Vercel from GitHub
1. **Save to Github**, then import the repo at https://vercel.com/new.
2. Set **Root Directory = `frontend`** (it will use `frontend/vercel.json`).
3. Add the 3 env vars in Project Settings -> Environment Variables:
   - `EXPO_PUBLIC_BACKEND_URL = https://fullstack-web-deploy.emergent.host`
   - `EXPO_PUBLIC_MAPBOX_TOKEN = pk.eyJ1Ijoid29ybGR3aWRlcGlja3VwcyIsImEiOiJjbXFwazh5Z3gwNzMyMnNxYWJ5OW4zM3dmIn0.rZFs0Q8KrVTDjdxRPI6uLQ`
   - `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_test_51TxEldRmOLJtOnmbGdvZwIqBrZiqxZt3yx1hEN8yJinyu0lDnbhL2fLXFd4lIdB4f9jwa8QvrBLS8huSPRu850TZ00V7j2HKB4`
4. Deploy, then **Settings -> Domains -> add `getarideorlando.com`**.

## Option 3 — Instant drag-and-drop (no Git)
The prebuilt website is in `frontend/dist/`. On https://app.netlify.com click
**Add new site -> Deploy manually** and drag the `frontend/dist` folder in. Then add
your custom domain under Domain settings. (Rebuild by running
`npx expo export --platform web --output-dir dist` in `frontend/`.)

---

### Notes
- Backend & database stay on Emergent (already deployed & public). Only the website
  frontend is hosted on Netlify/Vercel.
- CORS on the backend is open (`*`), so the new domain can call the API.
- Admin login on production: `admin@getaride.com` / `Admin1234`. Riders/drivers can
  register from the site (production DB is separate from the preview/dev DB).
- Public keys (Mapbox token, Stripe publishable key) are safe to expose in a web app.
