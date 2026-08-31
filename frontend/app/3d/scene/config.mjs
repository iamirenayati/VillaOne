// @ts-check

/** @typedef {"arrival" | "architecture" | "canopy" | "water"} ViewpointId */
/** @typedef {{ id: ViewpointId; label: string; description: string; position: [number, number, number]; target: [number, number, number] }} Viewpoint */
/** @typedef {{ tier: "mobile" | "desktop"; dpr: [number, number]; trees: number; rocks: number; shadows: boolean; shadowMapSize: number }} QualityProfile */

/** @type {readonly Viewpoint[]} */
export const VIEWPOINTS = Object.freeze([
  Object.freeze({ id: "arrival", label: "ورود", description: "نمای اصلی", position: [11.8, 7.1, 14.2], target: [0, 1.4, 0] }),
  Object.freeze({ id: "architecture", label: "معماری", description: "تراس و نور", position: [8.1, 4.7, 8.4], target: [0.3, 1.6, -0.2] }),
  Object.freeze({ id: "canopy", label: "سایه‌سار", description: "جنگل از بالا", position: [-8.8, 11.5, 12.4], target: [0, 0.8, 0] }),
  Object.freeze({ id: "water", label: "آب", description: "انعکاس آرام", position: [-10.6, 4.2, 7.7], target: [-0.8, 0.6, 1.3] }),
]);

/** @param {string} id */
export function getViewpoint(id) {
  return VIEWPOINTS.find((view) => view.id === id) ?? VIEWPOINTS[0];
}

/**
 * @param {{ width: number; coarsePointer: boolean; reducedMotion: boolean }} input
 * @returns {QualityProfile}
 */
export function selectQualityProfile(input) {
  const mobile = input.width < 760 || input.coarsePointer;
  return mobile
    ? { tier: "mobile", dpr: /** @type {[number, number]} */ ([1, 1.2]), trees: 34, rocks: 16, shadows: false, shadowMapSize: 512 }
    : { tier: "desktop", dpr: /** @type {[number, number]} */ ([1, 1.6]), trees: 68, rocks: 28, shadows: true, shadowMapSize: 1024 };
}
