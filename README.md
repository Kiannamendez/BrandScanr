# BrandScanr

A marketing health scan for small businesses. Enter a website, get back a
health score and a plain-English list of what to fix first.

This is the **Phase 1 MVP**: it audits a homepage for the technical/marketing
basics (title tag, meta description, alt text, Open Graph tags, schema,
favicon, HTTPS, robots.txt, sitemap) and turns the raw findings into a
prioritized, human-readable action plan. Later phases (social profiles,
Google Business Profile, reviews, freshness score) can build on this same
structure — see `audit.js` for where new checks would go.

---

## What's in this repo

```
brandscanr/
├── server.js         → the web server (Express)
├── audit.js           → the actual scanning/checking logic
├── aiSummary.js        → turns findings into a written action plan
├── public/
│   ├── index.html      → the page itself
│   ├── style.css        → styling
│   └── app.js            → frontend logic (calls the server, renders results)
├── package.json
├── .env.example         → template for your API key (optional)
└── .gitignore
```

---

## 1. Install Node.js (one-time setup)

You need Node.js installed on your computer to run this project.

1. Go to [nodejs.org](https://nodejs.org)
2. Download and install the **LTS** version
3. Confirm it worked by opening a terminal (Terminal on Mac, Command Prompt
   or PowerShell on Windows) and typing:
   ```
   node --version
   ```
   You should see something like `v22.x.x`.

---

## 2. Get the code into your repo

Since your GitHub repo is empty, the easiest path is:

1. Download the files below (I've packaged them for you).
2. Clone your empty repo to your computer:
   ```
   git clone https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
   cd YOUR-REPO-NAME
   ```
3. Copy all the BrandScanr files into that folder (so `server.js`,
   `package.json`, `public/`, etc. sit directly inside it).
4. Push it up:
   ```
   git add .
   git commit -m "Initial BrandScanr MVP"
   git push
   ```

---

## 3. Run it on your computer

From inside the project folder:

```
npm install
npm start
```

Then open your browser to **http://localhost:3000** — you should see
BrandScanr running. Try scanning a real website.

> The scan works with no extra setup. It uses built-in, rule-based
> explanations. Adding AI-written summaries (step 4) is optional.

---

## 4. (Optional) Turn on AI-written summaries

Right now, "What to fix first" is written from templates. To have Claude
write a more natural, prioritized summary instead:

1. Get an API key at [console.anthropic.com](https://console.anthropic.com/settings/keys)
2. In your project folder, copy `.env.example` to a new file called `.env`
3. Paste your key in:
   ```
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```
4. Restart the server (`npm start`)

Never commit your `.env` file — it's already listed in `.gitignore` so Git
will ignore it automatically.

*(Want to use Gemini instead, per the original product doc? Swap the fetch
call in `aiSummary.js` for the Gemini API — the rest of the app doesn't
need to change.)*

---

## 5. Put it on the internet (free)

The easiest free option for a beginner is **Render**:

1. Go to [render.com](https://render.com) and sign up (you can sign in with GitHub)
2. Click **New +** → **Web Service**
3. Connect your GitHub account and select your BrandScanr repo
4. Use these settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. If you set up an API key in step 4, add it under **Environment** →
   **Environment Variables** as `ANTHROPIC_API_KEY`
6. Click **Create Web Service**

Render will give you a live URL (like `brandscanr.onrender.com`) within a
couple of minutes. Every time you `git push`, it redeploys automatically.

---

## Next steps (from the product vision doc)

Once this MVP feels solid, the natural next additions are, in order:

1. **Discover public profiles** — search for the business's Google Business
   Profile, Facebook, Instagram, etc. from the website's links.
2. **Platform-specific checks** — for each discovered profile, check what's
   publicly visible (profile photo, bio, last post date).
3. **AI prioritization** — instead of listing every check, rank the top 5
   by business impact (the `aiSummary.js` prompt is a good starting point
   to extend for this).
4. **Freshness score** — track *when* things were last updated, not just
   whether they exist.

Each of these can be added as its own module, similar to how `audit.js` is
structured today.
