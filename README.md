# Growing Stars — Solarpunk Farming Web Demo

A small, browser-based prototype for a cozy solarpunk sci‑fi, Stardew‑like game. The goal is to quickly iterate on core 2D systems (movement, animation, backgrounds, eventually farming and interactions) with minimal tooling: plain HTML5 Canvas + vanilla JS.

## What We're Building

- Player movement and animation using a directional sprite sheet.
- A layered map approach: a base terrain image under the character; props and tall objects will become separate sprites later for Z‑sorting.
- A simple, extensible codebase where we can add collision, camera, interaction, inventory, crops, and a day/night loop.

## Current Status

- Loads and animates the player from `assets/sprites/walk.png`.
- Draws a map background under the character:
  - Prefers `assets/maps/home_barren.png` (pathless/barren map).
  - Falls back to `assets/maps/home.png` if barren is missing.
  - If neither is available, renders a procedural barren pattern.
- Toggle backgrounds at runtime with the `B` key.

## Repo Layout

- `index.html` — Single‑file Canvas demo with input, animation loop, and background rendering.
- `assets/sprites/walk.png` — Player walk sheet (9 columns × 4 rows). Row order: Up (W), Left (A), Down (S), Right (D).
- `assets/maps/home.png` — Original tilemap background.
- `assets/maps/home_barren.png` — Optional barren/pathless background (use this for prototyping until we add props/Z‑sorting).

## Run Locally

- Open `index.html` directly in a modern browser.
- No build/tools required.

Tip: If your browser blocks local file image loading, serve the folder via a lightweight server (e.g., `python3 -m http.server 8000`) and visit `http://localhost:8000/`.

## Controls

- Movement: `W/A/S/D` or Arrow Keys
- Test facing: `1/2/3/4` (Up/Left/Down/Right)
- Background toggle: `B` (switch between barren/original when available)

## Sprite Sheet Format (Player)

- File: `assets/sprites/walk.png`
- Grid: 9 columns × 4 rows
- Row mapping (0‑based):
  - Row 0 → Up (W)
  - Row 1 → Left (A)
  - Row 2 → Down (S)
  - Row 3 → Right (D)
- Idle: frame 0 of the current row.

## Next Steps (Roadmap)

- Add a camera that follows the player and clamps to map bounds.
- Introduce a collision layer and simple AABB collisions.
- Separate props/buildings into individual sprites and implement Y‑sort (Z‑ordering by `y`).
- Basic interaction system (e.g., `E` to interact) and a simple dialogue box.
- Farming v1: till → plant → water → grow → harvest (placeholder crops and timers).
- Save/load via `localStorage`.

## Keeping This README Updated

We’ll update this document as features land. If you add or rename assets, change control mappings, or expand systems (camera, collisions, farming), please reflect those changes here so the demo remains easy to understand and run.

---

Questions or a feature you want next? Open an issue or drop a note, and we’ll prioritize it in the roadmap above.

