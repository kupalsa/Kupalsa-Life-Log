# Life Log

A personal record of the things that matter — not a habit tracker. Log a moment when something
worth remembering happens, write down what you made each month, and mark the chapters of your
life as versions (v5 → v6 → v7). Over time it shows real progress.

- **Timeline** — one-line moments with an area (Relationships, Trading, Work…), an optional note,
  and a ★ for turning points. Grouped by version and month; "On this day" brings back past years.
- **Money** — one number per month. Missing months are gaps, not zeros. Chart, year table,
  year-over-year and version comparisons.
- **Versions** — named chapters with a start date and a one-line "who I am now". Compares moments,
  turning points and average monthly income across versions.

## How it works

Same setup as the trading dashboard:

- **Hosting**: a static Vite + React site, deployed to GitHub Pages by `.github/workflows/deploy.yml`
  on every push to `main`. This code repo can be public — it never contains your data.
- **Data**: one JSON file, `data/life-log.json`, in a **separate private repo**, read and written
  through the GitHub API with a fine-grained token you paste into Settings. Every save is a commit,
  so the repo history is a full backup.
- **Before connecting** GitHub, entries are kept in the browser. Settings offers to move them into
  the repo once it's connected.

## One-time setup

1. Create an empty **private** repo, e.g. `Life-Log-Data`.
2. Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new) with access
   to only that repo and **Contents: Read and write**.
3. Open the site → Settings → enter username, repo and token → Test → Save.

Repeat step 3 once on each device (e.g. your phone — add the site to the home screen).

## Local development

```bash
npm install
npm run dev     # http://localhost:5174
npm test
```
