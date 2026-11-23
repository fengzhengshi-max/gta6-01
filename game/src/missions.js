// The story: five missions for Mara, the fixer at The Flamingo bar, taking the
// player from a new arrival in Neon Palms to the big score at Sunset Bank.
// A mission is a list of stages; each stage has an objective line, a target
// (a place, a car, or a count) and a check the game runs every step.
import { MONEY } from './config.js';
import { createThugs } from './entities.js';

export const MISSION_COUNT = 5;

/**
 * Mission definitions. `target` is resolved against the city at start:
 *   { place: 'bar' }          a landmark door spot
 *   { place: 'bank', radius } a landmark with an arrival radius
 *   { anyCar: true }          any car the player drives
 *   { thugs: 3 }              thugs spawned at a place
 */
export const MISSIONS = [
  {
    id: 1,
    title: 'Fresh Off the Bus',
    briefing: "Mara: 'New face. You want work, you walk to The Flamingo and ask for me. Don't keep me waiting.'",
    stages: [
      { text: 'Walk to The Flamingo bar and talk to Mara (E)', target: { place: 'bar', radius: 46, interact: true } },
    ],
  },
  {
    id: 2,
    title: 'Borrowed Wheels',
    briefing: "Mara: 'A client needs a ride across town. Borrow a car — any car — and bring it to the Palm Court Hotel.'",
    stages: [
      { text: 'Steal a car (walk up to one and press E)', target: { anyCar: true } },
      { text: 'Drive the car to the Palm Court Hotel', target: { place: 'hotel', radius: 90, inCar: true } },
    ],
  },
  {
    id: 3,
    title: 'The Pickup',
    briefing: "Mara: 'A package is waiting at Warehouse 9. Pick it up on foot, then drive it back to the bar. Quietly.'",
    stages: [
      { text: 'Drive to Warehouse 9', target: { place: 'warehouse', radius: 110, inCar: true } },
      { text: 'Get out and collect the package (E)', target: { place: 'warehouse', radius: 60, onFoot: true, interact: true } },
      { text: 'Deliver the package to The Flamingo', target: { place: 'bar', radius: 90 } },
    ],
  },
  {
    id: 4,
    title: 'Loud Neighbours',
    briefing: "Mara: 'A crew from the docks is shaking down my bar. Go to the pier, teach them manners, and don't get caught.'",
    stages: [
      { text: 'Go to Neon Pier', target: { place: 'pier', radius: 130 } },
      { text: 'Deal with the dock crew (3)', target: { thugs: 3, place: 'pier' } },
      { text: 'Lose the heat and get back to the bar', target: { place: 'bar', radius: 90, quiet: true } },
    ],
  },
  {
    id: 5,
    title: 'The Big Score',
    briefing: "Mara: 'Sunset Bank. One guard, one vault, one clean getaway. Take the cash to the safehouse and we're rich.'",
    stages: [
      { text: 'Drive to Sunset Bank', target: { place: 'bank', radius: 110, inCar: true } },
      { text: 'Get out and grab the cash (E)', target: { place: 'bank', radius: 60, onFoot: true, interact: true } },
      { text: 'Escape to the Coral Court safehouse', target: { place: 'safehouse', radius: 100 } },
    ],
  },
];

export function createMissions() {
  return {
    index: 0, // 0-based mission; MISSION_COUNT means the story is done
    stage: 0,
    done: false,
    banner: null, // { text, timer } shown after a stage or mission completes
    interactReady: false, // an E prompt is showing for the current stage
    thugsSpawned: false,
    completedCount: 0,
  };
}

export function currentMission(missions) {
  return missions.index < MISSION_COUNT ? MISSIONS[missions.index] : null;
}

export function currentStage(missions) {
  const mission = currentMission(missions);
  return mission ? mission.stages[missions.stage] : null;
}

export function objectiveText(missions) {
  const mission = currentMission(missions);
  if (!mission) return 'Story complete — Neon Palms is yours. Free roam.';
  const stage = mission.stages[missions.stage];
  return `${mission.id}. ${mission.title} — ${stage.text}`;
}

/** Where the current stage points, in world coordinates, or null. */
export function stageTarget(missions, city) {
  const stage = currentStage(missions);
  if (!stage || !stage.target) return null;
  if (stage.target.place) {
    const place = city.landmarks[stage.target.place];
    return place ? { x: place.x, y: place.y, radius: stage.target.radius ?? 80 } : null;
  }
  return null;
}

/** Advance one stage; on the last stage, finish the mission and pay out. */
export function advanceStage(missions, game) {
  const mission = currentMission(missions);
  if (!mission) return;
  missions.stage += 1;
  if (missions.stage >= mission.stages.length) {
    const reward = MONEY.missionReward[missions.index] ?? 500;
    game.money += reward;
    missions.completedCount += 1;
    missions.index += 1;
    missions.stage = 0;
    missions.thugsSpawned = false;
    if (missions.index >= MISSION_COUNT) {
      missions.done = true;
      missions.banner = { text: `STORY COMPLETE — The Big Score paid $${reward}. Neon Palms is yours.`, timer: 6 };
    } else {
      const next = MISSIONS[missions.index];
      missions.banner = { text: `Mission complete: ${mission.title}  +$${reward} — Next: ${next.title}`, timer: 5 };
    }
    game.events.push('mission-complete');
  } else {
    missions.banner = { text: 'Objective updated', timer: 2.5 };
  }
}

/**
 * Check the current stage against the game. Returns true when the stage just
 * advanced. `interact` is true the step the player pressed E.
 */
export function updateMissions(missions, game, interact) {
  const stage = currentStage(missions);
  if (!stage) return false;
  const target = stage.target;
  const player = game.player;
  missions.interactReady = false;

  if (target.place) {
    const place = game.city.landmarks[target.place];
    if (!place) return false;
    const dist = Math.hypot(player.x - place.x, player.y - place.y);
    if (target.interact) {
      if (dist < target.radius && !player.inCar) {
        missions.interactReady = true;
        if (interact) {
          advanceStage(missions, game);
          return true;
        }
      }
      return false;
    }
    if (target.inCar && !player.inCar) return false;
    if (target.onFoot && player.inCar) return false;
    if (target.quiet && game.police.stars > 0.5) return false;
    if (dist < target.radius) {
      advanceStage(missions, game);
      return true;
    }
    return false;
  }
  if (target.anyCar) {
    if (player.inCar) {
      advanceStage(missions, game);
      return true;
    }
    return false;
  }
  if (target.thugs) {
    const alive = game.thugs.filter((t) => !t.dead).length;
    if (alive === 0) {
      advanceStage(missions, game);
      return true;
    }
    return false;
  }
  return false;
}

/** Spawn the dock crew for mission 4 when the player reaches the pier. */
export function maybeSpawnThugs(missions, game) {
  const stage = currentStage(missions);
  if (!stage || !stage.target || stage.target.thugs !== 3 || missions.thugsSpawned) return;
  const pier = game.city.landmarks.pier;
  const dist = Math.hypot(game.player.x - pier.x, game.player.y - pier.y);
  if (dist < 260) {
    missions.thugsSpawned = true;
    game.thugs = createThugs(game.random, [
      { x: pier.x - 70, y: pier.y - 40 },
      { x: pier.x + 60, y: pier.y - 70 },
      { x: pier.x + 10, y: pier.y + 70 },
    ]);
  }
}
