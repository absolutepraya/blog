// Sketch look for Mermaid diagrams: Solarized role tints, Shantell Sans, and a rough.js pass.
//
// Mermaid renders each diagram in its classic look first. `sketchTheme()` supplies the colors and
// fonts for that render, then `sketchPass()` redraws every shape with rough.js so all diagram types
// (flowchart, state, sequence, pie, xychart, sankey, radar) share one hand-drawn style. Mermaid's own
// handDrawn look only covers flowchart-style shapes, so it is not used.
//
// Authors tag nodes with a role class (`A["Label"]:::svc`, or `class A svc` in state diagrams):
//   svc = service, out = output, store = storage, human = person, gate = gate or boundary, ext = external.
// Untagged nodes stay neutral.

export const FONT_FAMILY = '"Shantell Sans", "Ubuntu", sans-serif';
export const FONT_SIZE_PX = 16;

// Role -> Solarized accent, via the same CSS variables the pie colors use.
export const ROLE_VARS = {
    svc: '--mermaid-pie1',
    out: '--mermaid-pie2',
    store: '--mermaid-pie3',
    human: '--mermaid-pie4',
    gate: '--mermaid-pie5',
    ext: '--mermaid-pie6',
};

// ---------- color helpers (hex in, hex out) ----------

export function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex(rgb) {
    return '#' + rgb.map((c) => {
        const x = Math.round(Math.max(0, Math.min(255, c))).toString(16);
        return x.length === 1 ? '0' + x : x;
    }).join('');
}

// pct percent of `fgHex` over `bgHex`.
export function colorMix(fgHex, bgHex, pct) {
    const fg = hexToRgb(fgHex);
    const bg = hexToRgb(bgHex);
    const t = pct / 100;
    return rgbToHex(fg.map((c, i) => c * t + bg[i] * (1 - t)));
}

function mixRgb(a, b, pct) {
    const t = pct / 100;
    return a.map((c, i) => c * t + b[i] * (1 - t));
}

function relativeLuminance(rgb) {
    const f = rgb.map((c) => {
        const x = c / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
}

export function contrastRatio(a, b) {
    const x = relativeLuminance(a);
    const y = relativeLuminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Reads a CSS custom property as hex, falling back when unset.
export function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!value) return fallback;
    const m = value.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
    return m ? rgbToHex([parseInt(m[1]), parseInt(m[2]), parseInt(m[3])]) : value;
}

// ---------- font ----------

// Mermaid measures label text to size its boxes, so the font has to be ready before the first render.
export async function loadSketchFont() {
    if (!document.fonts) return;
    try {
        await Promise.all([
            document.fonts.load(`${FONT_SIZE_PX}px "Shantell Sans"`),
            document.fonts.load(`700 ${FONT_SIZE_PX}px "Shantell Sans"`),
        ]);
    } catch (e) {
        // Fall back to Ubuntu: the diagram still renders, only the font differs.
    }
}

// ---------- Mermaid config ----------

// Theme overrides merged over the base theme. `read` is injectable for tests.
export function sketchTheme(dark, read = cssVar) {
    const bg = read('--mermaid-bg', dark ? '#002b36' : '#fdf6e3');
    const fg = read('--mermaid-fg', dark ? '#839496' : '#657b83');
    const accent = read('--mermaid-accent', '#268bd2');
    const edge = colorMix(fg, bg, 45);
    const axis = colorMix(fg, bg, 55);
    const series = [];
    for (let i = 1; i <= 8; i++) series.push(read(`--mermaid-pie${i}`, '#268bd2'));

    let css = '';
    css += '.flowchart-link, .edgePath path.path, .messageLine0, .messageLine1, .transition { stroke-width: 1.5px; }';
    css += `.marker, .arrowMarkerPath { fill: ${edge} !important; stroke: ${edge} !important; }`;
    // `:not(.sk)` keeps these rules off the rough.js paths, which carry their own inline paint.
    for (const [role, variable] of Object.entries(ROLE_VARS)) {
        const hue = read(variable, accent);
        const shapes = ['rect', 'path:not(.sk)', 'polygon', 'circle', 'ellipse'].map((s) => `.node.${role} ${s}`).join(', ');
        css += `${shapes} { fill: ${colorMix(hue, bg, 16)} !important; stroke: ${colorMix(hue, bg, 80)} !important; stroke-width: 1.5px !important; }`;
    }
    css += `.actor { fill: ${colorMix(accent, bg, 14)} !important; stroke: ${colorMix(accent, bg, 80)} !important; }`;
    css += `.cluster rect { fill: ${colorMix(fg, bg, 3)} !important; stroke-dasharray: 4 3; }`;
    css += '.edgeLabel, .edgeLabel p, .edgeLabel span { font-size: 0.85em; }';

    const themeVariables = {
        fontFamily: FONT_FAMILY,
        fontSize: `${FONT_SIZE_PX}px`,
        lineColor: edge,
        defaultLinkColor: edge,
        xyChart: {
            plotColorPalette: series.join(','),
            backgroundColor: bg,
            titleColor: fg,
            xAxisLabelColor: fg, xAxisTitleColor: fg, xAxisTickColor: axis, xAxisLineColor: axis,
            yAxisLabelColor: fg, yAxisTitleColor: fg, yAxisTickColor: axis, yAxisLineColor: axis,
        },
    };
    for (let i = 0; i < 12; i++) themeVariables[`cScale${i}`] = series[i % series.length];

    // DEPTH_FIRST was the only ELK cycle breaker that kept both a feedback-loop flowchart and a
    // subgraph flowchart flowing top to bottom (the default and MODEL_ORDER each broke one of them).
    // ELK does not keep declaration order for nodes with no edges between them, so a list that should
    // read top to bottom needs invisible links: A ~~~ B ~~~ C.
    return { themeVariables, themeCSS: css, elk: { cycleBreakingStrategy: 'DEPTH_FIRST' } };
}

// ---------- rough.js pass ----------

const SKIP = 'defs, marker, clipPath, mask, pattern, foreignObject, symbol, linearGradient, radialGradient';
const STYLE = { roughness: 0.9, bowing: 0.9, strokeMin: 1.4, soften: 80 };
const MIN_STROKE_CONTRAST = 2.4;

// Mermaid draws rounded nodes (`(text)`, state nodes) and sequence actors as <rect rx ry>. rough.js
// rectangles have square corners, so those are redrawn as a rounded path to keep the shape.
export function roundedRectPath(x, y, w, h, rx, ry) {
    let rX = rx > 0 ? rx : ry;
    let rY = ry > 0 ? ry : rx;
    rX = Math.min(rX, w / 2);
    rY = Math.min(rY, h / 2);
    return [
        `M${x + rX},${y}`,
        `H${x + w - rX}`, `A${rX},${rY} 0 0 1 ${x + w},${y + rY}`,
        `V${y + h - rY}`, `A${rX},${rY} 0 0 1 ${x + w - rX},${y + h}`,
        `H${x + rX}`, `A${rX},${rY} 0 0 1 ${x},${y + h - rY}`,
        `V${y + rY}`, `A${rX},${rY} 0 0 1 ${x + rX},${y}`,
        'Z',
    ].join(' ');
}

// Classes Mermaid's CSS keys behavior on, kept on the replacement group: pie slices use them for the
// configured highlight and hover highlight, and `.pieCircle` carries the slice opacity.
export const KEPT_CLASSES = ['pieCircle', 'highlighted', 'highlightedOnHover'];

export function sketchClassName(originalClass) {
    const kept = (originalClass || '').split(/\s+/).filter((c) => KEPT_CLASSES.includes(c));
    return ['sketch', ...kept].join(' ');
}

function parseRgb(value) {
    const m = value && value.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat);
    return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
}

function paintOf(value, opacity) {
    if (!value || value === 'none') return null;
    if (value.indexOf('url(') === 0) return { url: value.replace(/url\(["']?(.*?)["']?\)/, 'url($1)') };
    const c = parseRgb(value);
    if (!c || c.a === 0) return null;
    return { rgb: c.rgb, a: c.a * (Number.isNaN(opacity) ? 1 : opacity) };
}

function rgba(rgb, a) {
    return `rgba(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])},${+a.toFixed(3)})`;
}

// Redraws the shapes of each rendered diagram under `root` with rough.js. Idempotent per svg.
export function sketchPass(root, { rough, bgHex, fgHex }) {
    const bg = hexToRgb(bgHex);
    const fg = hexToRgb(fgHex);
    let seed = 11; // fixed so diagrams look the same on every load

    // Soften saturated strokes toward the background, but keep them visible against it.
    const softStroke = (p, line) => {
        if (!p) return null;
        if (p.url) return p.url;
        let rgb = mixRgb(p.rgb, bg, line ? Math.min(100, STYLE.soften + 15) : STYLE.soften);
        for (let n = 0; n < 6 && contrastRatio(rgb, bg) < MIN_STROKE_CONTRAST; n++) rgb = mixRgb(fg, rgb, 25 + n * 10);
        return rgba(rgb, p.a);
    };

    root.querySelectorAll('svg[aria-roledescription]').forEach((svg) => {
        if (svg.dataset.sketched) return;
        svg.dataset.sketched = '1';
        const rc = rough.svg(svg);
        const vb = svg.viewBox && svg.viewBox.baseVal;
        Array.from(svg.querySelectorAll('rect, circle, ellipse, line, polyline, polygon, path')).forEach((el) => {
            if (el.closest(SKIP)) return;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return;
            const tag = el.tagName.toLowerCase();
            const fill = paintOf(cs.fill, parseFloat(cs.fillOpacity));
            let stroke = paintOf(cs.stroke, parseFloat(cs.strokeOpacity));
            const sw = parseFloat(cs.strokeWidth) || 0;
            if (!stroke || sw === 0) stroke = null;
            if (!fill && !stroke) return;
            if (tag === 'rect') {
                const w = parseFloat(el.getAttribute('width'));
                const h = parseFloat(el.getAttribute('height'));
                if (!(w > 0) || !(h > 0)) return; // Mermaid leaves empty label rects behind
                if (vb && fill && !stroke && w >= vb.width * 0.95 && h >= vb.height * 0.95) return; // chart background
            }
            const lineLike = tag === 'line' || tag === 'polyline' || (tag === 'path' && !fill);
            const dash = cs.strokeDasharray && cs.strokeDasharray !== 'none'
                ? cs.strokeDasharray.split(/[ ,]+/).map(parseFloat).filter((n) => !Number.isNaN(n))
                : undefined;
            const opts = {
                seed: seed++,
                roughness: STYLE.roughness,
                bowing: STYLE.bowing,
                stroke: stroke ? softStroke(stroke, lineLike) : 'none',
                strokeWidth: stroke ? (sw > 6 ? sw : Math.max(STYLE.strokeMin, Math.min(sw * 1.1, 3.2))) : 0,
                fillStyle: 'solid',
                disableMultiStroke: lineLike, // keeps arrowhead markers on a single clean path end
                strokeLineDash: dash && dash.length ? dash : undefined,
            };
            if (fill) opts.fill = fill.url || rgba(fill.rgb, fill.a);
            const n = (k) => parseFloat(el.getAttribute(k)) || 0;
            let node;
            try {
                if (tag === 'rect') {
                    const rx = n('rx');
                    const ry = n('ry');
                    node = rx > 0 || ry > 0
                        ? rc.path(roundedRectPath(n('x'), n('y'), n('width'), n('height'), rx, ry), opts)
                        : rc.rectangle(n('x'), n('y'), n('width'), n('height'), opts);
                }
                else if (tag === 'circle') node = rc.circle(n('cx'), n('cy'), n('r') * 2, opts);
                else if (tag === 'ellipse') node = rc.ellipse(n('cx'), n('cy'), n('rx') * 2, n('ry') * 2, opts);
                else if (tag === 'line') node = rc.line(n('x1'), n('y1'), n('x2'), n('y2'), opts);
                else if (tag === 'polygon' || tag === 'polyline') {
                    const pts = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(parseFloat);
                    const pairs = [];
                    for (let i = 0; i + 1 < pts.length; i += 2) pairs.push([pts[i], pts[i + 1]]);
                    node = tag === 'polygon' ? rc.polygon(pairs, opts) : rc.linearPath(pairs, opts);
                } else node = rc.path(el.getAttribute('d') || '', opts);
            } catch (e) {
                return; // leave the original shape in place
            }
            if (!node) return;
            node.setAttribute('class', sketchClassName(el.getAttribute('class')));
            node.setAttribute('stroke-linecap', 'round');
            node.setAttribute('stroke-linejoin', 'round');
            ['transform', 'opacity'].forEach((a) => { if (el.getAttribute(a)) node.setAttribute(a, el.getAttribute(a)); });
            const paths = node.querySelectorAll('path');
            paths.forEach((sp) => {
                sp.setAttribute('class', 'sk');
                // Mermaid's theme CSS (`.node path { fill; stroke }`) beats presentation attributes, so pin the paint inline.
                ['stroke', 'stroke-width', 'fill'].forEach((a) => {
                    const v = sp.getAttribute(a);
                    if (v !== null) sp.style.setProperty(a, v, 'important');
                });
            });
            const last = paths[paths.length - 1];
            const markerEnd = el.getAttribute('marker-end');
            const markerStart = el.getAttribute('marker-start');
            if (last && markerEnd) last.setAttribute('marker-end', markerEnd);
            if (last && markerStart) last.setAttribute('marker-start', markerStart);
            el.parentNode.insertBefore(node, el);
            el.remove();
        });
    });
}
