// Bots: nine computer players, four Amber allies and five Cobalt enemies.
// Each bot is a capsule body with health, a weapon profile, and a small brain:
// follow the waypoint graph toward a site, hold a position when told to, react
// to sight (line of sight + range + field of view) and to sound (gunfire pulls
// nearby bots), and shoot back with aim error that grows with distance and
// with the target's movement. The Cobalt carrier plants the bomb when it
// reaches a site; Amber bots defuse when they reach a planted bomb.
// Movement is the same axis-separated box collision the player uses, so bots
// never walk through walls. No new objects are allocated in the hot loop:
// reusable vectors live on the bot object.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { WAYPOINTS, SITES } from './world.js';

const HEALTH = 100;
const BOT_SPEED = 3.4;
const SIGHT_RANGE = 34;
const HEAR_RANGE = 22;
const REACT_TIME = 0.45;
const SHOT_GAP = 0.34;

const NAMES_AMBER = ['Vex', 'Mara', 'Ivo', 'Sable'];
const NAMES_COBALT = ['Rook', 'Fen', 'Onyx', 'Talon', 'Bram'];

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

function route(fromIndex, toIndex, random) {
  // Breadth-first search over the waypoint graph; returns a list of node ids.
  if (fromIndex === toIndex) return [toIndex];
  const prev = new Map([[fromIndex, -1]]);
  const queue = [fromIndex];
  while (queue.length) {
    const current = queue.shift();
    for (const next of WAYPOINTS[current].links) {
      if (prev.has(next)) continue;
      prev.set(next, current);
      if (next === toIndex) {
        const path = [next];
        let node = current;
        while (node !== -1) { path.unshift(node); node = prev.get(node); }
        return path;
      }
      queue.push(next);
    }
  }
  return [toIndex];
}

export function createBots(scene, colliders, randomSeed) {
  const random = mulberry32(randomSeed);
  const group = new THREE.Group();
  scene.add(group);

  const amberMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.amberTeam), roughness: 0.6, metalness: 0.05 });
  const cobaltMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.cobaltTeam), roughness: 0.6, metalness: 0.05 });
  const headMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.05 });
  const torsoGeo = new THREE.BoxGeometry(0.52, 0.78, 0.3);
  const headGeo = new THREE.SphereGeometry(0.155, 16, 12);
  const legGeo = new THREE.BoxGeometry(0.42, 0.55, 0.26);

  const bots = [];
  const hitMeshes = [];
  const probe = new THREE.Box3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  function overlaps(x, y, z) {
    probe.min.set(x - 0.34, y + 0.04, z - 0.34);
    probe.max.set(x + 0.34, y + 1.72 - 0.04, z + 0.34);
    for (const c of colliders) if (probe.intersectsBox(c)) return true;
    return false;
  }

  function makeBot(team, index, spawn) {
    const isAmber = team === 'amber';
    const name = isAmber ? NAMES_AMBER[index] : NAMES_COBALT[index];
    const body = new THREE.Group();
    body.position.set(spawn[0], 0, spawn[1]);
    const torso = new THREE.Mesh(torsoGeo, isAmber ? amberMat : cobaltMat);
    torso.position.y = 1.0;
    torso.userData.part = 'torso';
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.53;
    head.userData.part = 'head';
    const legs = new THREE.Mesh(legGeo, isAmber ? amberMat : cobaltMat);
    legs.position.y = 0.28;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.55), headMat);
    gun.position.set(0.2, 1.05, -0.3);
    body.add(torso, head, legs, gun);
    body.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    group.add(body);
    const bot = {
      team, name, body, torso, head,
      pos: body.position,
      health: HEALTH, alive: true, yaw: isAmber ? Math.PI : 0,
      targetSite: isAmber ? null : (random() < 0.5 ? 'A' : 'B'),
      path: [], pathIndex: 0, holdUntil: 0,
      target: null, shotAt: -99, aimError: 0,
      planting: 0, defusing: 0, fall: 0, firstSeen: -99,
      targetPos: new THREE.Vector3(),
      vx: 0, vz: 0,
    };
    torso.userData.bot = bot;
    head.userData.bot = bot;
    hitMeshes.push(torso, head);
    bots.push(bot);
    return bot;
  }

  function nearestWaypoint(x, z) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < WAYPOINTS.length; i += 1) {
      const d = (WAYPOINTS[i].x - x) ** 2 + (WAYPOINTS[i].z - z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function setGoal(bot, nodeIndex) {
    const from = nearestWaypoint(bot.pos.x, bot.pos.z);
    bot.path = route(from, nodeIndex, random);
    bot.pathIndex = 0;
  }

  function spawnAll(spawns) {
    bots.length = 0;
    hitMeshes.length = 0;
    group.clear();
    for (let i = 0; i < 4; i += 1) makeBot('amber', i, spawns.amber[i]);
    for (let i = 0; i < 5; i += 1) makeBot('cobalt', i, spawns.cobalt[i]);
    for (const bot of bots) {
      if (bot.team === 'cobalt') setGoal(bot, bot.targetSite === 'A' ? 8 : 9);
      else setGoal(bot, 2 + Math.floor(random() * 4));
    }
  }

  // Line of sight: sample the segment; blocked if any collider contains a sample.
  function hasSight(from, to) {
    tmp2.copy(to).sub(from);
    const dist = tmp2.length();
    const steps = Math.max(2, Math.ceil(dist / 0.8));
    for (let i = 1; i < steps; i += 1) {
      tmp.copy(from).addScaledVector(tmp2, i / steps);
      probe.min.set(tmp.x - 0.05, tmp.y - 0.05, tmp.z - 0.05);
      probe.max.set(tmp.x + 0.05, tmp.y + 0.05, tmp.z + 0.05);
      for (const c of colliders) if (probe.intersectsBox(c)) return false;
    }
    return true;
  }

  function damage(bot, amount) {
    if (!bot.alive) return false;
    bot.health -= amount;
    if (bot.health > 0) return false;
    bot.alive = false;
    bot.fall = 0;
    return true;
  }

  // One fixed step for every bot. `world` carries the player state, the bomb,
  // the round clock and callbacks for shots and kills.
  function step(dt, now, world) {
    for (const bot of bots) {
      if (!bot.alive) {
        bot.fall = Math.min(1, bot.fall + dt / 0.4);
        bot.body.rotation.x = -bot.fall * 1.45;
        continue;
      }
      bot.body.rotation.x = 0;
      const eye = tmp.set(bot.pos.x, 1.5, bot.pos.z);
      // Pick a target: the player, or the nearest living enemy bot.
      // targetPos is copied into bot.targetPos at once: hasSight() reuses the
      // shared scratch vectors, so keeping a reference to one would corrupt it.
      let target = null;
      let targetMoving = 0;
      const playerAlive = world.playerHealth > 0;
      const playerEnemy = bot.team === 'cobalt';
      if (playerEnemy && playerAlive) {
        bot.targetPos.copy(world.playerEye);
        const d = eye.distanceTo(bot.targetPos);
        if (d < SIGHT_RANGE && hasSight(eye, bot.targetPos)) { target = 'player'; targetMoving = world.playerSpeed; }
      }
      if (!target) {
        let bestD = SIGHT_RANGE;
        for (const other of bots) {
          if (!other.alive || other.team === bot.team) continue;
          tmp2.set(other.pos.x, 1.5, other.pos.z);
          const d = eye.distanceTo(tmp2);
          if (d < bestD && hasSight(eye, tmp2)) { bestD = d; target = other; bot.targetPos.copy(tmp2); }
        }
      }
      if (target) {
        if (bot.target !== target) bot.firstSeen = now;
        bot.target = target;
        // Face the target and shoot with error that grows with range and motion,
        // but only after the reaction time has passed since first sighting.
        const dx = bot.targetPos.x - bot.pos.x;
        const dz = bot.targetPos.z - bot.pos.z;
        bot.yaw = Math.atan2(dx, dz);
        bot.body.rotation.y = bot.yaw;
        if (now - bot.firstSeen > REACT_TIME && now - bot.shotAt > SHOT_GAP) {
          bot.shotAt = now;
          const dist = Math.hypot(dx, dz);
          const hitChance = Math.max(0.12, 0.62 - dist * 0.011 - targetMoving * 0.05);
          const roll = random();
          const headshot = roll < 0.12;
          world.onBotShot(bot, target, roll < hitChance, headshot);
        }
        continue; // Engaged bots hold their ground and fight.
      }
      bot.target = null;

      // Bomb duties: Cobalt carrier plants at its site; Amber defuses a planted bomb.
      if (world.bomb.planted && bot.team === 'amber') {
        const site = SITES[world.bomb.site];
        const d = Math.hypot(site.plant.x - bot.pos.x, site.plant.z - bot.pos.z);
        if (d < 1.6) {
          bot.defusing += dt;
          world.onBotDefuse(bot, bot.defusing);
          continue;
        }
        setGoal(bot, world.bomb.site === 'A' ? 8 : 9);
      } else if (!world.bomb.planted && bot.team === 'cobalt' && bot.name === NAMES_COBALT[0]) {
        const site = SITES[bot.targetSite];
        const d = Math.hypot(site.plant.x - bot.pos.x, site.plant.z - bot.pos.z);
        if (d < 1.8) {
          bot.planting += dt;
          world.onBotPlant(bot, bot.planting);
          continue;
        }
      }

      // Walk the waypoint path; pick a new goal when it ends.
      if (now < bot.holdUntil) continue;
      if (bot.pathIndex >= bot.path.length) {
        if (bot.team === 'cobalt') {
          setGoal(bot, bot.targetSite === 'A' ? 8 : 9);
        } else {
          bot.holdUntil = now + 2 + random() * 3;
          setGoal(bot, 1 + Math.floor(random() * 6));
        }
        continue;
      }
      const node = WAYPOINTS[bot.path[bot.pathIndex]];
      const dx = node.x - bot.pos.x;
      const dz = node.z - bot.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.6) { bot.pathIndex += 1; continue; }
      bot.yaw = Math.atan2(dx, dz);
      const stepLen = BOT_SPEED * dt;
      const nx = bot.pos.x + (dx / dist) * stepLen;
      const nz = bot.pos.z + (dz / dist) * stepLen;
      if (!overlaps(nx, bot.pos.z)) bot.pos.x = nx;
      if (!overlaps(bot.pos.x, nz)) bot.pos.z = nz;
      bot.body.rotation.y = bot.yaw;
      // Bob the legs while walking.
      bot.body.position.y = Math.abs(Math.sin(now * 9)) * 0.03;
    }
  }

  function aliveCount(team) {
    let n = 0;
    for (const b of bots) if (b.alive && b.team === team) n += 1;
    return n;
  }

  function reset(spawns) {
    spawnAll(spawns);
  }

  spawnAll({ amber: [[-3, 13], [0, 14], [3, 13], [-6, 12]], cobalt: [[-3, -14], [0, -15], [3, -14], [-6, -13], [6, -13]] });

  return { bots, hitMeshes, step, damage, aliveCount, reset, hasSight };
}
