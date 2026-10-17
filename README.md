# Reelza — Instagram Reels & Video Downloader

## Folder layout (keep it exactly like this)

```
reelza/
├── server.js
├── package.json
├── .env              ← you create this (copy of .env.example)
├── .env.example
├── .gitignore
├── README.md
├── SEO-GUIDE.md      ← Search Console steps + backlink plan
└── public/
    ├── index.html        privacy.html        terms.html        404.html
    ├── og-image.jpg      favicon.ico         favicon.svg
    └── icon-192.png      icon-512.png        apple-touch-icon.png
```

Only the `public` folder is served to visitors. `server.js`, `package.json` and `.env` are never reachable from the web.

## Setup

1. Copy `.env.example` to `.env` and fill in:
   - `RAPIDAPI_KEY` — your key from RapidAPI (the host is already set)
   - `SITE_URL` — your real address, e.g. `https://yourdomain.com` (no trailing slash). **Needed for correct canonical tags, sitemap and social previews.**
2. `npm install`
3. `npm start` → open `http://localhost:3000`

The terminal shows what was loaded: `✅ RapidAPI key loaded.` and `✅ SITE_URL = …`. A ⚠️ line means something in `.env` is missing.

On a host such as Render or Railway, add the same values in the dashboard's environment-variable settings instead of uploading `.env`.

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `RAPIDAPI_KEY` | yes | Your RapidAPI secret key |
| `SITE_URL` | yes, before launch | Real domain for canonicals, sitemap, robots.txt, Open Graph, schema |
| `GSC_VERIFICATION` | optional | Search Console "HTML tag" value (just the `content` part) |
| `CONTACT_EMAIL` | optional | Address shown on the site (default `hello@yourdomain`) |
| `ENFORCE_HTTPS` | optional | `false` if you see "too many redirects" (host already forces HTTPS) |
| `RAPIDAPI_HOST` | no | Already set to the API you subscribed to |

## How it works

- `/`, `/privacy`, `/terms` are rendered with your real domain filled in. Old URLs (`/privacy.html`, `/index.html`, trailing slashes, www vs non-www, http) 301-redirect to the clean version.
- `/sitemap.xml` and `/robots.txt` are generated automatically.
- `GET /api/fetch-video?url=…` calls the RapidAPI `/convert` endpoint and returns the post's videos and photos.
- `GET /api/download?url=…` streams the chosen file as a real download. Only Instagram/Facebook CDN addresses are allowed.
- If the provider rejects a request (bad key, not subscribed, quota used up), visitors see a friendly "busy" message and the real reason is printed in your server log, e.g. `[provider] HTTP 429`.

## Before you go live

- **Regenerate your RapidAPI key** if it was ever pasted into a chat or screenshot, then put the new one in `.env`.
- Never commit `.env` (the `.gitignore` already excludes it).
- Create the mailbox you list as `CONTACT_EMAIL`.
- If you add analytics or ads, update the Cookies and Third parties sections of `public/privacy.html`.
- Follow `SEO-GUIDE.md` to verify the site in Google Search Console and submit the sitemap.

## Good to know

- Only public posts work. Private accounts can't be fetched.
- RapidAPI free plans have a monthly quota. When it runs out, visitors get the "busy" message until you upgrade or the month resets.
- Download rights stay with the original creator. Keep the notices on the site as they are.
- Instagram changes things from time to time, so keep an eye on the server log if downloads suddenly start failing.
