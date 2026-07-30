# blog.abhipraya.dev

Source for [blog.abhipraya.dev](https://blog.abhipraya.dev/), a Hugo blog by Daffa Abhipraya with a Solarized light and dark theme.

## What is included

- Markdown posts, PPL course reflections, and static assets
- Local Ubuntu and Ubuntu Mono fonts
- Mermaid diagrams and optional KaTeX math
- Automatic WebP image delivery
- Generated Open Graph and Twitter preview cards for public pages

Public post cards can include up to three local images or Mermaid diagrams from the post body. Cards are regenerated during every production build.

## Develop

```bash
npm ci
hugo server
```

## Build

```bash
npm run build
```

This generates social preview images under `static/social/` and builds the production site into `public/`. Both directories are generated artifacts and should not be edited by hand.

## Deploy

Cloudflare Worker Assets is the release target. The deployment workflow runs the social-card test and production Hugo build, publishes a public preview Worker for same-repository pull requests, and deploys production only from `main`.

```bash
npm run check
npm run preview
npm run deploy:preview
```

`npm run deploy:production` is a break-glass command for a clean `main` checkout. Normal production releases run in GitHub Actions. The `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_PREVIEW_API_TOKEN` repository secrets support previews; `CLOUDFLARE_PRODUCTION_API_TOKEN` is scoped to the `Production` GitHub environment.

Before the first verified Cloudflare cutover, Vercel remains the live rollback path for [blog.abhipraya.dev](https://blog.abhipraya.dev/). Do not remove its project, domain alias, or `vercel.json` until Cloudflare production has been verified for seven days.

The Worker serves generated `public/` files. HTML, feeds, sitemap, robots, and social cards revalidate on every request; fonts and fingerprinted CSS are immutable; images cache for one week. Use Cloudflare's targeted cache purge only for an exceptional stale image or social card.

## Content and images

Posts live in `content/posts/`. Store original images in `static/images/` and reference them with site-relative paths, for example:

```markdown
![Descriptive alt text](/images/example.png)
```

See [AGENTS.md](AGENTS.md) for the full authoring and project guide.
