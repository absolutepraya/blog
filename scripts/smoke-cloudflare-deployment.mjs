import { access, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, relative, sep } from 'node:path';

const args = process.argv.slice(2);
const target = args.find((value) => !value.startsWith('--'));
const isProduction = args.includes('--production');

if (!target) {
  throw new Error('Usage: node scripts/smoke-cloudflare-deployment.mjs <base-url> [--production]');
}

const baseUrl = new URL(target);
baseUrl.pathname = '/';

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function findFirstFile(directory, predicate) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFirstFile(file, predicate);
      if (nested) return nested;
    } else if (predicate(entry.name)) {
      return file;
    }
  }
  return undefined;
}

async function requireFile(file) {
  try {
    await access(file, constants.R_OK);
  } catch {
    fail(`Expected generated file is missing: ${file}`);
  }
}

function deployedPath(file) {
  return `/${relative('public', file).split(sep).join('/')}`;
}

async function request(pathname, options = {}) {
  const url = new URL(pathname, baseUrl);
  let lastError;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: 'manual', ...options });
      if (response.status < 500 || attempt === 10) return response;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw lastError ?? new Error(`Unable to request ${url}`);
}

async function assertResponse(pathname, expectedStatus, expectedContentType) {
  let response;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    response = await request(pathname);
    if (response.status === expectedStatus || attempt === 10) break;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  assert(response.status === expectedStatus, `${pathname} returned ${response.status}, expected ${expectedStatus}`);
  if (expectedContentType) {
    assert(
      response.headers.get('content-type')?.includes(expectedContentType),
      `${pathname} has content type ${response.headers.get('content-type')}, expected ${expectedContentType}`,
    );
  }
  return response;
}

await Promise.all([
  requireFile('public/index.html'),
  requireFile('public/index.xml'),
  requireFile('public/sitemap.xml'),
  requireFile('public/robots.txt'),
  requireFile('public/404.html'),
]);

const socialCard = await findFirstFile('public/social', (name) => name.endsWith('.png'));
const image = await findFirstFile('public/images', (name) => /\.(avif|jpe?g|png|webp|svg)$/i.test(name));
const stylesheet = await findFirstFile('public/css', (name) => name.endsWith('.css'));
assert(socialCard, 'Expected at least one generated social card');
assert(image, 'Expected at least one generated image');
assert(stylesheet, 'Expected at least one generated stylesheet');

const home = await assertResponse('/', 200, 'text/html');
const canonical = home.text ? await home.text() : '';
assert(canonical.includes('rel=canonical href=https://blog.abhipraya.dev/'), 'Home canonical URL is incorrect');

const aboutRedirect = await request('/about');
assert([301, 302, 307, 308].includes(aboutRedirect.status), `/about returned ${aboutRedirect.status}, expected a redirect`);
assert(new URL(aboutRedirect.headers.get('location'), baseUrl).pathname === '/about/', '/about does not redirect to /about/');

const about = await assertResponse('/about/', 200, 'text/html');
const post = await assertResponse('/posts/agents-dev-setup-on-macbook/', 200, 'text/html');
assert((await about.text()).includes('rel=canonical href=https://blog.abhipraya.dev/about/'), 'About canonical URL is incorrect');
assert((await post.text()).includes('rel=canonical href=https://blog.abhipraya.dev/posts/agents-dev-setup-on-macbook/'), 'Post canonical URL is incorrect');
const feed = await assertResponse('/index.xml', 200, 'application/xml');
const sitemap = await assertResponse('/sitemap.xml', 200, 'application/xml');
const robots = await assertResponse('/robots.txt', 200, 'text/plain');
const font = await assertResponse('/fonts/ubuntu-400.woff2', 200, 'font/woff2');
const css = await assertResponse(deployedPath(stylesheet), 200, 'text/css');
await assertResponse(deployedPath(image), 200, undefined);
await assertResponse(deployedPath(socialCard), 200, 'image/png');
await assertResponse('/private/', 200, 'text/html');

const missing = await assertResponse('/__cloudflare-migration-missing__/', 404, 'text/html');
const privatePage = await request('/private/');
const privateBody = await privatePage.text();
assert(privateBody.includes('noindex, nofollow, noimageindex'), 'Private index page is missing its noindex directive');
assert((await missing.text()).includes('Page not found'), '404 page does not use the Hugo template');

for (const [name, expected] of Object.entries({
  'strict-transport-security': 'max-age=63072000',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  'cache-control': 'public, max-age=0, must-revalidate',
})) {
  assert(home.headers.get(name)?.includes(expected), `Home response is missing ${name}: ${expected}`);
}

const imageResponse = await request(deployedPath(image));
assert(imageResponse.headers.get('cache-control')?.includes('max-age=604800'), 'Image cache policy is incorrect');
const socialResponse = await request(deployedPath(socialCard));
assert(socialResponse.headers.get('cache-control')?.includes('max-age=0'), 'Social-card cache policy is incorrect');
assert(css.headers.get('cache-control')?.includes('max-age=31536000'), 'Stylesheet cache policy is incorrect');
assert(font.headers.get('cache-control')?.includes('max-age=31536000'), 'Font cache policy is incorrect');
for (const [pathname, response] of Object.entries({
  '/index.xml': feed,
  '/sitemap.xml': sitemap,
  '/robots.txt': robots,
  '/__cloudflare-migration-missing__/': missing,
})) {
  assert(response.headers.get('cache-control')?.includes('max-age=0'), `${pathname} cache policy is incorrect`);
}

if (isProduction) {
  assert(!home.headers.get('server')?.toLowerCase().includes('vercel'), 'Production is still served by Vercel');
}

console.log(`Cloudflare deployment smoke test passed for ${baseUrl.origin}`);
