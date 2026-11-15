// Weapons: three buyable guns plus a frag grenade, all hitscan except the grenade.
// Each weapon owns its numbers — damage, head multiplier, fire rate, spread,
// recoil, magazine, price — so the buy menu and the HUD read the same table.
// Spread grows with movement speed and with sustained fire; stopping to aim pays.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  sidearm: {
    id: 'sidearm', name: 'P6 Sidearm', price: 0, mag: 12, reserve: 48,
    damage: 26, headMult: 2.0, gap: 0.16, reload: 1.3,
    spreadStill: 0.003, spreadMove: 0.02, kick: 0.006, auto: false,
  },
  rifle: {
    id: 'rifle', name: 'VK-9 Rifle', price: 900, mag: 30, reserve: 90,
    damage: 34, headMult: 2.2, gap: 0.096, reload: 1.9,
    spreadStill: 0.0022, spreadMove: 0.028, kick: 0.009, auto: true,
  },
  pdw: {
    id: 'pdw', name: 'Kestrel PDW', price: 650, mag: 32, reserve: 96,
    damage: 24, headMult: 2.0, gap: 0.07, reload: 1.6,
    spreadStill: 0.004, spreadMove: 0.022, kick: 0.006, auto: true,
  },
  marksman: {
    id: 'marksman', name: 'Longbow DMR', price: 1400, mag: 8, reserve: 32,
    damage: 72, headMult: 2.5, gap: 0.85, reload: 2.4,
    spreadStill: 0.0008, spreadMove: 0.05, kick: 0.02, auto: false,
  },
};

export const GRENADE = { price: 250, maxCarry: 2, damage: 90, radius: 5.5, fuse: 1.1 };

export function createWeapon(camera, weaponId) {
  const def = WEAPONS[weaponId] || WEAPONS.rifle;
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.45, metalness: 0.2 });

  const model = new THREE.Group();
  const long = def.id === 'marksman';
  // Dark steel body so the view model reads as a gun, not a pale plank.
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, long ? 0.5 : 0.36), grip);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, long ? 0.45 : 0.32), grip);
  barrel.position.set(0, 0.02, long ? -0.42 : -0.32);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.18), grip);
  stock.position.set(0, -0.015, 0.26);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.04, 0.06), accent);
  sight.position.set(0, 0.06, -0.08);
  model.add(receiver, barrel, stock, sight);
  model.position.set(0.22, -0.22, -0.38);
  model.scale.setScalar(0.8);
  camera.add(model);

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.18, -0.95);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  const state = {
    id: def.id, mag: def.mag, reserve: def.reserve, cooldown: 0,
    reloadLeft: 0, flash: 0, kick: 0, bloom: 0, grenades: 1,
  };

  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.bloom = Math.max(0, state.bloom - dt * 0.09);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    model.position.z = -0.42 + state.kick;
    model.rotation.x = state.kick * 2.2;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (def.reload - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const take = Math.min(def.mag - state.mag, state.reserve);
        state.mag += take;
        state.reserve -= take;
      }
    }
  }

  return {
    def, state,
    step,
    ready() { return state.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0; },
    pullTrigger() {
      state.cooldown = def.gap;
      state.flash = 0.06;
      state.kick = 0.055;
      state.bloom = Math.min(0.05, state.bloom + 0.006);
    },
    takeRound() {
      if (state.mag <= 0) return false;
      state.mag -= 1;
      return true;
    },
    reload() {
      if (state.reloadLeft > 0 || state.mag === def.mag || state.reserve === 0) return;
      state.reloadLeft = def.reload;
    },
    spread(speed) {
      const moving = Math.min(1, speed / 5.2);
      return def.spreadStill + moving * def.spreadMove + state.bloom;
    },
    refill() {
      state.mag = def.mag;
      state.reserve = def.reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
      state.bloom = 0;
    },
    dispose() {
      camera.remove(model, flash, flashLight);
    },
  };
}
