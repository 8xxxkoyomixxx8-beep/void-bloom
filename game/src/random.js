// A tiny seeded random number generator (mulberry32). The world draws all its chance from one of
// these, so a screenshot scene or a test run with the same seed always plays out the same way.

/** Make a generator from a 32-bit seed: each call returns the next float in [0, 1). */
export function makeRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max) from a generator. */
export function range(next, min, max) {
  return min + next() * (max - min);
}

/** An integer in [min, max] (both ends included) from a generator. */
export function intRange(next, min, max) {
  return min + Math.floor(next() * (max - min + 1));
}

/** One element of a non-empty array, chosen by a generator. */
export function pick(next, items) {
  return items[Math.floor(next() * items.length)];
}
