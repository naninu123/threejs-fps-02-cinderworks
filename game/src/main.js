// Cinderworks boot and the one loop: a fixed 60 Hz simulation feeding a
// render at the display's rate. main.js owns the wiring only — the round
// machine lives in rounds.js, the bots in bots.js, the map in world.js.
// ?shot=start|play|buy|end with &seed=N sets up a deterministic frame for a
// capture, renders it twice, then freezes it and sets window.__shotReady.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld, SPAWNS, SITES } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeapon, WEAPONS, GRENADE } from './weapons.js';
import { createBots } from './bots.js';
import { createRounds, PLANT_SECONDS, DEFUSE_SECONDS } from './rounds.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.canvas), 26, 70);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 160);
scene.add(camera);

const world = createWorld(scene);
const audio = createAudio();
const hud = createHud();
const rounds = createRounds();
const player = createPlayer(world.colliders, [SPAWNS.amber[0][0], SPAWNS.amber[0][1], Math.PI]);
const input = createInput(renderer.domElement, onLockChange);
const bots = createBots(scene, world.colliders, seed);
const raycaster = new THREE.Raycaster();
raycaster.far = 90;

let weapon = createWeapon(camera, 'rifle');
const owned = new Set(['sidearm', 'rifle']);
const body = player.state;
const markerHoldMs = shot ? 4000 : 90;
let elapsed = 0;
let frozen = false;
let started = false;
let accumulator = 0;
let lastTime = performance.now();
let defuseProgress = 0;
let grenades = [];
let tracers = [];

// Grenade visuals: one shared geometry/material, meshes reused per throw.
const grenadeGeo = new THREE.SphereGeometry(0.09, 10, 8);
const grenadeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ember), roughness: 0.4, metalness: 0.4 });
const tracerMat = new THREE.LineBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9 });

function addTracer(from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const line = new THREE.Line(geo, tracerMat.clone());
  scene.add(line);
  tracers.push({ line, life: 0.08 });
}

function throwGrenade() {
  if (weapon.state.grenades <= 0) return;
  weapon.state.grenades -= 1;
  const mesh = new THREE.Mesh(grenadeGeo, grenadeMat);
  mesh.castShadow = true;
  camera.getWorldDirection(direction);
  mesh.position.copy(camera.position).addScaledVector(direction, 0.5);
  scene.add(mesh);
  const vel = direction.clone().multiplyScalar(16);
  vel.y += 3.5;
  grenades.push({ mesh, vel, fuse: GRENADE.fuse });
  audio.shot();
}

const direction = new THREE.Vector3();
const shootables = () => world.shootables.concat(bots.hitMeshes);

function syncHud() {
  const r = rounds.state;
  hud.setAmmo(weapon.state.mag, weapon.state.reserve, weapon.def.name);
  hud.setHealth(body.health);
  hud.setScore(r.score.amber, r.score.cobalt);
  hud.setCredits(r.credits);
  hud.setAlive(bots.aliveCount('amber') + (body.alive ? 1 : 0), bots.aliveCount('cobalt'));
  hud.setRound(r.round);
  hud.setGrenades(weapon.state.grenades);
  if (r.bomb.planted) {
    hud.setTimer(r.bomb.timer, 'bomb');
    hud.setBomb(`CHARGE PLANTED — SITE ${r.bomb.site} — DEFUSE!`);
  } else {
    hud.setTimer(r.phaseLeft, r.phase);
    hud.setBomb(r.phase === 'buy' ? 'BUY PHASE — press B to shop' : `SITE A · SITE B — first to ${5}`);
  }
}

function switchWeapon(id) {
  if (!owned.has(id) || weapon.def.id === id) return;
  weapon.dispose();
  weapon = createWeapon(camera, id);
  syncHud();
}

function buy(id) {
  const r = rounds.state;
  if (r.phase !== 'buy') { hud.banner('Shop is closed — buy phase only'); return; }
  if (id === 'grenade') {
    if (weapon.state.grenades >= GRENADE.maxCarry) return;
    if (!rounds.spend(GRENADE.price)) { hud.banner('Not enough credits'); return; }
    weapon.state.grenades += 1;
    audio.buy();
    syncHud();
    return;
  }
  const def = WEAPONS[id];
  if (!def) return;
  if (owned.has(id)) { switchWeapon(id); return; }
  if (!rounds.spend(def.price)) { hud.banner('Not enough credits'); return; }
  owned.add(id);
  switchWeapon(id);
  audio.buy();
  hud.banner(`${def.name} bought`);
}

hud.onBuy(buy);
hud.onPlay(() => {
  if (shot) return;
  audio.unlock();
  if (rounds.state.matchOver) {
    rounds.resetMatch();
    resetRound();
    hud.hideOverlay();
    input.requestLock();
    return;
  }
  input.requestLock();
});

function resetRound() {
  player.respawn();
  bots.reset(SPAWNS);
  weapon.refill();
  weapon.state.grenades = 1;
  grenades.forEach((g) => scene.remove(g.mesh));
  grenades = [];
  tracers.forEach((t) => scene.remove(t.line));
  tracers = [];
  defuseProgress = 0;
  syncHud();
}

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    hud.hideOverlay();
    hud.showBuy(false);
  } else if (!rounds.state.matchOver) {
    hud.showOverlay(body.alive ? 'paused' : 'dead');
  }
}

function syncCamera() {
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
}

function aimAt(point) {
  const dx = point.x - body.position.x;
  const dy = point.y - (body.position.y + body.eye);
  const dz = point.z - body.position.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  body.yaw = Math.atan2(-dx, -dz);
  body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / length)));
  syncCamera();
}

function shoot(spread) {
  if (!weapon.takeRound()) { audio.dryFire(); return false; }
  camera.getWorldDirection(direction);
  direction.x += (random() * 2 - 1) * spread;
  direction.y += (random() * 2 - 1) * spread;
  direction.z += (random() * 2 - 1) * spread;
  direction.normalize();
  scene.updateMatrixWorld(true);
  raycaster.set(camera.position, direction);
  const hit = raycaster.intersectObjects(shootables(), false)[0];
  const end = hit ? hit.point : camera.position.clone().addScaledVector(direction, 40);
  addTracer(camera.position.clone().addScaledVector(direction, 0.6), end);
  audio.shot();
  if (hit && hit.object.userData.bot) {
    const bot = hit.object.userData.bot;
    const head = hit.object.userData.part === 'head';
    const amount = Math.round(weapon.def.damage * (head ? weapon.def.headMult : 1));
    const killed = bots.damage(bot, amount);
    hud.hitMarker(killed, markerHoldMs);
    if (killed) {
      rounds.state.kills += 1;
      rounds.addKillCredits();
      audio.kill();
      hud.killfeed(`You ▸ ${bot.name} ${head ? '(headshot)' : ''}`);
    } else audio.hit();
  }
  weapon.pullTrigger();
  player.recoil(weapon.def.kick + random() * 0.004, (random() * 2 - 1) * 0.004);
  syncHud();
  return true;
}

function explode(grenade) {
  scene.remove(grenade.mesh);
  audio.explosion();
  const pos = grenade.mesh.position;
  const flash = new THREE.PointLight(new THREE.Color(PALETTE.ember), 60, 14);
  flash.position.copy(pos);
  scene.add(flash);
  setTimeout(() => scene.remove(flash), 180);
  // Damage falls off with distance; walls are ignored for simplicity of the blast.
  for (const bot of bots.bots) {
    if (!bot.alive) continue;
    const d = bot.pos.distanceTo(pos);
    if (d < GRENADE.radius) bots.damage(bot, Math.round(GRENADE.damage * (1 - d / GRENADE.radius)));
  }
  if (body.alive) {
    const d = Math.hypot(body.position.x - pos.x, body.position.z - pos.z);
    if (d < GRENADE.radius) {
      const died = player.damage(Math.round(GRENADE.damage * 0.6 * (1 - d / GRENADE.radius)));
      if (died) hud.killfeed('You were caught by a grenade');
    }
  }
  syncHud();
}

// Callbacks the bots invoke: a bot shooting, planting, or defusing.
// playerEye is one reused vector, refreshed each fixed step, so the bots'
// line-of-sight checks allocate nothing in the hot loop.
const playerEyeVec = new THREE.Vector3();
const botWorld = {
  get playerHealth() { return body.health; },
  get playerSpeed() { return player.groundSpeed(); },
  get playerEye() { return playerEyeVec; },
  get bomb() { return rounds.state.bomb; },
  onBotShot(bot, target, hit, headshot) {
    audio.distantShot();
    if (!hit) return;
    const damage = headshot ? 32 : 16;
    if (target === 'player') {
      const died = player.damage(damage);
      if (died) hud.killfeed(`${bot.name} ▸ You ${headshot ? '(headshot)' : ''}`);
      syncHud();
    } else if (target && target.alive) {
      const killed = bots.damage(target, damage);
      if (killed) hud.killfeed(`${bot.name} ▸ ${target.name}`);
    }
  },
  onBotPlant(bot, progress) {
    if (rounds.state.bomb.planted || rounds.state.phase !== 'live') return;
    if (progress >= PLANT_SECONDS) {
      rounds.plantBomb(bot.targetSite);
      rounds.addPlantCredits();
      audio.plantBeep();
      hud.banner(`Charge planted at Site ${bot.targetSite} — defuse it!`, 3500);
      hud.killfeed(`${bot.name} planted the charge`);
    }
  },
  onBotDefuse(bot, progress) {
    if (!rounds.state.bomb.planted) return;
    if (progress >= DEFUSE_SECONDS) {
      rounds.endRound('amber', `${bot.name} defused the charge.`);
    }
  },
};

function step(dt) {
  elapsed += dt;
  const r = rounds.state;
  const prevPhase = r.phase;
  rounds.step(dt);

  // Phase transitions: buy -> live resets the round; over -> buy resets too.
  if (prevPhase !== r.phase) {
    if (r.phase === 'live' && prevPhase === 'buy') {
      resetRound();
      hud.banner(`Round ${r.round} — go!`);
      hud.showBuy(false);
    } else if (r.phase === 'buy') {
      resetRound();
      hud.showBuy(true);
    } else if (r.phase === 'over') {
      const result = r.lastResult;
      if (result) {
        hud.banner(result.winner === 'amber' ? `AMBER TAKES ROUND ${result.round}` : `COBALT TAKES ROUND ${result.round}`, 3500);
        hud.killfeed(result.reason);
        if (result.winner === 'amber') audio.roundWin(); else audio.roundLose();
      }
      if (r.matchOver) {
        hud.showOverlay('match', `${r.matchWinner === 'amber' ? 'Amber' : 'Cobalt'} wins the match ${r.score.amber}–${r.score.cobalt}.`);
        if (document.pointerLockElement) document.exitPointerLock();
      }
    }
  }

  if (r.phase === 'live' && body.alive) player.step(dt, input.state.keys);
  if (r.phase === 'live') weapon.step(dt);
  playerEyeVec.set(body.position.x, body.position.y + body.eye, body.position.z);
  if (r.phase !== 'over') bots.step(dt, elapsed, botWorld);

  // Grenades fly and blow.
  for (let i = grenades.length - 1; i >= 0; i -= 1) {
    const g = grenades[i];
    g.fuse -= dt;
    g.vel.y -= 14 * dt;
    g.mesh.position.addScaledVector(g.vel, dt);
    if (g.mesh.position.y < 0.09) { g.mesh.position.y = 0.09; g.vel.y *= -0.35; g.vel.x *= 0.7; g.vel.z *= 0.7; }
    if (g.fuse <= 0) { explode(g); grenades.splice(i, 1); }
  }
  for (let i = tracers.length - 1; i >= 0; i -= 1) {
    const t = tracers[i];
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / 0.08) * 0.9;
    if (t.life <= 0) { scene.remove(t.line); tracers.splice(i, 1); }
  }

  // Player defuse: hold E near a planted bomb.
  if (r.bomb.planted && body.alive && r.phase === 'live') {
    const site = SITES[r.bomb.site];
    const d = Math.hypot(site.plant.x - body.position.x, site.plant.z - body.position.z);
    if (d < 2.2 && input.state.keys.has('KeyE')) {
      defuseProgress += dt;
      hud.setBomb(`DEFUSING… ${Math.ceil(DEFUSE_SECONDS - defuseProgress)}s — hold E`);
      if (defuseProgress >= DEFUSE_SECONDS) {
        rounds.endRound('amber', 'You defused the charge.');
        defuseProgress = 0;
      }
    } else defuseProgress = 0;
  }

  // Elimination wins, unless the bomb is planted — then the defuse decides.
  if (r.phase === 'live' && !r.bomb.planted) {
    const amberAlive = bots.aliveCount('amber') + (body.alive ? 1 : 0);
    if (bots.aliveCount('cobalt') === 0) rounds.endRound('amber', 'Cobalt team eliminated.');
    else if (amberAlive === 0) rounds.endRound('cobalt', 'Amber team eliminated.');
  }
  if (r.phase === 'live' && r.bomb.planted && bots.aliveCount('amber') + (body.alive ? 1 : 0) === 0) {
    rounds.endRound('cobalt', 'Amber team eliminated — the charge will blow.');
  }
  syncHud();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    if (body.alive) player.look(look.x, look.y);
    const pressed = input.takePressed();
    if (pressed.has('KeyR')) weapon.reload();
    if (pressed.has('KeyG')) throwGrenade();
    if (pressed.has('KeyB') && rounds.state.phase === 'buy') hud.showBuy(true);
    if (pressed.has('Digit1')) switchWeapon('sidearm');
    if (pressed.has('Digit2')) switchWeapon('rifle');
    if (pressed.has('Digit3')) switchWeapon('pdw');
    if (pressed.has('Digit4')) switchWeapon('marksman');
    if (input.state.firing && weapon.ready() && body.alive && rounds.state.phase === 'live') {
      shoot(shot ? 0 : weapon.spread(player.groundSpeed()));
    }
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
  }
  renderer.render(scene, camera);
}

function settle(steps) {
  for (let index = 0; index < steps; index += 1) step(FIXED_STEP);
}

function botByName(name) {
  return bots.bots.find((b) => b.name === name);
}

function runShot(name) {
  hud.hideOverlay();
  hud.showBuy(false);
  body.pitch = 0;
  if (name === 'start') {
    body.position.set(0, 0, 14.5);
    body.yaw = Math.PI;
    settle(10);
    aimAt(new THREE.Vector3(0, 1.6, -8));
    hud.showOverlay('start');
  } else if (name === 'buy') {
    rounds.state.phase = 'buy';
    rounds.state.phaseLeft = 12;
    body.position.set(0, 0, 12);
    body.yaw = Math.PI;
    settle(5);
    aimAt(new THREE.Vector3(-6, 1.4, 0));
    hud.showBuy(true);
  } else if (name === 'play') {
    rounds.state.phase = 'live';
    rounds.state.phaseLeft = 82;
    rounds.state.round = 2;
    rounds.state.score.amber = 1;
    rounds.state.score.cobalt = 1;
    // Advance the bots into the yard so the frame shows a live fight.
    body.position.set(-4, 0, 10);
    body.yaw = Math.PI + 0.15;
    settle(60);
    const target = botByName('Rook') || bots.bots[4];
    if (target && target.alive) {
      aimAt(new THREE.Vector3(target.pos.x, 1.1, target.pos.z));
      shoot(0);
      settle(6);
      aimAt(new THREE.Vector3(target.pos.x, 1.1, target.pos.z));
      shoot(0);
    }
    hud.killfeed('You ▸ Rook');
    hud.setTimer(82, 'live');
  } else if (name === 'end') {
    rounds.state.phase = 'over';
    rounds.state.phaseLeft = 3;
    rounds.state.round = 3;
    rounds.state.score.amber = 2;
    rounds.state.score.cobalt = 1;
    rounds.state.lastResult = { winner: 'amber', reason: 'Cobalt team eliminated.', round: 3 };
    body.position.set(6, 0, 6);
    body.yaw = Math.PI - 0.6;
    settle(30);
    aimAt(new THREE.Vector3(-10, 1.5, -9));
    hud.banner('AMBER TAKES ROUND 3', 4000);
    hud.killfeed('Cobalt team eliminated.');
  }
  syncHud();
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

syncCamera();
syncHud();
if (shot) runShot(shot);
else requestAnimationFrame(frame);
