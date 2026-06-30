#!/usr/bin/env node
/**
 * Builds static blog HTML pages from posts/*.md + blog/posts.json.
 * Run: node scripts/build-blog.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runInNewContext } from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

async function loadMarked() {
  const res = await fetch('https://cdn.jsdelivr.net/npm/marked@9.1.6/lib/marked.umd.js');
  const src = await res.text();
  const sandbox = { module: { exports: {} }, exports: {} };
  sandbox.exports = sandbox.module.exports;
  runInNewContext(src, sandbox);
  return sandbox.module.exports;
}

function formatDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPostPage(meta, bodyHtml) {
  const tags = (meta.tags || [])
    .map(t => `<span class="post-tag">${escapeHtml(t)}</span>`)
    .join('\n          ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(meta.title)} — Robert Sheiman</title>
  <meta name="description" content="${escapeHtml(meta.excerpt)}">
  <link rel="icon" href="../favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="../favicon-32x32.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <link rel="stylesheet" href="../liquid-glass.css">
  <link rel="stylesheet" href="blog.css">
</head>
<body>

  <nav aria-label="Blog navigation">
    <div class="nav-glass" aria-hidden="true">
      <span class="nav-glass__specular" aria-hidden="true"></span>
    </div>
    <div class="nav-inner">
      <a href="../index.html" class="nav-logo">RS</a>
      <button class="nav-toggle" aria-label="Toggle navigation">
        <span></span><span></span><span></span>
      </button>
      <ul class="nav-links">
        <li><a href="../index.html#journey">Journey</a></li>
        <li><a href="index.html" class="active">Blog</a></li>
        <li><a href="../index.html#contact">Contact</a></li>
      </ul>
    </div>
  </nav>

  <header class="post-hero">
    <div class="post-hero-inner">
      <a href="index.html" class="post-back"><i class="fa-solid fa-arrow-left"></i> All posts</a>
      <div class="post-meta">
        <span class="post-meta-pill"><i class="fa-regular fa-calendar"></i> ${formatDate(meta.date)}</span>
        <span class="post-meta-pill author"><i class="fa-regular fa-user"></i> ${escapeHtml(meta.author)}</span>
      </div>
      <h1 class="post-title">${escapeHtml(meta.title)}</h1>
      <div class="post-tags">
          ${tags}
      </div>
    </div>
  </header>
  <div class="post-body-wrap">
    <article class="post-body">
      ${bodyHtml}
    </article>
  </div>

  <footer>
    <p>&copy; 2026 <a href="../index.html">Robert Sheiman</a></p>
  </footer>

  <script src="../liquid-glass.js"></script>
  <script src="blog.js"></script>
</body>
</html>
`;
}

function renderBlogCard(post) {
  const tags = (post.tags || [])
    .map(t => `<span class="blog-tag">${escapeHtml(t)}</span>`)
    .join('');

  return `        <a class="blog-card" href="${post.slug}.html">
          ${tags ? `<div class="blog-tags">${tags}</div>` : ''}
          <div class="blog-card-meta">
            <span>${formatDate(post.date)}</span>
            <span class="dot"></span>
            <span>${escapeHtml(post.author)}</span>
          </div>
          <h2 class="blog-card-title">${escapeHtml(post.title)}</h2>
          <p class="blog-card-excerpt">${escapeHtml(post.excerpt)}</p>
          <span class="blog-card-read">Read article <i class="fa-solid fa-arrow-right"></i></span>
        </a>`;
}

async function main() {
  const marked = await loadMarked();
  const posts = JSON.parse(readFileSync(join(root, 'blog/posts.json'), 'utf8'));
  posts.sort((a, b) => b.date.localeCompare(a.date));

  for (const post of posts) {
    const mdPath = join(root, 'posts', `${post.slug}.md`);
    const md = readFileSync(mdPath, 'utf8');
    const bodyHtml = marked.parse(md).replace(/<h1[^>]*>.*?<\/h1>\s*/i, '');
    const html = renderPostPage(post, bodyHtml);
    writeFileSync(join(root, 'blog', `${post.slug}.html`), html);
    console.log(`  ✓ blog/${post.slug}.html`);
  }

  const cards = posts.map(renderBlogCard).join('\n');
  const indexPath = join(root, 'blog/index.html');
  let indexHtml = readFileSync(indexPath, 'utf8');
  indexHtml = indexHtml.replace(
    /<main class="blog-list" id="blog-list">[\s\S]*?<\/main>/,
    `<main class="blog-list" id="blog-list">\n${cards}\n  </main>`
  );
  writeFileSync(indexPath, indexHtml);
  console.log('  ✓ blog/index.html');

  console.log(`\nBuilt ${posts.length} post(s).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
