# NpStudio

A private two-person studio workspace — login, dashboard, tasks, chat, clients, calendar, revenue, and notes — with real Google + email sign-in and a shared live database (Supabase). Hostable free on GitHub Pages.

---

## Files

| File | What it is | Do you edit it? |
|---|---|---|
| `index.html` | The page | No |
| `styles.css` | All styling | No |
| `app.js` | App logic, auth, database | No |
| `config.js` | **Your Supabase keys + settings** | **Yes — this one** |
| `schema.sql` | Database setup script | Paste into Supabase once |

> 🔒 **Never** put your Supabase **secret** key anywhere in these files. Only the **publishable / anon** key goes in `config.js` (it's safe to be public). If your secret key was ever shared, rotate it in Supabase → Settings → API.

---

## Setup (about 15 minutes)

### 1. Create the database tables
1. In Supabase, open **SQL Editor → New query**.
2. Paste the entire contents of `schema.sql` and click **Run**.
   (If a realtime line says "already a member of publication", ignore it.)

### 2. Confirm your keys
`config.js` is already filled with your project URL and publishable key. Double-check them against **Supabase → Settings → API**.

### 3. Turn on sign-in methods
In **Supabase → Authentication → Providers**:
- **Email** — toggle **on**. For instant access with no confirmation emails, turn **off** "Confirm email" (fine for a private 2-person tool).
- **Google** — toggle **on**, then:
  1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a project → **APIs & Services → Credentials → Create OAuth client ID → Web application**.
  2. Under **Authorized redirect URIs**, add the callback URL shown in Supabase's Google provider box (looks like `https://<your-project>.supabase.co/auth/v1/callback`).
  3. Copy the **Client ID** and **Client secret** from Google into Supabase's Google provider fields → **Save**.

### 4. Set your site URLs
In **Supabase → Authentication → URL Configuration**:
- **Site URL**: your live address (e.g. `https://YOURNAME.github.io/npstudio/`)
- **Redirect URLs**: add the same address.
- For local testing, also add `http://localhost:5173/` (or whatever you use).

### 5. (Optional) Lock it to just the two of you
In `config.js`, set `ALLOWED_EMAILS` to your two emails. Anyone else who signs in is bounced out.

---

## Run it locally
Because it's plain static files, just serve the folder:
```bash
cd npstudio-app
python3 -m http.server 5173
# open http://localhost:5173
```
(Opening `index.html` directly with `file://` will break Google sign-in — always use a local server.)

---

## Deploy to GitHub Pages
1. Create a repo (e.g. `npstudio`) and upload everything inside `npstudio-app/` to the repo root.
2. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pick `main` / `/root`, **Save**.
3. Your site goes live at `https://YOURNAME.github.io/npstudio/`.
4. Make sure that exact URL is in Supabase's **Site URL** and **Redirect URLs** (step 4).

That's it — open the URL, sign in, and you and your cofounder share one live workspace. Tasks, chat, clients, and notes update in real time on both screens.

---

## How the data works
- One shared workspace: both signed-in users can see and edit everything (tasks, clients, chat, notes, calendar).
- Row-level security only lets **signed-in** users touch the data — the public can't read it.
- "Sign in with Apple" is intentionally left out (it needs a paid Apple Developer account). Google + email cover you for free.
