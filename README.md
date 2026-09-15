# Life Log

A personal record of the things that matter — not a habit tracker. Log a moment when something
worth remembering happens, attach a photo if you have one, write down what you made each month,
and over the years the site shows you your real progress.

## Pages

- **Now** — log a moment in one line. Compares you today with a year ago (version, climbing
  grade, monthly income, turning points), shows your ladders, what you're working on, and
  "on this day" from past years.
- **Story** — a vertical, photo-first timeline. The latest moment is at the top, the first thing
  ever logged at the bottom; round arrows between entries show how much time passed. Version
  releases appear as chapter cards. **List** mode is the compact, searchable view.
- **Calendar** — a month grid (days with photos show them as tiles) and a year overview.
- **Ladders** — levels you climb over years: bouldering grades (V0–V17) out of the box, or any
  skill with levels. Log the first time you reach each level; see how long each step took and
  when the next one lands at your pace.
- **Money** — one number per month. Missing months are gaps, not zeros.
- **Versions** — chapters of you, released like software (1.0, 2.0…): a codename and release notes
  (New / Improved / Fixed / Removed / Known issues). Known issues carry into the next release as a
  checklist, and a diff table compares every version.

## How it works

Same setup as the trading dashboard:

- **Hosting**: a static Vite + React site, deployed to GitHub Pages by `.github/workflows/deploy.yml`
  on every push to `main`. This code repo is public — it never contains your data.
- **Data**: `data/life-log.json` in a **separate private repo**, read and written through the GitHub
  API with a fine-grained token you paste into Settings. Photos are compressed to JPEG in the browser
  and stored as separate files (`photos/YYYY/<id>.jpg`) in the same private repo. Every save is a
  commit, so the repo history is a full backup.
- **Before connecting** GitHub, entries stay in the browser (photos in IndexedDB). Settings offers to
  move everything into the repo once it's connected.

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
