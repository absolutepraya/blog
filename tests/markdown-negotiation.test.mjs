import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estimateTokens, markdownAssetPath, prefersMarkdown } from '../worker/negotiate.js';

test('agents that ask for markdown get it', () => {
  assert.equal(prefersMarkdown('text/markdown'), true);
  assert.equal(prefersMarkdown('text/markdown, text/html;q=0.9'), true);
  assert.equal(prefersMarkdown('text/markdown;q=0.8, text/html;q=0.8'), true);
});

test('browsers and wildcard clients stay on HTML', () => {
  assert.equal(prefersMarkdown(undefined), false);
  assert.equal(prefersMarkdown(null), false);
  assert.equal(prefersMarkdown('*/*'), false);
  assert.equal(prefersMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'), false);
  assert.equal(prefersMarkdown('text/html, text/markdown;q=0.5'), false);
  assert.equal(prefersMarkdown('text/markdown;q=0'), false);
});

test('page paths map to their generated markdown file', () => {
  assert.equal(markdownAssetPath('/'), '/index.md');
  assert.equal(markdownAssetPath('/about/'), '/about/index.md');
  assert.equal(markdownAssetPath('/about'), '/about/index.md');
  assert.equal(markdownAssetPath('/posts/hermes-agent-setup/'), '/posts/hermes-agent-setup/index.md');
});

test('files with an extension are never rewritten', () => {
  assert.equal(markdownAssetPath('/feed.json'), null);
  assert.equal(markdownAssetPath('/robots.txt'), null);
  assert.equal(markdownAssetPath('/images/a.png'), null);
});

test('token estimate is roughly four characters per token', () => {
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
});
