# Sean Kim — portfolio

Single-page static site built with Astro 7 and TypeScript, from the Figma page "Simplified (v2)". Plain CSS with custom properties. The only client-side scripts are the journey map, the bag carousel, the split-flap intro and the mobile menu. Besides the home page there are project case studies (`/projects/<id>`) and, once a post is published, `/thoughts`. The old `/about`, `/experience` and `/projects` URLs redirect to sections of the home page.

## Run

```sh
npm install
npm run dev        # http://localhost:4321 — draft posts are visible here
npm run build      # type-checks, then builds static files into dist/
npm run preview    # serves dist/
npm test           # journey-map geometry checks (Figma framing, camera bounds)
```

Node 22 or newer.

## Edit content (no code changes needed)

Everything a visitor reads lives in `src/content/`:

| File | What it holds |
|---|---|
| `profile.json` | Name, headline, the three About paragraphs (`bio`), availability line, email, LinkedIn, GitHub, résumé path |
| `experience.json` | Roles, newest first. `end: null` means "Present". `tags` is the blue line under each role. `type: "Student club"` puts a role under "Leadership & extracurricular". |
| `projects.json` | Projects, all shown under Selected work. A `caseStudy` block creates `/projects/<id>` and makes the row a link. |
| `cities.json` | The 7 journey stops (order, map coordinates, distances). |
| `interests.json` | Up to 6 bags. `blurb` is optional. `photo` takes an image path in `public/`; `null` shows the photo placeholder. |
| `posts/*.md` | Thoughts posts. `draft: true` keeps a post out of production builds. The Thoughts nav links, route and home section appear only when at least one post is published. The home page shows the 2 newest. |

The files are validated against the schema in `src/content.config.ts` when you build.

To replace the résumé, overwrite `public/sean-kim-resume.pdf` (currently a copy of the Quant résumé).

To rebuild the Open Graph image after changing `src/assets/og-split-flap.png`, run `node scripts/og.mjs`.

## Deploy

Set `SITE_URL` to the real domain at build time. The sitemap, canonical URLs and Open Graph tags use it. Without it, the build assumes `https://sean-kim.kr`.

- **Vercel:** import the repo. Framework preset: Astro. Add the environment variable `SITE_URL`.
- **Netlify:** build command `npm run build`, publish directory `dist`, environment variable `SITE_URL`.
- **GitHub Pages:** serve from a custom domain (`sean-kim.kr`) or a user site. The site uses root-relative links, so a project sub-path (`/repo-name/`) won't work. Use the official `withastro/action` workflow with `SITE_URL` set.
