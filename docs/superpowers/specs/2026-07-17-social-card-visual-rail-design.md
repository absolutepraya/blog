# Social Card Visual Rail Design

The blog's generated social-preview cards will evolve from text-only cards into media-aware cards. The visual rail makes a shared post representative of its actual content while preserving the existing light Solarized identity and reliable PNG unfurls.

## Scope

This design applies to public regular posts. Private pages remain excluded from social metadata, visual extraction, and card generation.

The existing `social_image` front matter remains a whole-card override. When it is set, the generated visual-rail pipeline does not run for that page.

## Card composition

Cards remain 1200 by 630 PNGs with the light Solarized canvas.

The header keeps the `~/abhipraya` wordmark at top left, using Ubuntu Bold at 2.5rem, dark teal background, light text, 0.25rem by 0.5rem padding, and 2px letter spacing. The published date sits at top right in Ubuntu Mono.

The central content frame starts at x=72, y=164, is 1056px wide and 350px tall. It has square corners and a 4px border. Its left three quarters contain the title and up to three description lines. Its right quarter contains a visual rail. The visual rail always remains inside the frame. Text has 36px of inset from the frame border.

When there are no eligible visuals, the text area expands across the full frame. There is no empty reserved rail.

## Adaptive visual rail

The rail uses the first three successfully rendered eligible visuals in body order. Visuals slightly overlap one another but never cross the content-frame boundary. Every visual card has square 90-degree corners and a 4px `#93a1a1` border, matching the main content frame.

| Eligible visual count | Rail layout | Crop ratio |
| --- | --- | --- |
| 3 | Three overlapping cards | 16:9 |
| 2 | Two larger overlapping cards | 4:3 |
| 1 | One larger, vertically centered card | 1:1 |
| 0 | No rail, full-width text | None |

Every crop uses centered `cover` behavior. A focal-point override may be added later only when an actual post needs one.

## Eligible visual sources

The build scans each post body in reading order. Eligible visual sources are:

- Local Markdown images served from `/images/`
- Local Hugo `figure` shortcode images
- Mermaid code blocks, rendered as static thumbnails using the blog's light Solarized treatment

Remote image URLs are intentionally excluded. They are not reliable build inputs and are outside the blog's local privacy-review boundary.

## Build pipeline

`npm run build` gains a media stage before the existing social-card and Hugo stages:

1. Parse public post bodies and collect eligible visual sources in reading order.
2. Render Mermaid diagrams and normalize selected visuals into the required crop ratios.
3. Compose the final social PNG, including the text frame and adaptive visual rail.
4. Run Hugo to publish the card files and emit their existing Open Graph and Twitter metadata.

Intermediate visual outputs and final cards remain generated and gitignored. The production build is self-contained and does not depend on a browser session or remote image downloads.

## Failure behavior

Missing local files, unsupported formats, and Mermaid render failures produce a build warning and are skipped. The build continues with the next eligible visual. If no visual survives, the post receives the full-width text-only card.

## Verification

Verification covers cards for zero, one, two, and three eligible visuals, a Mermaid-only post, and missing or invalid source inputs. It also verifies that generated public URLs return PNG content after deployment.
