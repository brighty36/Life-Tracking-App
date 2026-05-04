# ⚔️ Life RPG

A gamified life-tracking web app. Complete real-world tasks to earn XP, level up your character, and unlock rewards.

## Tech Stack

- **Frontend** — Vanilla HTML/CSS/JS (ES modules, no framework)
- **Backend/DB** — Supabase (Auth + PostgreSQL)
- **Hosting** — Vercel

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
3. Under **URL Configuration**, add your Vercel deployment URL to **Site URL** (e.g. `https://your-app.vercel.app`) and to the **Redirect URLs** list.
4. For local dev, also add `http://localhost:3000` to Redirect URLs.

### 4. Deploy to Vercel

#### Option A — GitHub import (recommended)

1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. In the **Environment Variables** section add:
   | Name | Value |
   |------|-------|
   | `SUPABASE_URL` | Your Supabase Project URL |
   | `SUPABASE_ANON_KEY` | Your Supabase anon key |
4. Click **Deploy**.

#### Option B — Vercel CLI

```bash
npm i -g vercel
vercel --prod
# Follow prompts, then add env vars in the Vercel dashboard
```

### 5. Inject Environment Variables at Build Time

The `index.html` file contains placeholder tokens that need to be replaced with real values. Add a **Build Command** in Vercel:

```bash
sed -i "s|__SUPABASE_URL__|$SUPABASE_URL|g" index.html && sed -i "s|__SUPABASE_ANON_KEY__|$SUPABASE_ANON_KEY|g" index.html
```

In **Vercel → Project Settings → General → Build & Development Settings**:
- **Build Command**: `sed -i "s|__SUPABASE_URL__|$SUPABASE_URL|g" index.html && sed -i "s|__SUPABASE_ANON_KEY__|$SUPABASE_ANON_KEY|g" index.html`
- **Output Directory**: `.` (root)
- **Install Command**: *(leave blank)*

### 6. Local Development

```bash
# Clone the repo
git clone <your-repo-url>
cd life-rpg

# Create a local env file (not committed)
cp .env.example .env.local
# Fill in your Supabase URL and anon key

# Serve locally (any static server works)
npx serve .
# or
python3 -m http.server 3000
```

For local dev, edit `index.html` directly and replace the placeholder tokens with your actual values temporarily (do not commit them).

---

## File Structure

```
/
├── index.html          App shell + auth gate
├── app.js              Main routing, auth state, nav
├── supabase.js         Supabase client + all DB functions
├── styles.css          All styles + CSS variables for theming
├── vercel.json         Vercel SPA rewrite rules
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
