import { getArmorMaxHpBonusForFloor } from "../balance/floorBalance";

export type ItemType = "weaponSkin" | "armor" | "consumable" | "misc";
export type ItemRarity = "common" | "uncommon" | "rare" | "epic";

export type ItemDefinition = {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  description: string;
  icon: string;
  stackable: boolean;
  attackVfxId?: string;
  equipmentStats?: {
    maxHpBonus: number;
  };
};

export const ITEM_DEFINITION_REGISTRY: Record<string, ItemDefinition> = {
  "weapon-wooden-wand": {
    id: "weapon-wooden-wand", name: "나무 마법 지팡이", type: "weaponSkin",
    rarity: "common", description: "2단원 원정에 지급된 기본 마법 지팡이다.",
    icon: `${import.meta.env.BASE_URL}assets/items/wooden-wand.png`, stackable: false, attackVfxId: "fire-attack",
  },
  "weapon-basic-sword": {
    id: "weapon-basic-sword", name: "기본 목검", type: "weaponSkin",
    rarity: "common", description: "아카데미에서 지급한 기본 목검이다.",
    icon: `${import.meta.env.BASE_URL}assets/items/basic-sword.png`, stackable: false,
  },
  // Unit 3 Floor 1 quest reward: cosmetic only (no stats); its own PixelFX sword swing (Phase 3).
  "weapon-uibyeong-hwando": {
    id: "weapon-uibyeong-hwando", name: "의병의 환도", type: "weaponSkin",
    rarity: "rare", description: "나라를 지키려고 모인 의병들이 사용하던 칼을 본뜬 무기.",
    icon: `${import.meta.env.BASE_URL}assets/items/uibyeong-hwando.png`, stackable: false, attackVfxId: "uibyeong-hwando-slash",
  },
  // Unit 3 Floor 2 quest reward: cosmetic only (no stats); reuses the existing ink-brush attack VFX.
  // Phase 4: Unit 3 Floor 3 special reward. A decorative item in the existing armor (equipment) slot — like 2단원's
  // 척화비 / 국기 뱃지 — with NO stats (none were specified).
  "decor-taken-land-deed": {
    id: "decor-taken-land-deed", name: "빼앗긴 땅문서", type: "armor", rarity: "rare",
    description: "일제가 토지조사사업을 벌일 때 빼앗긴 대한제국 국민의 땅문서",
    icon: `${import.meta.env.BASE_URL}assets/chapter3/floor3/items/taken-land-deed.png`, stackable: false,
  },
  // Phase 5: Unit 3 Floor 4 special reward — a weapon skin with NO stats; the default attack VFX (no attackVfxId).
  // The supplied image is both the icon and the sword-model texture (one file, see SwordViewModel).
  "weapon-taegeuk-flag": {
    id: "weapon-taegeuk-flag", name: "3·1 운동 태극기", type: "weaponSkin",
    rarity: "rare", description: "대한 독립 만세 시위에 참여한 사람들이 손에 들고 있던 태극기.",
    icon: `${import.meta.env.BASE_URL}assets/chapter3/floor4/items/taegeuk-flag.png`, stackable: false,
  },
  "weapon-learning-fountain-pen": {
    id: "weapon-learning-fountain-pen", name: "애국계몽 만년필", type: "weaponSkin",
    rarity: "rare", description: "책과 배움으로 나라를 지키려 했던 사람들의 뜻을 담은 무기.",
    icon: `${import.meta.env.BASE_URL}assets/items/learning-fountain-pen.png`, stackable: false, attackVfxId: "ink-brush-attack",
  },
  "weapon-gojoseon-bronze-dagger": {
    id: "weapon-gojoseon-bronze-dagger", name: "고조선 비파형 동검", type: "weaponSkin",
    rarity: "rare", description: "고조선의 비파형 동검을 본뜬 희귀 무기 스킨이다.",
    icon: `${import.meta.env.BASE_URL}assets/items/bipa-bronze-sword.png`, stackable: false,
  },
  "weapon-yangban-folding-fan": {
    id: "weapon-yangban-folding-fan", name: "양반의 부채", type: "weaponSkin",
    rarity: "rare", description: "조선 양반의 품격을 상징하는 희귀 무기다.",
    icon: `${import.meta.env.BASE_URL}assets/items/yangban-folding-fan.png`, stackable: false,
  },
  "weapon-hand-axe": {
    id: "weapon-hand-axe", name: "주먹도끼", type: "weaponSkin",
    rarity: "rare", description: "구석기 시대의 주먹도끼를 본뜬 희귀 무기 스킨이다.",
    icon: `${import.meta.env.BASE_URL}assets/items/hand-axe.png`, stackable: false,
  },
  "armor-gwanggaeto": {
    id: "armor-gwanggaeto", name: "광개토대왕 갑옷", type: "armor",
    rarity: "rare", description: "고구려의 위대한 정복 군주를 상징하는 갑옷.",
    icon: `${import.meta.env.BASE_URL}assets/items/gwanggaeto-armor.png`,
    stackable: false,
    equipmentStats: { maxHpBonus: getArmorMaxHpBonusForFloor(3) },
  },
  "armor-angbuilgu-helmet": {
    id: "armor-angbuilgu-helmet", name: "앙부일구 투구", type: "armor", rarity: "rare",
    description: "세종대왕의 해시계, 앙부일구를 본뜬 투구",
    icon: `${import.meta.env.BASE_URL}assets/items/angbuilgu-helmet.png`, stackable: false,
    equipmentStats: { maxHpBonus: getArmorMaxHpBonusForFloor(3) },
  },
  "weapon-chiljido": {
    id: "weapon-chiljido",
    name: "충무공(이순신) 장검 모양 지팡이",
    type: "weaponSkin",
    rarity: "rare",
    description: "충무공 이순신의 장검을 본뜬 마법 지팡이형 무기 스킨이다.",
    icon: `${import.meta.env.BASE_URL}assets/items/chungmugong-long-sword.png`,
    stackable: false,
    attackVfxId: "water-thunderbolt",
  },
  "armor-munmu": {
    id: "armor-munmu", name: "실학자의 수첩", type: "armor", rarity: "rare",
    description: "조선 후기 실학자의 개혁 사상이 담긴 수첩.",
    icon: `${import.meta.env.BASE_URL}assets/items/silhak-scholar-notebook.png`, stackable: false,
    equipmentStats: { maxHpBonus: getArmorMaxHpBonusForFloor(5) },
  },
  "weapon-silla-ring-pommel-sword": {
    id: "weapon-silla-ring-pommel-sword", name: "김홍도의 붓", type: "weaponSkin", rarity: "rare",
    description: "김홍도의 풍속화를 떠올리게 하는 붓 모양 마법 지팡이 스킨이다.",
    icon: `${import.meta.env.BASE_URL}assets/items/kim-hong-do-brush.png`, stackable: false, attackVfxId: "ink-brush-attack",
  },
  "accessory-gungye-eyepatch": {
    id: "accessory-gungye-eyepatch", name: "척화비", type: "armor", rarity: "rare",
    description: "통상 수교 거부 정책의 역사를 담은 척화비를 본뜬 방어구다.",
    icon: `${import.meta.env.BASE_URL}assets/items/anti-foreign-stele.png`, stackable: false,
    equipmentStats: { maxHpBonus: getArmorMaxHpBonusForFloor(7) },
  },
  "weapon-choe-museon-cannon": {
    id: "weapon-choe-museon-cannon", name: "동학농민군 죽창", type: "weaponSkin", rarity: "rare",
    description: "동학농민군의 굳센 의지를 담은 죽창 모양 무기 스킨이다.",
    icon: `${import.meta.env.BASE_URL}assets/items/donghak-bamboo-spear.png`, stackable: false,
    attackVfxId: "powerful-impact",
  },
  "armor-tripitaka-koreana": {
    id: "armor-tripitaka-koreana", name: "대한제국 국기 뱃지", type: "armor", rarity: "rare",
    description: "대한제국의 자주독립과 근대 국가 수립 의지를 담은 국기 뱃지다.",
    icon: `${import.meta.env.BASE_URL}assets/items/korean-empire-flag-badge.png`, stackable: false,
    equipmentStats: { maxHpBonus: getArmorMaxHpBonusForFloor(9) },
  },
  "quest-memory-fragment": {
    id: "quest-memory-fragment", name: "뒤틀린 기억의 조각", type: "misc",
    rarity: "rare", description: "카이든이 가진 조각과 꼭 맞을 듯한 비석 조각이다.",
    icon: "🪨", stackable: false,
  },
  "quest-hand-axe": { id: "quest-hand-axe", name: "주먹도끼", type: "misc", rarity: "rare", description: "구석기 시대의 주먹도끼다.", icon: `${import.meta.env.BASE_URL}assets/items/hand-axe.png`, stackable: false },
  "quest-tanged-point": { id: "quest-tanged-point", name: "슴베찌르개", type: "misc", rarity: "rare", description: "구석기 시대의 슴베찌르개다.", icon: `${import.meta.env.BASE_URL}assets/items/tanged-point.png`, stackable: false },
  "quest-comb-pattern-pottery": { id: "quest-comb-pattern-pottery", name: "빗살무늬 토기", type: "misc", rarity: "rare", description: "신석기 시대의 빗살무늬 토기다.", icon: `${import.meta.env.BASE_URL}assets/items/comb-pattern-pottery.png`, stackable: false },
  "quest-torn-cloth": {
    id: "quest-torn-cloth", name: "천 조각", type: "misc",
    rarity: "rare", description: "던전 3층에서 발견한, 시대와 어울리지 않는 찢어진 천 조각이다.",
    icon: `${import.meta.env.BASE_URL}assets/items/torn-cloth.png`, stackable: false,
  },
  "potion-small": {
    id: "potion-small", name: "소형 회복 포션", type: "consumable",
    rarity: "common", description: "던전 전투 중 HP를 20 회복한다.",
    icon: `${import.meta.env.BASE_URL}assets/items/potion-small.png`, stackable: true,
  },
  "potion-medium": {
    id: "potion-medium", name: "중형 회복 포션", type: "consumable",
    rarity: "uncommon", description: "던전 전투 중 HP를 35 회복한다.",
    icon: `${import.meta.env.BASE_URL}assets/items/potion-medium.png`, stackable: true,
  },
  "upgrade-small-potion-pouch": {
    id: "upgrade-small-potion-pouch", name: "소형 포션 주머니", type: "misc",
    rarity: "uncommon", description: "소형 포션 최대 소지 수가 1 증가합니다. 최대 2회 구매할 수 있습니다.",
    icon: `${import.meta.env.BASE_URL}assets/items/small-potion-pouch.png`, stackable: true,
  },
  "upgrade-medium-potion-pouch": {
    id: "upgrade-medium-potion-pouch", name: "중형 포션 주머니", type: "misc",
    rarity: "rare", description: "중형 포션 최대 소지 수가 1 증가합니다. 최대 1회 구매할 수 있습니다.",
    icon: `${import.meta.env.BASE_URL}assets/items/medium-potion-pouch.png`, stackable: true,
  },
};

export const getItemDefinition = (itemId: string) =>
  ITEM_DEFINITION_REGISTRY[itemId] ?? null;
