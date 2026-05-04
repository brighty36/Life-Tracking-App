# ⚔️ Life RPG

A gamified life-tracking web app. Complete real-world tasks to earn XP, level up your character, and unlock rewards.

## Tech Stack

- **Frontend** — Vanilla HTML/CSS/JS (ES modules, no framework)
- **Backend/DB** — Supabase (Auth + PostgreSQL)
- **Hosting** — Netlify

---

## Setup Guide

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Wait for the project to finish provisioning.
3. In the left sidebar, go to **Settings → API**.
4. Note down:
   - **Project URL** (e.g. `https://xyzabc.supabase.co`)
   - **anon / public** key (the long JWT string)

### 2. Run the Database Schema

1. In Supabase, go to **SQL Editor → New query**.
2. Open `supabase/schema.sql` from this repo.
3. Paste the entire contents and click **Run**.

This creates all tables with Row Level Security (RLS) enabled so users can only access their own data.

### 3. Configure Auth (Magic Link)

1. In Supabase go to **Authentication → Settings**.
2. Under **Email**, make sure **Enable Email Confirmations** is turned on.
3. Under **URL Configuration**, add your Netlify deployment URL to **Site URL** (e.g. `https://your-app.netlify.app`) and to the **Redirect URLs** list.
4. For local dev, also add `http://localhost:3000` to Redirect URLs.

### 4. Deploy to Netlify

#### Option A — GitHub import (recommended)

1. Push this repo to GitHub.
2. Go to [netlify.com](https://netlify.com) → **Add new site → Import an existing project** → connect your repo.
3. Netlify will auto-detect `netlify.toml`. Confirm the settings:
   - **Build command**: *(auto-filled from netlify.toml)*
   - **Publish directory**: `.`
4. Before deploying, go to **Site configuration → Environment variables** and add:
   | Key | Value |
   |-----|-------|
   | `SUPABASE_URL` | Your Supabase Project URL |
   | `SUPABASE_ANON_KEY` | Your Supabase anon key |
5. Click **Deploy site**.

#### Option B — Netlify CLI

```bash
npm i -g netlify-cli
netlify login
netlify init
# Follow prompts to link your repo

# Set env vars
netlify env:set SUPABASE_URL "https://your-project.supabase.co"
netlify env:set SUPABASE_ANON_KEY "your-anon-key"

# Deploy
netlify deploy --prod
```

> **How env vars are injected:** `netlify.toml` runs a `sed` command at build time that replaces the `__SUPABASE_URL__` and `__SUPABASE_ANON_KEY__` placeholder tokens in `index.html` with your real values. No Node.js or bundler required.

### 5. Local Development

For local dev, temporarily replace the placeholder tokens in `index.html` with your real Supabase values (do not commit them):

```html
<!-- index.html — change these two lines for local dev only -->
window.ENV_SUPABASE_URL  = 'https://your-project.supabase.co';
window.ENV_SUPABASE_ANON = 'your-anon-key';
```

Then serve with any static server:

```bash
npx serve .
# or
python3 -m http.server 3000
```

---

## File Structure

```
/
├── index.html          App shell + auth gate
├── app.js              Main routing, auth state, nav
├── supabase.js         Supabase client + all DB functions
├── styles.css          All styles + CSS variables for theming
├── netlify.toml        SPA redirect rules + build command
├── screens/
│   ├── character.js    Avatar, stats, XP bar
│   ├── quests.js       Daily quests + streaks
│   ├── objectives.js   Long-term goals + milestones
│   ├── rewards.js      Reward shop + redemption
│   └── journal.js      Activity log
├── utils/
│   ├── xp.js           XP / level-up calculations
│   └── animations.js   Confetti, toasts, level-up banner
└── supabase/
    └── schema.sql      Tables + RLS policies
```

---

## XP & Progression System

| Difficulty  | XP Reward | Stat Boost |
|-------------|-----------|------------|
| Easy        | 25 XP     | +1         |
| Medium      | 50 XP     | +2         |
| Hard        | 100 XP    | +3         |
| Legendary   | 250 XP    | +5         |

Level thresholds scale ~20% per level (Level 1→2 = 100 XP, Level 2→3 = 120 XP, …).

| Level Range | Class Title  |
|-------------|--------------|
| 1–2         | Novice       |
| 3–4         | Apprentice   |
| 5–6         | Journeyman   |
| 7–9         | Adept        |
| 10–12       | Expert       |
| 13–15       | Master       |
| 16+         | Grandmaster  |

---

## Category → Stat Mapping

| Quest Category | Stat Boosted |
|----------------|--------------|
| Health         | Strength     |
| Mind           | Intellect    |
| Career         | Ambition     |
| Finance        | Wealth       |
