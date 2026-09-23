/**
 * NOVAADMIN — documentation generator
 * ------------------------------------------------------------------
 * The 23 documentation topics are authored once, in Markdown, under `docs/`.
 * This tool renders them into the template's own markup so the pages inherit
 * the design system (typography, callouts, code blocks, tables, TOC …) and
 * writes the result to `src/partials/docs/<slug>.html`, which
 * `tools/build-pages.mjs` then drops into the docs shell.
 *
 * The package builder copies the same Markdown files into `documentation/`,
 * so the customer gets both: browsable pages **and** plain text.
 *
 *   npm run gen:docs
 *
 * Supported syntax: headings (#, ##, ###), paragraphs, bullet/numbered lists,
 * fenced code blocks, inline code, **bold**, *italic*, links, images, tables,
 * blockquotes (rendered as callouts) and horizontal rules.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = path.join(ROOT, 'docs');
const OUTPUT_DIR = path.join(ROOT, 'src/partials/docs');

/* ---------------------------------------------------------------- inline ---- */

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Documentation pages live in `docs/`, so sibling links resolve there. */
const DOC_SLUGS = new Set(
  fs
    .readdirSync(path.join(ROOT, 'docs'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => `${name.replace(/\.md$/, '')}.html`),
);

/**
 * Links in markdown are written relative to the documentation folder, which is
 * also where the rendered pages live:
 *   `forms.html`        → `{{ROOT}}docs/forms.html`   (sibling topic)
 *   `../preview.html`   → `{{ROOT}}preview.html`      (a real page of the template)
 */
function href(target) {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) return target;
  const [pathname, hash = ''] = target.split(/(?=#)/);
  const clean = pathname.replace(/^\.\//, '');
  if (DOC_SLUGS.has(clean)) return `{{ROOT}}docs/${clean}${hash}`;
  if (clean.startsWith('../')) {
    return `{{ROOT}}${path.posix.normalize(path.posix.join('docs', clean))}${hash}`;
  }
  return `{{ROOT}}${clean}${hash}`;
}

function inline(text) {
  let out = escapeHtml(text);
  // inline code first so its content is not transformed again
  const code = [];
  out = out.replace(/`([^`]+)`/g, (_, value) => {
    code.push(value);
    return `\u0000${code.length - 1}\u0000`;
  });
  out = out
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `<img src="${href(src)}" alt="${alt}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, target) => `<a href="${href(target)}">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
  // restore inline code (escaping its content)
  out = out.replace(/\u0000(\d+)\u0000/g, (_, index) => `<code>${escapeHtml(code[Number(index)])}</code>`);
  return out;
}

/* ----------------------------------------------------------------- block ---- */

function renderTable(rows) {
  const [head, , ...body] = rows;
  const cells = (line) =>
    line
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((cell) => cell.trim());
  return `<div class="table-responsive"><table class="table table--striped docs-table">
    <thead><tr>${cells(head).map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead>
    <tbody>${body.map((row) => `<tr>${cells(row).map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

function renderList(items, ordered) {
  const tag = ordered ? 'ol' : 'ul';
  const modifier = tag === 'ol' ? ' docs-list--ordered' : '';
  return `<${tag} class="docs-list${modifier}">${items.map((item) => `<li>${inline(item)}</li>`).join('')}</${tag}>`;
}

/** Converts one Markdown file into a docs article body. */
export function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let title = '';
  let lead = '';
  let leadTaken = false;
  let buffer = [];

  const flushParagraph = () => {
    if (!buffer.length) return;
    const text = buffer.join(' ').trim();
    buffer = [];
    if (!text) return;
    if (title && !leadTaken) {
      // the first paragraph after the H1 becomes the lead
      lead = text;
      leadTaken = true;
      return;
    }
    blocks.push(`<p>${inline(text)}</p>`);
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    // fenced code
    if (/^```/.test(line)) {
      flushParagraph();
      const language = line.slice(3).trim();
      const body = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      blocks.push(
        `<div class="code-block"${language ? ` data-language="${language}"` : ''}><pre class="code-block__pre"><code>${escapeHtml(body.join('\n'))}</code></pre></div>`,
      );
      continue;
    }

    // headings
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level === 1) {
        title = text;
        continue;
      }
      const tag = `h${level}`;
      blocks.push(`<${tag}>${inline(text)}</${tag}>`);
      continue;
    }

    // table
    if (/^\|/.test(line) && /^\|[\s:|-]+\|$/.test(lines[index + 1] ?? '')) {
      flushParagraph();
      const rows = [];
      while (index < lines.length && /^\|/.test(lines[index])) {
        rows.push(lines[index]);
        index += 1;
      }
      index -= 1;
      blocks.push(renderTable(rows));
      continue;
    }

    // lists
    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph();
      const items = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ''));
        index += 1;
      }
      index -= 1;
      blocks.push(renderList(items, false));
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph();
      const items = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ''));
        index += 1;
      }
      index -= 1;
      blocks.push(renderList(items, true));
      continue;
    }

    // blockquote → callout
    if (/^>\s?/.test(line)) {
      flushParagraph();
      const body = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        body.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      index -= 1;
      const text = body.join(' ');
      const tone = /هشدار|Warning|تحذير/i.test(text) ? 'warning' : /نکته|هدف|Tip|ملاحظة/i.test(text) ? 'info' : 'success';
      const icon = tone === 'warning' ? 'exclamation-triangle' : tone === 'info' ? 'info-circle' : 'check2-circle';
      const [strong, ...rest] = text.split(/\.\s/);
      blocks.push(
        `<div class="callout callout--${tone}"><i class="bi bi-${icon}"></i><div><strong>${inline(strong.replace(/\.$/, ''))}</strong>${
          rest.length ? `<p class="mb-0">${inline(rest.join('. '))}</p>` : ''
        }</div></div>`,
      );
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushParagraph();
      blocks.push('<hr>');
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    buffer.push(line.trim());
  }
  flushParagraph();

  return `<article class="docs-article">
  <header class="docs-article__head">
    <h1>${inline(title || 'Documentation')}</h1>
    ${lead ? `<p class="docs-lead">${inline(lead)}</p>` : ''}
  </header>
${blocks.join('\n')}
</article>`;
}

/* ------------------------------------------------------------------ main ---- */

export function buildDocs() {
  if (!fs.existsSync(SOURCE_DIR)) return { written: 0, files: [] };
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const sources = fs.readdirSync(SOURCE_DIR).filter((name) => name.endsWith('.md'));
  const files = [];

  for (const name of sources.sort()) {
    if (name.toLowerCase() === 'readme.md') continue;
    const markdown = fs.readFileSync(path.join(SOURCE_DIR, name), 'utf8');
    const target = path.join(OUTPUT_DIR, name.replace(/\.md$/, '.html'));
    fs.writeFileSync(target, `${renderMarkdown(markdown)}\n`, 'utf8');
    files.push(name);
  }

  // keep the generated folder tidy: docs pages are 1:1 with markdown sources
  const slugs = new Set(sources.map((name) => name.replace(/\.md$/, '.html')));
  for (const existing of fs.readdirSync(OUTPUT_DIR)) {
    if (!slugs.has(existing)) fs.rmSync(path.join(OUTPUT_DIR, existing));
  }

  return { written: files.length, files };
}

if (process.argv[1] && process.argv[1].endsWith('gen-docs.mjs')) {
  const { written, files } = buildDocs();
  console.log(`✔ docs rendered → src/partials/docs/ (${written} topics)`);
  files.forEach((name) => console.log(`    · ${name}`));
}
