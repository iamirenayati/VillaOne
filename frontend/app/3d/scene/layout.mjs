// @ts-check

/** @typedef {{ x: number; z: number; scale: number; height: number; rotation: number }} TreeLayout */
/** @typedef {{ x: number; z: number; scale: number; rotation: number }} RockLayout */

const REVEAL_ANGLE = 0.84;
const REVEAL_HALF_WIDTH = 0.42;

function seeded(index, salt) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function angularDistance(first, second) {
  return Math.abs(Math.atan2(Math.sin(first - second), Math.cos(first - second)));
}

/**
 * Keep the forest dense while preserving a composed sightline from the two
 * principal camera views to the villa. Trees that land inside that corridor
 * are deterministically folded toward its edges instead of being discarded.
 * @param {number} count
 * @returns {TreeLayout[]}
 */
export function createTreeLayout(count) {
  return Array.from({ length: count }, (_, index) => {
    const rawAngle = seeded(index, 1) * Math.PI * 2;
    const angle = angularDistance(rawAngle, REVEAL_ANGLE) < REVEAL_HALF_WIDTH
      ? REVEAL_ANGLE + (index % 2 === 0 ? -1 : 1) * (0.5 + seeded(index, 6) * 0.12)
      : rawAngle;
    const radius = 7 + seeded(index, 2) * 7.2;

    return {
      x: Math.cos(angle) * radius * 1.05,
      z: Math.sin(angle) * radius * 0.82,
      scale: 0.72 + seeded(index, 3) * 0.72,
      height: 3.2 + seeded(index, 4) * 3.8,
      rotation: seeded(index, 5) * Math.PI,
    };
  });
}

/** @param {number} count @returns {RockLayout[]} */
export function createRockLayout(count) {
  return Array.from({ length: count }, (_, index) => {
    const angle = seeded(index, 8) * Math.PI * 2;
    const radius = 5.8 + seeded(index, 9) * 7.7;
    return {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius * 0.82,
      scale: 0.28 + seeded(index, 10) * 0.58,
      rotation: seeded(index, 11) * Math.PI,
    };
  });
}
