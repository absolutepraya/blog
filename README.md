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
npm install
hugo server
```

## Build

```bash
npm run build
```

This generates social preview images under `static/social/` and builds the production site into `public/`. Both directories are generated artifacts and should not be edited by hand.

## Deploy

Pushes to `main` deploy through Vercel to [blog.abhipraya.dev](https://blog.abhipraya.dev/).

## Content and images

Posts live in `content/posts/`. Store original images in `static/images/` and reference them with site-relative paths, for example:

```markdown
![Descriptive alt text](/images/example.png)
```

See [AGENTS.md](AGENTS.md) for the full authoring and project guide.
