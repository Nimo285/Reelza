# Reelza SEO guide: get indexed, then earn links

## Why Google wasn't showing the site

1. **The canonical, `og:url` and `og:image` tags pointed at `https://your-domain.example/`.** That tells Google "the real page lives on another site", which is enough to keep a page out of the index. This is fixed: every URL is now filled in from your real domain at request time (see `SITE_URL` below).
2. **No sitemap, no robots.txt, and the site was never submitted to Google.** Both files are now generated automatically. Submitting is the part only you can do (steps below).
3. **New domain.** Even with everything correct, a brand-new site usually takes days to a few weeks to appear.
4. **Very little content.** One landing page plus two legal pages is thin. Indexing is not the same as ranking, and "Instagram downloader" is a crowded search term. Adding a few helpful guides (see Phase 2) is the best next step.

## What changed in the code

| Request | Result |
|---|---|
| sitemap.xml | Generated at `/sitemap.xml` (home, privacy, terms, with last-modified dates) |
| robots.txt | Generated at `/robots.txt`: allows the site, blocks `/api/`, points to the sitemap |
| Remove noindex | There were none on the pages. Only `/api/*` JSON responses send `noindex` (correct; they shouldn't be in search) |
| Canonical tags | One per page, absolute URL, matches `og:url` |
| Titles and descriptions | Unique per page; home title 57 chars, descriptions 136–153 chars |
| One H1 and heading order | One H1 per page, no skipped levels (footer headings were H4 under H2; now H3) |
| Alt text | The only `<img>` on the site is the result thumbnail, which now has real alt text. No other images existed to caption |
| Schema | `WebSite`, `Organization`, `WebApplication`, `FAQPage` (built from the visible FAQ, word for word), `WebPage` and `BreadcrumbList` on legal pages |
| Internal links | Legal pages have the full header/footer nav; home links to privacy and terms from the FAQ and trust section; custom 404 page links back |
| Broken links | Anchors and internal links all checked and return 200. Placeholder e-mail and `[add date]` text replaced |
| Compress images | New `og-image.jpg` is ~52 KB; icons are small PNG/ICO/SVG; HTML is gzip-compressed; assets cached for 7 days |
| Core Web Vitals | Google Fonts no longer block rendering, fewer font weights, `width`/`height` on the thumbnail, gzip, caching |
| Mobile | Input font 16px (stops iOS zoom), 48px tap targets, tighter phone padding, no horizontal scroll at 320/375/768/1280 |
| Enforce HTTPS | http→https 301, HSTS header, one canonical hostname (www ↔ non-www 301) |
| URL slugs | `/privacy`, `/terms`; old `.html` URLs and trailing slashes 301-redirect |
| og:image | 1200×630 `/og-image.jpg` with type, size and alt text; Twitter card included |

## Settings you must fill in (`.env` or your host's environment variables)

- `SITE_URL=https://yourdomain.com`: your final address, no trailing slash. **Set this before you submit anything to Google.**
- `GSC_VERIFICATION`: optional, only for the "HTML tag" Search Console method.
- `CONTACT_EMAIL`: a mailbox you actually read (defaults to `hello@yourdomain.com`; create it or set another).
- If you see "too many redirects", your host is already forcing HTTPS. Set `ENFORCE_HTTPS=false`.

HTTPS itself (the certificate) comes from your host or Cloudflare. Render, Railway, Fly and Cloudflare provide it for free; the server only makes sure visitors use it.

## Search Console: do these in order

I can't verify the site for you, because that needs your Google login.

1. Deploy, then open `https://yourdomain.com/robots.txt` and `/sitemap.xml` in a browser. Both should load and show your real domain.
2. Go to **search.google.com/search-console** → **Add property**.
   - **Domain property (best):** add the DNS TXT record Google shows at your domain registrar. It covers http, https and www.
   - **URL-prefix property:** choose the **HTML tag** method, copy only the `content="…"` value into `GSC_VERIFICATION`, redeploy, then click Verify.
3. **Sitemaps** → enter `sitemap.xml` → Submit.
4. **URL inspection** → paste your home page address → **Test live URL** (should say it's available to Google) → **Request indexing**. Repeat for `/privacy` and `/terms` if you like.
5. Check **Pages** after 3–14 days. "Discovered – currently not indexed" means Google knows the page but hasn't crawled it yet; "Crawled – currently not indexed" usually means it wants more or better content.
6. In **Bing Webmaster Tools**, choose "Import from Google Search Console" (two minutes, extra search traffic).
7. Run your live address through **pagespeed.web.dev**. Real-user Core Web Vitals only appear after about 28 days of traffic.

## Backlink strategy (white-hat only)

**Expectation:** 5–10 genuinely relevant links in the first 90 days is a good result. Quality and relevance beat volume.

**Check the rules first.** Tools that download other people's content are restricted or banned on some directories, subreddits, ad networks and app stores, and creators sometimes file copyright complaints. Read each site's rules before posting, and keep the terms and privacy pages visible.

### Phase 1: weeks 1–2, foundations
- Create the same brand profile (name, URL, one-line description) on X, LinkedIn, YouTube, Pinterest and Reddit. Most links are nofollow, but they give Google consistent brand signals and give you places to be found.
- Submit to tool directories that accept free utilities (AlternativeTo, SaaSHub, Uneed, BetaList, Indie Hackers product page). Accept that some will decline a downloader.
- If you own other sites, add **one** natural, contextual link from a relevant page. Avoid site-wide footer links across several of your own sites, which look manipulative.

### Phase 2: weeks 2–6, give people something worth linking to
A one-page tool rarely earns links. Helpful pages do. Ideas that fit the site:
- "How to save your own Instagram Reels to your phone (iPhone and Android)"
- "Instagram Reel size, length and format cheat sheet"
- "Why does an Instagram video look blurry after saving? How to fix it"

Each page should be genuinely useful, link back to the tool, and be added to the sitemap. I can build these pages in the same style if you want.

### Phase 3: weeks 4–12, outreach
- **Resource pages:** search for "tools for content creators", "social media tools list", "Reels resources", and email the owners with a short, specific pitch for why Reelza fits.
- **Broken-link building:** on those lists, find dead links (the "Check My Links" browser extension works) and offer yours as a replacement for the same topic.
- **Expert-quote platforms:** Qwoted, Featured and Connectively. Answer journalist queries about creator tools or short-form video.
- **YouTube:** a short tutorial with the link in the description often outperforms written outreach.
- **Communities:** answer real questions in Reddit, Quora, Facebook groups and Discord servers, and mention the tool only when it truly solves the problem. Follow each community's self-promotion rules.

### Anchor text
Mostly brand and URL ("Reelza", "reelza link"), some generic ("this tool"), only a few descriptive. Avoid repeating "instagram downloader" as the anchor every time.

### Never do
Buy links, join link-exchange schemes, run private blog networks, spam comments, or publish low-quality spun guest posts. These can trigger Google manual actions that are hard to undo.

### Track it
Keep a simple sheet: date, site, link URL, anchor, type (directory, guest post, mention), status. Check **Search Console → Links** monthly to see what Google has actually found.
