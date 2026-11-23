/** Unit 3 asset URLs (public/assets/chapter3). Imported from phase_1_assets.zip by scripts/chapter3/prepare_phase1_assets.py. */
const base = `${import.meta.env.BASE_URL}assets/chapter3/`;
export const chapter3Asset = (path: string) => `${base}${path}`;

/** Every map layer shares this coordinate system (source PNGs are 1670~1672 x 941). */
export const CHAPTER3_MAP_SIZE = { width: 1672, height: 941 } as const;

export const CHAPTER3_ASSETS = {
  sky: chapter3Asset("maps/sky.png"),
  hq: {
    cloudAtmosphere: chapter3Asset("maps/hq/cloud-atmosphere.png"),
    skyProps: chapter3Asset("maps/hq/sky-props.png"),
    backgroundOutside: chapter3Asset("maps/hq/background-outside.png"),
    background: chapter3Asset("maps/hq/background.png"),
    foreground: chapter3Asset("maps/hq/foreground.png"),
    ground: chapter3Asset("maps/hq/ground.png"),
  },
  arrival: {
    background: chapter3Asset("maps/arrival/background.png"),
    foreground: chapter3Asset("maps/arrival/foreground.png"),
    ground: chapter3Asset("maps/arrival/ground.png"),
  },
  basecamp: {
    cloud: chapter3Asset("maps/basecamp/cloud.png"),
    background: chapter3Asset("maps/basecamp/background.png"),
    foreground: chapter3Asset("maps/basecamp/foreground.png"),
    ground: chapter3Asset("maps/basecamp/ground.png"),
    dungeonEntrance: chapter3Asset("maps/basecamp/dungeon-entrance.png"),
    tram: chapter3Asset("maps/basecamp/tram.png"),
  },
  vfx: {
    holoGlobeSheet: chapter3Asset("vfx/holo-command-globe.png"),
    holoGlobeJson: chapter3Asset("vfx/holo-command-globe.json"),
    exclamationSheet: chapter3Asset("vfx/exclamation-sheet.png"),
  },
  illust: {
    nationSwallowingPortal: chapter3Asset("illust/nation-swallowing-portal.png"),
  },
  actors: {
    player: chapter3Asset("actors/player-standing.png"),
  },
} as const;

/** Tram crop origin inside the original 1672x941 layer (see maps/basecamp/tram.json). */
export const BASECAMP_TRAM = { x: 16, y: 430, width: 786, height: 331 } as const;

/**
 * Unit 1/2 recap illustrations reused from this repository (Unit 1 scenes were carried over into Unit 2).
 * Seven images: 3 for Unit 1, 4 for Unit 2. The last Unit 2 line reuses the devourer shot, dimmed.
 */
const publicAsset = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;
export const RECAP_IMAGES = {
  unit1Voyage: publicAsset("story/illustrations/intro_portal_swallow_plane.png"),
  unit1Jeon: publicAsset("story/dungeon4/jeon-found.png"),
  unit1Return: publicAsset("ending/ending-4-party-enter.png"),
  unit2Seoul: publicAsset("dungeon8/giant-portal.png"),
  unit2Traces: publicAsset("story/chapter2/dungeon1/mysterious-figure.png"),
  unit2Deneb: publicAsset("dungeon7/fallen-deneb-illustration.png"),
  unit2Devourer: publicAsset("dungeon10/boss/hungry-history-devourer-combat.png"),
} as const;
