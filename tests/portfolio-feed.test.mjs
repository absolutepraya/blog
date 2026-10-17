import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('portfolio feed selects public posts and matches their OG images', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'blog-feed-test-'));
  try {
    const content = join(temp, 'content');
    const output = join(temp, 'public');
    await mkdir(join(content, 'posts'), { recursive: true });
    await mkdir(join(content, 'private'), { recursive: true });
    await mkdir(join(content, 'other'), { recursive: true });
    const fixtures = [
      ['posts/one', '2026-01-01', ''],
      ['posts/two', '2026-01-02', ''],
      ['posts/three', '2026-01-03', 'social_image: "/images/custom.png"'],
      ['posts/four', '2026-01-04', 'type: custom'],
      ['other/impostor', '2026-01-09', 'type: posts'],
      ['posts/hidden', '2026-01-05', 'hidden: true'],
      ['posts/password', '2026-01-06', 'password_hash: "secret"'],
      ['posts/draft', '2026-01-07', 'draft: true'],
      ['posts/future', '2999-01-01', ''],
      ['private/secret', '2026-01-08', ''],
    ];
    for (const [slug, date, extra] of fixtures) {
      await writeFile(join(content, `${slug}.md`), `---\ntitle: "${slug}"\ndate: ${date}\ndescription: 'A "quoted" summary & more.'\n${extra}\n---\nArticle body.\n`);
    }
    execFileSync('hugo', ['--buildDrafts', '--buildFuture', '--contentDir', content, '--destination', output], { stdio: 'pipe' });
    const { posts } = JSON.parse(await readFile(join(output, 'feed.json'), 'utf8'));
    assert.deepEqual(posts.map(p => p.title), ['posts/four', 'posts/three', 'posts/two']);
    assert.equal(posts[1].image, 'https://blog.abhipraya.dev/images/custom.png');
    const hash = createHash('md5').update('/posts/four/').digest('hex');
    assert.equal(posts[0].image, `https://blog.abhipraya.dev/social/${hash}.png`);
    assert.equal(posts[0].description, 'A "quoted" summary & more.');
    for (const post of posts) {
      const html = await readFile(join(output, new URL(post.url).pathname, 'index.html'), 'utf8');
      assert.ok(html.includes(`<meta property="og:image" content="${post.image}">`));
    }
    const headers = await readFile(join(output, '_headers'), 'utf8');
    assert.match(headers, /\/feed\.json\n  Access-Control-Allow-Origin: \*/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
