# Cinderworks — a three.js tactical FPS

**Competition:** Make the best three.js tactical FPS (threejs-fps-02) — $1,000 prize pool.
**Owner:** naninu123 · **Referral:** [3zvqxnwh](https://make.fun/r/3zvqxnwh)

## What it is

A round-based tactical first-person shooter in the Counter-Strike style, built
entirely from original art, map, sounds and names. Two teams — Amber (you plus
four bots) against Cobalt (five bots) — fight over Cinderworks Yard, a 46 × 34 m
industrial yard with two bomb sites, three lanes and a mid conveyor hall.
First team to 5 round wins takes the match.

- **Rounds:** 15 s buy phase, 100 s live round, bomb plant (35 s fuse) and
  defuse, elimination wins, credits earned per round and per kill.
- **Gunplay:** hitscan weapons with headshot multipliers, recoil, bloom and
  spread that punishes firing on the move; acceleration, crouch and jump with
  axis-separated collision against the map.
- **Tactics:** 4 weapons (sidearm, rifle, PDW, DMR) plus frag grenades in a
  buy menu; bots follow waypoint routes, hold positions, react to sight and
  sound, plant the charge and defuse it.
- **HUD:** health, ammunition, round timer, round score, credits, team alive
  counts, kill feed, bomb status and buy menu.
- **Sound:** all effects synthesized with WebAudio — no audio files, no network.

## Run

```sh
node serve.ts
# open http://localhost:8080
```

Controls: WASD move, mouse look, click fire, R reload, G grenade, B buy menu,
E defuse, 1–4 weapons, Ctrl crouch, Space jump.

## Layout

- `main.ts` — hands the game in (copies `game/` + `screenshots/`, writes `dossier.json`)
- `game/index.html` — import map for three.js 0.187.0, HUD DOM
- `game/src/main.js` — boot, fixed-step loop, shooting, grenades, defuse
- `game/src/world.js` — the Cinderworks Yard map and bot waypoint graph
- `game/src/bots.js` — bot brains: routes, sight, hearing, planting, defusing
- `game/src/rounds.js` — round state machine, credits, bomb
- `game/src/weapons.js` — weapon table and view models
- `game/src/player.js` — movement and health
- `game/src/audio.js` — synthesized WebAudio effects
- `game/src/hud.js` — DOM HUD
- `game/src/input.js` — keyboard, mouse, pointer lock
- `game/src/palette.js` — the colour plan
- `vendor/makefun-threejs.ts` — the kit's dossier library, unchanged
