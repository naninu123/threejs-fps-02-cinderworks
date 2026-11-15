// Cinderworks Yard: an original 46 x 34 m industrial yard, built from boxes.
// Amber team spawns south, Cobalt team spawns north. Two bomb sites — Site A in
// the west furnace hall, Site B in the east container row — joined by three lanes:
// west alley, mid conveyor hall, east alley. Every box is a collider for players
// and bots and a surface a bullet stops on. Plain geometry only, no models,
// no textures, no network.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

// Waypoint graph the bots walk: nodes with x/z and the ids they connect to.
// Lanes: south spawn -> mid hall -> sites; west and east alleys flank it.
export const WAYPOINTS = [
  { x: 0, z: 13, links: [1, 2, 3] }, // 0 amber spawn
  { x: -14, z: 8, links: [0, 4, 6] }, // 1 west alley south
  { x: 0, z: 7, links: [0, 4, 5, 6] }, // 2 mid hall south
  { x: 14, z: 8, links: [0, 5, 6] }, // 3 east alley south
  { x: -16, z: -2, links: [1, 2, 7, 8] }, // 4 site A approach
  { x: 16, z: -2, links: [2, 3, 7, 9] }, // 5 site B approach
  { x: 0, z: -1, links: [1, 2, 3, 4, 5, 7] }, // 6 mid crossroads
  { x: 0, z: -11, links: [4, 5, 6, 8, 9] }, // 7 north hall
  { x: -17, z: -9, links: [4, 7] }, // 8 site A plant spot
  { x: 17, z: -9, links: [5, 7] }, // 9 site B plant spot
  { x: 0, z: -14, links: [7, 8, 9] }, // 10 cobalt spawn
];

export const SITES = {
  A: { center: new THREE.Vector3(-17, 0, -9), radius: 4.2, plant: new THREE.Vector3(-17, 0, -9) },
  B: { center: new THREE.Vector3(17, 0, -9), radius: 4.2, plant: new THREE.Vector3(17, 0, -9) },
};

export const SPAWNS = {
  amber: [
    [-3, 13], [0, 14], [3, 13], [-6, 12], [6, 12],
  ],
  cobalt: [
    [-3, -14], [0, -15], [3, -14], [-6, -13], [6, -13],
  ],
};

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'accent' || name === 'ink' ? 0.55 : 0.92,
      metalness: name === 'surface' ? 0.25 : 0.03,
    });
  }
  const siteAMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.amberTeam), roughness: 0.6, metalness: 0.1 });
  const siteBMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.tealTeam), roughness: 0.6, metalness: 0.1 });

  const colliders = [];
  const shootables = [];

  function box(width, height, depth, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }

  // Ground and perimeter: 46 x 34 m, 5 m walls, open to a dusk sky.
  box(46.4, 0.4, 34.4, 0, -0.2, 0, materials.canvas);
  box(0.4, 5, 34.4, -23.2, 2.5, 0, materials.surface);
  box(0.4, 5, 34.4, 23.2, 2.5, 0, materials.surface);
  box(46.4, 5, 0.4, 0, 2.5, -17.2, materials.surface);
  box(46.4, 5, 0.4, 0, 2.5, 17.2, materials.surface);

  // Site markers: flat painted pads on the ground at each bomb site.
  const padA = new THREE.Mesh(new THREE.BoxGeometry(6, 0.06, 6), siteAMat);
  padA.position.set(-17, 0.03, -9);
  padA.receiveShadow = true;
  group.add(padA);
  const padB = new THREE.Mesh(new THREE.BoxGeometry(6, 0.06, 6), siteBMat);
  padB.position.set(17, 0.03, -9);
  padB.receiveShadow = true;
  group.add(padB);

  // Furnace hall (Site A, west): tall stack, furnace block, pipe run.
  box(2.2, 7.5, 2.2, -20.5, 3.75, -12, materials.hairline);
  box(5, 2.6, 3, -19, 1.3, -9, materials.surface);
  box(8, 0.5, 1, -15, 3.4, -12.5, materials.hairline);
  box(1.4, 1.1, 1.4, -13.5, 0.55, -6, materials.hairline);
  box(1.4, 1.1, 1.4, -19.5, 0.55, -5, materials.hairline);
  box(3.4, 1.1, 1.2, -17, 0.55, -2.5, materials.hairline);

  // Container row (Site B, east): stacked shipping containers, own colours.
  box(6, 2.4, 2.4, 19, 1.2, -11, materials.amberTeam);
  box(6, 2.4, 2.4, 19, 3.6, -11, materials.tealTeam);
  box(4, 2.4, 2.4, 14.5, 1.2, -13.5, materials.surface);
  box(1.4, 1.1, 1.4, 13.5, 0.55, -6, materials.hairline);
  box(1.4, 1.1, 1.4, 20.5, 0.55, -5, materials.hairline);

  // Mid conveyor hall: the long central structure, crates on both sides.
  box(2, 3.4, 14, 0, 1.7, 0, materials.surface);
  box(10, 0.8, 1.6, 0, 3.8, 0, materials.hairline);
  box(1.6, 0.9, 1.6, -5.5, 0.45, 4, materials.hairline);
  box(1.6, 0.9, 1.6, 5.5, 0.45, 4, materials.hairline);
  box(1.6, 0.9, 1.6, -5.5, 0.45, -6, materials.hairline);
  box(1.6, 0.9, 1.6, 5.5, 0.45, -6, materials.hairline);

  // West and east alley cover: crates and low walls that split the flanks.
  box(1.2, 1.1, 3.6, -10, 0.55, 6, materials.hairline);
  box(3.6, 1.1, 1.2, -10, 0.55, 0, materials.hairline);
  box(1.2, 1.1, 3.6, 10, 0.55, 6, materials.hairline);
  box(3.6, 1.1, 1.2, 10, 0.55, 0, materials.hairline);
  box(1.2, 2.6, 1.2, -10, 1.3, -11, materials.hairline);
  box(1.2, 2.6, 1.2, 10, 1.3, -11, materials.hairline);

  // Spawn cover: low barriers behind each spawn so rounds open with a sightline choice.
  box(2.4, 0.9, 1.2, -4, 0.45, 10.5, materials.hairline);
  box(2.4, 0.9, 1.2, 4, 0.45, 10.5, materials.hairline);
  box(2.4, 0.9, 1.2, -4, 0.45, -12.5, materials.hairline);
  box(2.4, 0.9, 1.2, 4, 0.45, -12.5, materials.hairline);

  // Lighting: low amber sun from the west, cool dusk fill, warm hemisphere.
  // Bright enough that the yard reads at a glance in a screenshot.
  const sky = new THREE.HemisphereLight(new THREE.Color(PALETTE.ink), new THREE.Color(PALETTE.canvas), 2.2);
  scene.add(sky);
  const key = new THREE.DirectionalLight(new THREE.Color(PALETTE.accent), 3.2);
  key.position.set(-18, 16, 10);
  key.target.position.set(0, 0, -4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -28;
  key.shadow.camera.right = 28;
  key.shadow.camera.top = 24;
  key.shadow.camera.bottom = -24;
  key.shadow.camera.far = 70;
  key.shadow.bias = -0.0006;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(new THREE.Color(PALETTE.tealTeam), 0.9);
  fill.position.set(14, 10, -12);
  scene.add(fill);
  const ambient = new THREE.AmbientLight(new THREE.Color(PALETTE.ink), 0.9);
  scene.add(ambient);

  return { colliders, shootables, group };
}
