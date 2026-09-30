# Introduction

NOVAADMIN is a multi-purpose, **Persian-first** admin dashboard template built with HTML5, SCSS, ES2022 modules and Vite. Every page is a standalone HTML file; there is no JavaScript framework such as React/Vue involved and you need no backend.

> Tip: this template is not a "quick prototype"; it is a complete design system with tokens, light/dark/system themes, six colour themes, first-class RTL and LTR, a Jalali calendar and 206 ready-made pages.

## What's in the box?

- **6 layouts** — default sidebar, mini, collapsed, horizontal, two-column and boxed
- **10 specialised dashboards** — analytics, e-commerce, CRM, SaaS, finance, projects, HR, support, AI and logistics
- **AI workspace** — chat, writer, summarizer, content repurposer, prompt library, image studio, scheduler, usage, models and API keys
- **Enterprise modules** — users and roles, store, CRM, projects and tasks, kanban, calendar, email, chat, files, tickets, CMS and finance
- **23 documentation topics** (this section), error pages, marketing pages, a UI Kit and **200+ usable pages**
- **Simulated data layer** — `src/services/*` follows the same REST contract, so connecting a real API means changing a single file

## Who is it for?

| Audience | Use |
| --- | --- |
| Product teams | Launch an internal panel fast with a professional look and Persian support |
| Front-end developers | A ready design system, documented components and a modular structure |
| Agencies | Fast client delivery with a custom theme and fa/en/ar languages |
| Back-end developers | A finished front end that only needs to be wired to your API |

## Architecture at a glance

```text
index.html            product page
src/pages/**          206 generated pages (shell + content)
src/partials/**       shared fragments (head, header, footer, popups, messages)
src/scss/**           tokens, themes, components and layout layers
src/js/core/**        core: theme, layout, data table, charts, calendar, kanban…
src/js/pages/**       one controller per area (dashboards, modules, AI, apps…)
src/services/**       data layer (REST simulation with realistic latency)
src/data/**           realistic sample data
src/locales/**        Persian, English and Arabic dictionaries
tools/**              build, asset generation, quality control and packaging tools
docs/**               Markdown source of this documentation
```

> Goal: every file should have one responsibility. If changing one behaviour forces you to edit two places, you have broken the structure.

## Suggested reading path

1. [Installation](installation.html) — run the project in two minutes
2. [Folder structure](folder-structure.html) — where everything lives
3. [Configuration](configuration.html) — brand name, colour, language, currency and calendar
4. [Theme customization](theme-customization.html) and [RTL and LTR](rtl-ltr.html)
5. [Adding a new page](adding-pages.html) and [API integration](api-integration.html)

## License

You may use this template in your own projects; reselling or publicly redistributing the source files without written permission is not allowed. Details are in `LICENSE.txt` and on the [Credits](credits.html) page.
