# Anchor Day Bonus Spin

Internal web app for `Anchor Day加菜賽`.

## App Type

This project now runs as a small Node.js app:

- `index.html`
- `styles.css`
- `script.js`
- `server.js`
- `admin.html`
- `admin.js`

No frontend build step is required.

## Deploy Notes

This app is suitable for Vibebox because:

- it uses Node.js 22
- it serves static files and API from the same app
- it connects to Vibebox PostgreSQL using injected DB credentials

## Expected Entry

- App root: current folder
- Runtime: `Node.js 22`
- Build command: `npm install`
- Start command: `npm start`
- Port: `3000`

## Current Behavior

- player enters a name that Xinyi can recognize
- each player has 10 shared spins tracked in PostgreSQL
- leaderboard is shared across all users
- tie-break rule: if scores are the same, the earlier finisher ranks first
- admin page: `/admin.html`

## Required Environment Variables

Add these in Vibebox using `DB credential`:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
