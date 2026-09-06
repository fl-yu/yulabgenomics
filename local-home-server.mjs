import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = process.cwd();
const homeDir = join(root, 'content/home');
const staticDir = join(root, 'static');
const files = [
  'cta.md',
  'image.md',
  'welcome.md',
  'research_highlights.md',
  'research_metrics.md',
  'news.md',
];

const fallbackContent = {
  'cta.md': `---
title: Collaborate with the Yu Lab
subtitle: Partnering across computational biology, cancer genomics, and translational discovery.
weight: 60
---
We welcome collaborations in multi-omics analysis, biomarker discovery, reproducible workflows, and clinically grounded interpretation.

{{% cta cta_link="/contact/" cta_text="Get in touch" %}}
`,
  'image.md': `---
title: Integrated discovery workflows
subtitle: Translating large-scale molecular data into interpretable biological insight.
weight: 20
---
We combine molecular profiling, statistical modeling, and experiment-informed interpretation to move from raw measurements to actionable biological questions.
`,
  'welcome.md': `---
title: |
  Computational genomics for
  mechanistic discovery
widget: hero
weight: 10
css_class: home-hero
---
We build analysis frameworks that connect high-dimensional genomics data with interpretable biological signals, helping teams study tumor evolution, therapeutic response, and disease heterogeneity.

{{% cta cta_link="/research/" cta_text="Explore research areas" %}}
`,
  'research_highlights.md': `---
title: Research highlights
subtitle: Representative directions spanning single-cell analysis, translational modeling, and reproducible computation.
weight: 30
---
<div class="research-grid">
  <article class="research-card">
    <h3>Single-cell systems</h3>
    <p>Resolve cell states, lineage structure, and treatment response across complex tissues.</p>
    <div class="research-tags"><span>scRNA-seq</span><span>Spatial</span><span>Trajectory</span></div>
  </article>
  <article class="research-card">
    <h3>Translational modeling</h3>
    <p>Link genomic measurements with patient stratification and clinically relevant outcomes.</p>
    <div class="research-tags"><span>Biomarkers</span><span>Survival</span><span>Risk models</span></div>
  </article>
  <article class="research-card">
    <h3>Reproducible pipelines</h3>
    <p>Package robust workflows that make collaborative analysis easier to audit, rerun, and extend.</p>
    <div class="research-tags"><span>Automation</span><span>QC</span><span>Reporting</span></div>
  </article>
</div>
`,
  'research_metrics.md': `---
title: Research framework
subtitle: Core modes of analysis that shape ongoing work across the lab.
weight: 40
---
<div class="metric-grid">
  <article class="metric-card">
    <div class="metric-value">Single-cell</div>
    <div class="metric-label">high-resolution analysis of cellular states and transitions</div>
  </article>
  <article class="metric-card">
    <div class="metric-value">Multi-omics</div>
    <div class="metric-label">integrated molecular profiling, modeling, and interpretation</div>
  </article>
  <article class="metric-card">
    <div class="metric-value">Reproducible</div>
    <div class="metric-label">end-to-end workflows designed for collaborative science</div>
  </article>
</div>
`,
  'news.md': `---
title: Current directions
subtitle: Themes guiding recent work, new collaborations, and upcoming outputs.
weight: 50
---
### Active focus areas

- Advancing single-cell and spatial workflows for complex disease samples.
- Linking molecular features with therapeutic response and patient stratification.
- Strengthening reusable analysis infrastructure for collaborative, publication-ready research.
`,
};

const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function inlineMarkdown(text = '') {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function readParam(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'));
  if (!match) return '';
  return match[1].trim().replace(/^['"]|['"]$/g, '');
}

function readBlockParam(frontmatter, key) {
  const block = frontmatter.match(new RegExp(`^${key}:\\s*\\|\\s*\\n([\\s\\S]*?)(?=^\\S|\\Z)`, 'm'));
  if (!block) return readParam(frontmatter, key);
  return block[1]
    .split('\n')
    .map((line) => line.replace(/^ {2}/, ''))
    .join('\n')
    .trim();
}

function parseFile(raw, name) {
  const parts = raw.split('---');
  const frontmatter = parts.length >= 3 ? parts[1] : '';
  const body = parts.length >= 3 ? parts.slice(2).join('---').trim() : raw.trim();
  return {
    name,
    title: readBlockParam(frontmatter, 'title'),
    subtitle: readParam(frontmatter, 'subtitle'),
    widget: readParam(frontmatter, 'widget'),
    weight: Number(readParam(frontmatter, 'weight') || 0),
    cssClass: readParam(frontmatter, 'css_class'),
    heroMedia: readParam(frontmatter, 'hero_media'),
    backgroundImage: readParam(frontmatter, 'image'),
    imageDarken: Number(readParam(frontmatter, 'image_darken') || 0),
    body,
  };
}

async function loadSection(file) {
  try {
    const raw = await readFile(join(homeDir, file), 'utf8');
    return parseFile(raw, file);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    const section = parseFile(fallbackContent[file] || '', file);
    return { ...section, isFallback: true };
  }
}

function renderMarkdown(markdown) {
  const text = markdown.replace(
    /\{\{%\s*cta\s+cta_link="([^"]+)"\s+cta_text="([^"]+)"\s*%\}\}/g,
    (_, href, label) => `<a class="cta-button" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`,
  );

  const lines = text.split('\n');
  const output = [];
  let list = [];
  let paragraph = [];

  function flushList() {
    if (list.length) {
      output.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`);
      list = [];
    }
  }

  function flushParagraph() {
    if (paragraph.length) {
      output.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    if (trimmed.startsWith('<') || trimmed.startsWith('{{')) {
      flushParagraph();
      flushList();
      output.push(line);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushParagraph();
      flushList();
      output.push(`<h3>${inlineMarkdown(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith('- ')) {
      flushParagraph();
      list.push(trimmed.slice(2));
      continue;
    }
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return output.join('\n');
}

function renderSection(section) {
  const body = renderMarkdown(section.body);
  if (section.widget === 'hero') {
    const heroMedia = section.heroMedia
      ? `<img src="/media/${escapeHtml(section.heroMedia)}" alt="">`
      : `
        <div class="hero-placeholder" aria-hidden="true">
          <div class="hero-orbit hero-orbit-a"></div>
          <div class="hero-orbit hero-orbit-b"></div>
          <div class="hero-panel">
            <strong>Local preview</strong>
            <span>Starter content loaded successfully.</span>
          </div>
        </div>`;
    return `
      <section class="hero ${escapeHtml(section.cssClass)}">
        <div class="hero-copy">
          <p class="eyebrow">Yu Lab Genomics</p>
          <h1>${inlineMarkdown(section.title).replaceAll('\n', '<br>')}</h1>
          <div class="hero-body">${body}</div>
        </div>
        <div class="hero-media">
          ${heroMedia}
        </div>
      </section>`;
  }

  if (section.backgroundImage) {
    const background = section.imageDarken > 0
      ? `linear-gradient(rgba(12, 20, 32, ${section.imageDarken}), rgba(12, 20, 32, ${section.imageDarken})), url('/media/${escapeHtml(section.backgroundImage)}')`
      : `url('/media/${escapeHtml(section.backgroundImage)}')`;
    return `
      <section class="banner ${escapeHtml(section.cssClass)}" style="background-image: ${background}"></section>`;
  }

  return `
    <section class="section ${escapeHtml(section.cssClass)}">
      ${section.title ? `<div class="section-heading"><h2>${inlineMarkdown(section.title)}</h2>${section.subtitle ? `<p>${inlineMarkdown(section.subtitle)}</p>` : ''}</div>` : ''}
      <div class="section-body">${body}</div>
    </section>`;
}

function pageTemplate(sections) {
  const fallbackSections = sections.filter((section) => section.isFallback);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Yu Lab Home</title>
  <link rel="stylesheet" href="/assets/home-preview.css">
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/">Yu Lab</a>
    <nav>
      <a href="/research/">Research</a>
      <a href="/publication/">Publications</a>
      <a href="/people/">People</a>
    </nav>
  </header>
  <main>
    ${fallbackSections.length ? `<section class="notice">Using bundled starter content for: ${fallbackSections.map((section) => escapeHtml(section.name)).join(', ')}</section>` : ''}
    ${sections.map(renderSection).join('\n')}
  </main>
</body>
</html>`;
}

const css = `
:root {
  color-scheme: light;
  --ink: #17202a;
  --muted: #5f6f7c;
  --line: #dfe7eb;
  --accent: #116b74;
  --accent-strong: #0a4f58;
  --bg: #f6f8f7;
  --panel: #ffffff;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  color: var(--ink);
  background: var(--bg);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.58;
}
a { color: inherit; }
.site-header {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  padding: 0 5vw;
  background: rgba(255, 255, 255, .94);
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(12px);
}
.notice {
  width: min(1180px, 90vw);
  margin: 22px auto 0;
  padding: 12px 16px;
  border: 1px solid #c7ddd6;
  border-radius: 8px;
  background: #edf7f3;
  color: #245e54;
  font-size: 14px;
}
.brand {
  font-weight: 760;
  text-decoration: none;
  color: var(--accent-strong);
}
nav {
  display: flex;
  gap: 22px;
  color: var(--muted);
  font-size: 14px;
}
nav a { text-decoration: none; }
.banner {
  min-height: 360px;
  background-position: center;
  background-size: cover;
}
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.02fr) minmax(320px, .98fr);
  gap: clamp(28px, 4vw, 64px);
  align-items: center;
  width: min(1180px, 90vw);
  margin: 0 auto;
  padding: clamp(52px, 8vw, 96px) 0;
}
.eyebrow {
  margin: 0 0 12px;
  color: var(--accent);
  font-size: 13px;
  font-weight: 760;
  letter-spacing: 0;
  text-transform: uppercase;
}
h1 {
  margin: 0 0 22px;
  font-size: clamp(40px, 5vw, 68px);
  line-height: 1.04;
  letter-spacing: 0;
}
h2 {
  margin: 0;
  font-size: 30px;
  line-height: 1.2;
  letter-spacing: 0;
}
h3 {
  margin: 24px 0 10px;
  font-size: 17px;
  line-height: 1.3;
  letter-spacing: 0;
}
p { margin: 0 0 16px; }
ul {
  margin: 8px 0 22px;
  padding-left: 20px;
}
.hero-body {
  color: #30414c;
  font-size: 17px;
}
.hero-media {
  overflow: visible;
  border-radius: 8px;
  /* box-shadow: 0 24px 60px rgba(23, 32, 42, .16); */
}
.hero-media img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: auto;
  object-fit: contain;
}
.hero-placeholder {
  position: relative;
  min-height: 380px;
  border-radius: 28px;
  background:
    radial-gradient(circle at 20% 20%, rgba(17, 107, 116, .16), transparent 34%),
    radial-gradient(circle at 80% 28%, rgba(10, 79, 88, .20), transparent 28%),
    linear-gradient(145deg, #f7fbfa, #dfeee9);
  border: 1px solid #d3e3de;
}
.hero-orbit {
  position: absolute;
  border-radius: 999px;
  border: 1px solid rgba(17, 107, 116, .25);
}
.hero-orbit-a {
  inset: 36px 52px auto 52px;
  height: 180px;
}
.hero-orbit-b {
  inset: auto 72px 32px 72px;
  height: 140px;
}
.hero-panel {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  gap: 6px;
  min-width: 220px;
  padding: 18px 20px;
  border-radius: 18px;
  background: rgba(255, 255, 255, .88);
  border: 1px solid rgba(17, 107, 116, .16);
  box-shadow: 0 20px 40px rgba(23, 32, 42, .08);
  transform: translate(-50%, -50%);
}
.hero-panel strong {
  color: var(--accent-strong);
  font-size: 18px;
}
.hero-panel span {
  color: var(--muted);
  font-size: 14px;
}
.section {
  width: min(1180px, 90vw);
  margin: 0 auto;
  padding: 64px 0;
  border-top: 1px solid var(--line);
}
.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 28px;
}
.section-heading p {
  max-width: 420px;
  margin: 0;
  color: var(--muted);
}
.research-grid,
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}
.research-card,
.metric-card {
  min-height: 100%;
  padding: 24px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
}
.research-card img {
  width: 46px;
  height: 46px;
  object-fit: contain;
  margin-bottom: 18px;
}
.research-card h3,
.metric-value {
  margin: 0 0 12px;
  color: var(--accent-strong);
  font-weight: 760;
}
.research-card p,
.metric-label {
  color: var(--muted);
  margin: 0;
}
.research-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}
.research-tags span {
  padding: 4px 9px;
  border-radius: 999px;
  background: #e6f0ed;
  color: #245e54;
  font-size: 12px;
}
.metric-value { font-size: 22px; line-height: 1.2; }
.cta-button {
  display: inline-flex;
  align-items: center;
  min-height: 42px;
  margin-top: 10px;
  padding: 0 16px;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font-weight: 700;
  text-decoration: none;
}
@media (max-width: 820px) {
  .site-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
    padding: 14px 5vw;
  }
  nav { gap: 14px; flex-wrap: wrap; }
  .banner { min-height: 360px; }
  .hero {
    grid-template-columns: 1fr;
    padding: 42px 0;
  }
  .section { padding: 44px 0; }
  .section-heading { display: block; }
  .section-heading p { margin-top: 10px; }
  .research-grid,
  .metric-grid {
    grid-template-columns: 1fr;
  }
}
`;

async function renderHome() {
  const sections = [];
  for (const file of files) {
    sections.push(await loadSection(file));
  }
  sections.sort((a, b) => a.weight - b.weight);
  return pageTemplate(sections);
}

function serveStatic(request, response) {
  const url = new URL(request.url, 'http://localhost');
  const path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  if (path === '/assets/home-preview.css') {
    response.writeHead(200, { 'content-type': mime['.css'] });
    response.end(css);
    return true;
  }
  if (!path.startsWith('/media/')) return false;

  const filePath = join(staticDir, path);
  const stream = createReadStream(filePath);
  stream.on('open', () => {
    response.writeHead(200, { 'content-type': mime[extname(filePath)] || 'application/octet-stream' });
    stream.pipe(response);
  });
  stream.on('error', () => {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  });
  return true;
}

async function handler(request, response) {
  try {
    if (serveStatic(request, response)) return;
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname !== '/') {
      response.writeHead(302, { location: '/' });
      response.end();
      return;
    }
    const html = await renderHome();
    response.writeHead(200, { 'content-type': mime['.html'] });
    response.end(html);
  } catch (error) {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(error.stack || String(error));
  }
}

async function listen(port) {
  return new Promise((resolve, reject) => {
    const server = createServer(handler);
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

for (let port = 1313; port <= 1320; port += 1) {
  try {
    await listen(port);
    console.log(`Yu Lab home preview running at http://127.0.0.1:${port}/`);
    break;
  } catch (error) {
    if (error.code !== 'EADDRINUSE' || port === 1320) throw error;
  }
}
