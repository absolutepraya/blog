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

The blog is a static [Cloudflare Worker Assets](https://developers.cloudflare.com/workers/static-assets/) site. `abhipraya-blog` serves the complete Hugo `public/` output, with no application Worker code or server runtime. The production custom domain is `blog.abhipraya.dev`; public preview Workers use `workers.dev` URLs and never receive a custom domain.

`wrangler.jsonc` is the deployment contract: it pins Wrangler's compatibility date, enables Hugo-style trailing-slash routing, and makes Hugo's generated `404.html` the real 404 response. `static/_headers` supplies the cache and security headers at the asset edge.

### Local commands

```bash
npm run check                                      # Social-card test and production Hugo build
npm run preview                                    # Build and serve Worker Assets locally
npm run deploy:preview                             # Build and deploy the configured preview environment
npm run smoke:deployment -- https://example.workers.dev
```

Use `npm run deploy:production` only for an approved break-glass release from a clean, current `main` checkout. Follow it immediately with `npm run smoke:deployment -- https://blog.abhipraya.dev --production`. Normal production releases are CI-only.

### GitHub Actions release flow

The [deployment workflow](.github/workflows/deploy-cloudflare.yml) is the only normal production path.

1. `Verify` runs on pull requests and `main`: it installs Node 22 dependencies, uses Hugo 0.163.3 extended, tests social-card selection, builds the site, validates required generated files, then uploads `public/` as the sole deployment artifact.
2. Same-repository pull requests deploy that verified artifact as `abhipraya-blog-pr-<number>`, smoke-test it, and publish the public preview URL in the workflow summary. Fork pull requests receive verification only, never Cloudflare credentials.
3. A successful push to protected `main` deploys the same verified artifact through the `Production` GitHub environment, then smoke-tests `https://blog.abhipraya.dev`.
4. Closing a same-repository pull request deletes its preview Worker to stay within the Free plan's Worker limit.

`main` requires a pull request and a successful `Verify` check. Force-pushes and branch deletion are blocked; a review approval is intentionally not required. Workflow runs for the same pull request or ref cancel older in-progress runs.

### Credentials and deployment access

Use scoped Cloudflare API tokens, never a Global API key. GitHub is configured with these secret locations:

| Secret | Location | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Repository secret | Selects the Cloudflare account for CI. It is not a credential. |
| `CLOUDFLARE_PREVIEW_API_TOKEN` | Repository secret | Deploys and removes same-repository pull-request previews. |
| `CLOUDFLARE_PRODUCTION_API_TOKEN` | `Production` environment secret | Deploys the production Worker from `main` only. |

Do not expose tokens in commits, logs, issue comments, or pull-request text. Do not add Cloudflare credentials to fork workflows.

### Cache and security policy

The default response policy revalidates HTML, feeds, sitemap, robots, social cards, and other mutable files. `/css/*` and `/fonts/*` are immutable for one year. `/images/*` cache for one week and may serve stale content for one day while revalidating.

All responses receive HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and a restrictive `Permissions-Policy`. Do not add a Content Security Policy, Rocket Loader, Auto Minify, or zone-wide cache rules without a separate audit: the blog uses inline scripts, Mermaid, and optional KaTeX.

For an exceptional stale image or social card, use Cloudflare Dashboard's **Caching** settings to issue a custom purge for the exact URL. Do not purge the whole cache for a routine publish.

### Analytics

Cloudflare Web Analytics is intentionally limited to `blog.abhipraya.dev`. It is still awaiting dashboard activation after the cutover: sign in to Cloudflare, open **Web Analytics**, choose **Add a site**, select `blog.abhipraya.dev`, and keep **automatic setup** enabled. This adds Cloudflare's first-party beacon only to the proxied production domain, not preview Workers, and provides visitors, page views, referrers, page-load data, and Core Web Vitals.

Do not add Google Analytics or another third-party analytics script. After activation, verify the production response includes the Cloudflare Web Analytics beacon and confirm data appears in the dashboard.

### Provider status

The former Vercel project and `vercel.json` were intentionally removed on 2026-07-30. There is no Vercel deployment, Git integration, or rollback path to maintain. Do not reintroduce Vercel configuration unless a future migration is explicitly approved.

## Content and images

Posts live in `content/posts/`. Store original images in `static/images/` and reference them with site-relative paths, for example:

```markdown
![Descriptive alt text](/images/example.png)
```

See [AGENTS.md](AGENTS.md) for the full authoring and project guide.
