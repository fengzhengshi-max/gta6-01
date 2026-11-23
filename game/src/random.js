// A small seeded random number generator (mulberry32): the same seed gives the
// same city, traffic and pedestrians, which is what makes the screenshot scenes
// repeatable and the game fair to re-run.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random number in [min, max). */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** Random integer in [min, max] inclusive. */
export function int(random, min, max) {
  return Math.floor(range(random, min, max + 1));
}

/** One random element of an array. */
export function pick(random, array) {
  return array[Math.floor(random() * array.length)];
}

/** Fisher-Yates shuffle of a copy. */
export function shuffle(random, array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
