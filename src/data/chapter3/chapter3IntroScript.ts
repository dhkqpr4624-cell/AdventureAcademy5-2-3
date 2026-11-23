import type { StorySequence, StoryStep } from "../../types/story";
import { CHAPTER3_STAGE_SPRITES, CHAPTER3_STORY_ACTORS } from "./chapter3Actors";
import { CHAPTER3_ASSETS, RECAP_IMAGES } from "./chapter3Assets";
import { ARRIVAL_DROP_MS } from "./chapter3IntroStage";

/** Unit 3 intro: HQ muster → (recap) → briefing → warp → dungeon arrival → base camp decision. */
export const CHAPTER3_INTRO_STORY_ID = "chapter3-intro";
export const CHAPTER3_STAGE_ID = "chapter3-intro";

const NAMES: Record<string, string> = Object.fromEntries(Object.values(CHAPTER3_STORY_ACTORS).map((actor) => [actor.id, actor.name]));

let auto = 0;
const id = (prefix: string) => `${prefix}-${(auto += 1).toString().padStart(3, "0")}`;
const d = (actorId: string, expression: string, text: string, opts: { id?: string; next?: string } = {}): StoryStep => ({
  id: opts.id ?? id(`line-${actorId}`),
  type: "dialogue",
  speakerId: actorId,
  speakerName: NAMES[actorId],
  activeActorId: actorId,
  expression,
  text,
  nextStepId: opts.next,
  advanceMode: "click",
});
const stage = (phase: string, durationMs = 0, hideDialogue = true, stepId?: string): StoryStep => ({
  id: stepId ?? id(`stage-${phase}`), type: "setStagePhase", stageId: CHAPTER3_STAGE_ID, phase, durationMs, hideDialogue, advanceMode: "auto",
});
const fade = (direction: "in" | "out", durationMs: number, color = "#000000"): StoryStep => ({ id: id(`fade-${direction}`), type: "fade", direction, color, durationMs, advanceMode: "auto" });
const wait = (durationMs: number): StoryStep => ({ id: id("wait"), type: "wait", durationMs, advanceMode: "auto" });
const narration = (text: string): StoryStep => ({ id: id("narration"), type: "narration", text, advanceMode: "click" });
const illust = (imageUrl: string | undefined, visible: boolean, fadeMs: number, extra: Partial<Extract<StoryStep, { type: "illustOverlay" }>> = {}): StoryStep => ({
  id: id("illust"), type: "illustOverlay", imageUrl, visible, fadeMs, hideDialogue: true, waitForFade: true, advanceMode: "auto", ...extra,
});

const HQ_STEPS: StoryStep[] = [
  fade("out", 0),
  stage("hq-gather"),
  fade("in", 1200),
  wait(1500),
  d("luna", "smile", "왔다, 왔다! (플레이어 이름)! 여기야!"),
  d("luna", "smile", "너도 호출받고 온 거지?"),
  d("theo", "smile", "어서 오십시오, (플레이어 이름). 저희도 막 도착했습니다."),
  d("aron", "default", "원정대 전원에게 내려온 소집 명령입니다. 데네브님과 카이든님도 곧 오실 겁니다."),
  d("kapp", "default", "이렇게 모두를 한꺼번에 부르다니… 무슨 일이 생긴 걸까요."),
  d("luna", "default", "모처럼 다 같이 쉬나 했더니, 또 모험인가 봐."),
  d("theo", "default", "아직 임무가 정해진 것은 아닙니다, 루나."),
  d("luna", "smile", "그래도 우리를 부른 거면 보통 일은 아니겠지!"),
  d("luna", "smile", "(플레이어 이름), 지난번 모험은 기억하고 있지?"),
  { id: "hq-memory-choice", type: "choice", options: [
    { id: "remember", label: "물론이지.", nextStepId: "branch-remember-luna" },
    { id: "forgot", label: "잘 기억나지 않아.", nextStepId: "branch-forgot-luna" },
  ], advanceMode: "click" },

  // ① 물론이지.
  d("luna", "smile", "역시! 그렇게 많은 일이 있었는데 잊을 수가 없지!", { id: "branch-remember-luna" }),
  d("theo", "smile", "저희가 함께 무사히 돌아온 것도, (플레이어 이름) 덕분입니다.", { id: "branch-remember-theo", next: "hq-join-aron" }),

  // ② 잘 기억나지 않아.
  d("luna", "default", "응? 하긴… 정신없는 일이 정말 많았으니까.", { id: "branch-forgot-luna" }),
  d("theo", "default", "이전 원정 기록을 확인하시겠습니까? 간단히 정리되어 있습니다.", { id: "branch-forgot-theo" }),
  { id: "hq-recap-popup", type: "choice", presentation: "popup", prompt: "이전 이야기의 줄거리를 보시겠습니까?", options: [
    { id: "recap-yes", label: "예", nextStepId: "recap-start" },
    { id: "recap-no", label: "아니오", nextStepId: "branch-recap-no-luna" },
  ], advanceMode: "click" },
  d("luna", "smile", "좋아! 필요한 건 우리가 옆에서 알려줄게.", { id: "branch-recap-no-luna", next: "hq-join-aron" }),

  // ②-예: 1·2단원 줄거리 요약 (본부 맵 dim + 중앙 장면)
  stage("hq-recap-dim", 600, true, "recap-start"),
  illust(RECAP_IMAGES.unit1Voyage, true, 700),
  narration("어드벤처 아카데미의 일원이 된 당신은 카이든, 테오, 루나와 함께 임무 장소로 항해하다가 갑작스럽게 생긴 미확인 포탈에 빨려 들어가게 된다."),
  illust(RECAP_IMAGES.unit1Jeon, true, 800),
  narration("던전을 탈출하기 위해 역사의 흐름을 따라 사건을 해결해 나가던 일행은, 기억을 잃은 남자, <blue><b>전</b></blue>을 만나게 된다."),
  illust(RECAP_IMAGES.unit1Return, true, 800),
  narration("전의 본명은 왕전으로, 고려의 제31대 왕인 공민왕이었다. 그의 희생으로 앞으로 나아간 원정대는 마지막 방에서 숨죽이고 있던 뒤틀린 문명의 골렘을 쓰러뜨리고, 무사히 귀환한다."),
  illust(undefined, false, 700),
  illust(RECAP_IMAGES.unit2Seoul, true, 700),
  narration("이후 새로운 임무를 받은 당신은 테오, 루나, 아론, 카프와 함께 서울 상공에 생긴 던전에 진입한다."),
  illust(RECAP_IMAGES.unit2Traces, true, 800),
  narration("던전의 흐름을 따라 나아갈 때마다 수상한 흔적이 발견되었고, 아론과 카프는 무언가를 숨기는 듯했다."),
  illust(RECAP_IMAGES.unit2Deneb, true, 800),
  narration("아론과 카프는 이전에 이 던전에 들어온 적이 있으나 균열이 심해 긴급 탈출을 할 수 밖에 없었으며, 그 과정에서 스스로를 희생한 지휘관, 데네브가 던전에 남아있을 것이라고 설명했다."),
  illust(RECAP_IMAGES.unit2Devourer, true, 800),
  narration("당신과 원정대는 힘을 모아 데네브를 구하고, 던전 깊은 곳의 역사포식자와 맞서게 된다."),
  illust(RECAP_IMAGES.unit2Devourer, true, 700, { dimmed: true }),
  narration("원정대는 역사포식자와의 대결에서 승리하였으나, 역사포식자는 완전히 사라지지 않았다. 패배한 그것은 어딘가로 달아난다."),
  illust(undefined, false, 800, { removeAfterFade: true }),
  stage("hq-recap-end", 600),
  d("luna", "smile", "이제 좀 생각나? 이번에도 잘 부탁해!", { next: "hq-join-aron" }),

  // 분기 합류
  d("aron", "smile", "지난 원정에서는 모두 고생이 많았습니다.", { id: "hq-join-aron" }),
  d("kapp", "smile", "이번에는 조금 덜 위험한 일이었으면 좋겠네요."),
  d("luna", "smile", "찬성! 조사만 하고 돌아오는 거라든가!"),
  d("theo", "default", "그렇다면 원정대 전원을 부르지는 않았을 것 같습니다만."),
  d("luna", "scared", "으으… 꼭 그렇게 말해야겠어?"),

  // 데네브·카이든 등장
  stage("hq-exclaim", 1800),
  stage("hq-commanders", 700),
  wait(500),
  d("deneb", "smile", "모두 일찍 모였네요. 기다리게 했나요?"),
  d("kapp", "smile", "아니에요. 저희도 방금 모였어요."),
  d("kaiden", "smile", "오랜만이군, (플레이어 이름). 그동안 실력이 더 늘었다고 들었다."),
  d("luna", "smile", "이번엔 카이든 대장님도 함께 가시는 거예요?"),
  d("kaiden", "default", "그래. 지난번에는 다른 임무 때문에 함께하지 못했으니까."),
  d("deneb", "smile", "카이든과 같은 원정에 나서는 것도 오랜만이네요."),
  d("kaiden", "smile", "선배님과 함께라니, 든든하군요."),
  d("luna", "default", "어? 카이든 대장님이 후배였어요?"),
  d("deneb", "smile", "후후. 처음에는 제 뒤를 아주 조용히 따라다녔답니다."),
  d("kaiden", "shame", "…그 이야기는 하지 않으셔도 됩니다."),
  d("kapp", "smile", "흥미로운 이야기인데요? 조금 더 듣고 싶어졌어요."),
  d("aron", "smile", "임무가 끝난 뒤에 들려주시면 좋겠습니다."),
  d("kaiden", "shame", "아론, 자네까지 그러는 건가."),

  // 연구원 등장과 포탈 현황 (본부 BGM → 긴장 BGM)
  stage("hq-researcher", 1200),
  d("researcher", "serious", "모두 모이셨군요. 바로 상황을 설명하겠습니다."),
  d("deneb", "default", "무슨 일이 생겼나요?"),
  d("researcher", "serious", "각지에서 발생하던 시간 이상 현상의 원인이 확인되었습니다."),
  d("researcher", "serious", "지난 원정에서 달아난 역사포식자입니다."),
  d("luna", "scared", "…그 녀석이 또요?"),
  d("researcher", "serious", "예. 지금까지 관측된 것과는 비교할 수 없을 만큼 강한 반응입니다."),
  d("researcher", "serious", "역사포식자가 완전히 깨어난 것으로 보입니다."),
  stage("hq-portal-dim", 600),
  illust(CHAPTER3_ASSETS.illust.nationSwallowingPortal, true, 800),
  wait(1500),
  d("researcher", "serious", "현재 나라 곳곳에 나타난 균열들이 하나의 거대한 포탈로 연결되고 있습니다."),
  d("researcher", "serious", "포탈에 삼켜진 지역은 외부와 연락이 끊겼습니다. 그곳에 있던 사람들도 돌아오지 않고 있습니다."),
  d("theo", "angry", "사람들까지 삼키고 있다는 말씀입니까?"),
  d("researcher", "serious", "그렇습니다. 지금 이 순간에도 범위가 넓어지고 있습니다."),
  d("aron", "serious", "주민들의 대피는 진행 중입니까?"),
  d("researcher", "serious", "가능한 지역부터 진행하고 있습니다. 하지만 확장이 멈추지 않으면 대피만으로는 버틸 수 없습니다."),
  d("kapp", "serious", "던전 안의 역사만으로는 부족해진 거군요."),
  d("deneb", "serious", "이제는 우리가 살아가는 현실의 시간까지 먹으려는 거예요."),
  illust(undefined, false, 700, { removeAfterFade: true }),
  stage("hq-briefing", 600),
  d("kaiden", "serious", "밖에서 포탈을 닫을 방법은 있습니까?"),
  d("researcher", "serious", "시도했지만 소용없었습니다. 중심부의 반응을 끊지 않는 한 포탈은 유지됩니다."),
  d("researcher", "serious", "내부로 진입해 역사포식자를 토벌해야 합니다."),
  d("deneb", "serious", "진입은 가능한가요?"),
  d("researcher", "serious", "예. 본부의 전이 장치로 포탈 내부까지 연결했습니다. 다만 내부가 불안정해 오래 유지할 수는 없습니다."),
  d("kaiden", "default", "준비된 인원이 한 번에 들어가야겠군요."),
  d("researcher", "serious", "그렇습니다. 본부에서도 계속 연결을 시도하겠습니다."),

  // 출발과 워프
  d("deneb", "default", "이번 원정의 전체 지휘는 제가 맡겠습니다. 카이든, 보조를 부탁해요."),
  d("kaiden", "default", "알겠습니다. 대원들의 상태와 이동을 살피겠습니다."),
  d("aron", "default", "카프, 진입 직후에는 주변부터 확인하죠."),
  d("kapp", "default", "네. 모두 흩어지지 않도록 해요."),
  d("theo", "default", "보급품은 준비되어 있습니다. 바로 출발할 수 있습니다."),
  d("luna", "angry", "나도 준비됐어. 이번에는 그 녀석을 놓치지 않을 거야."),
  d("kaiden", "default", "(플레이어 이름), 준비됐나? 진입하면 내 주변에서 떨어지지 마라."),
  d("deneb", "default", "목표는 역사포식자를 쓰러뜨리고 포탈을 닫는 것입니다."),
  d("deneb", "default", "삼켜진 사람들을 발견하면 구조하고, 함께 돌아옵니다."),
  d("kapp", "smile", "이번에도 모두 함께 돌아오는 거예요."),
  d("deneb", "smile", "그럼, 출발하겠습니다."),
  stage("hq-warp-charge", 2600),
  stage("hq-warp-peak", 0, false),
  d("luna", "shout", "자, 잠깐! 빛이 너무 강한데—"),
  stage("hq-warp-flash", 240, true, "hq-warp-flash"),
  fade("out", 420),
];

const ARRIVAL_STEPS: StoryStep[] = [
  // Starts on black — the HQ ends faded out, and a skip from the HQ lands here with the same first frame.
  fade("out", 0),
  wait(500),
  stage("arrival-landing", 0, true, "arrival-start"),
  wait(1300),
  fade("in", 2200),
  wait(1000),
  stage("arrival-kaiden", 1100),
  d("kaiden", "serious", "…도착했나."),
  d("kaiden", "serious", "(플레이어 이름), 다친 곳은 없나?"),
  { id: "arrival-condition-choice", type: "choice", options: [
    { id: "fine", label: "괜찮습니다.", nextStepId: "branch-fine-kaiden" },
    { id: "dizzy", label: "조금 어지럽습니다.", nextStepId: "branch-dizzy-kaiden" },
  ], advanceMode: "click" },
  d("kaiden", "default", "다행이군. 잠깐 그 자리에 있어라.", { id: "branch-fine-kaiden", next: "arrival-join" }),
  d("kaiden", "default", "무리해서 움직이지 마라. 잠깐 숨부터 고르도록.", { id: "branch-dizzy-kaiden", next: "arrival-join" }),
  stage("arrival-kaiden-look-left", 600, true, "arrival-join"),
  stage("arrival-kaiden-look-right", 500),
  stage("arrival-deneb", 1100),
  d("deneb", "serious", "두 사람 다 무사한가요?"),
  d("kaiden", "default", "예. 저희는 괜찮습니다. 데네브님은?"),
  d("deneb", "default", "저도 괜찮아요. 그런데…"),
  stage("arrival-look-behind", 2400),
  wait(2000),
  stage("arrival-look-return", 2000),
  d("deneb", "serious", "나머지 네 사람은 아직 도착하지 않았나요?"),
  d("kaiden", "serious", "저희도 방금 도착했습니다. 조금 늦어지는 걸지도 모릅니다."),

  // 주변 확인
  d("deneb", "default", "우선 이곳부터 확인하죠."),
  stage("arrival-survey", 4200),
  wait(1400),
  stage("arrival-survey-return", 3000),
  d("kaiden", "default", "본부 주변과는 전혀 다른 풍경이군요. 저쪽에는 길도 있습니다."),
  d("deneb", "serious", "던전이 만들어 낸 공간 같아요. 하지만 전보다 훨씬 넓고… 기척도 복잡하네요."),
  d("kaiden", "serious", "우선 진입 지점 주변을 살피겠습니다."),
  d("deneb", "default", "멀리 가지는 마세요. 저는 이곳에서 도착 반응을 확인할게요."),

  // 대기와 수색
  stage("arrival-scout-out", 2400),
  stage("arrival-scout-pause", 800),
  stage("arrival-scout-back", 2400),
  stage("arrival-regroup", 200),
  fade("out", 900),
  narration("일행은 진입 지점에서 기다리며, 주변을 여러 차례 살폈다."),
  { id: "arrival-black-hold", type: "setStagePhase", stageId: CHAPTER3_STAGE_ID, phase: "arrival-regroup", durationMs: 900, hideDialogue: true, advanceMode: "auto" },
  narration("하지만 아무리 기다려도 다른 동료들은 나타나지 않았다."),
  stage("arrival-regroup"),
  fade("in", 1200),
  d("kaiden", "serious", "근처에는 없습니다. 발자국도, 전이 흔적도 찾지 못했습니다."),
  d("deneb", "serious", "이쪽도 추가 도착 반응이 없어요."),
  d("kaiden", "angry", "…워프가 어긋난 건가?"),
  d("deneb", "serious", "진입할 때 빛이 갑자기 강해졌어요. 포탈의 간섭으로 도착 지점이 갈렸을 가능성이 있습니다."),
  d("kaiden", "serious", "그렇다면 네 사람이 서로 다른 곳에 떨어졌을 수도 있겠군요."),
  d("deneb", "serious", "네. 아직은 어디에 있는지 알 수 없어요."),
  d("kaiden", "default", "아론과 카프는 여러 경험을 쌓은 정예 요원이지요. 루나와 테오도 던전 경험이 있고요."),
  d("kaiden", "default", "무사하다면 저희처럼 주변부터 확인하고 있을 겁니다."),
  d("deneb", "default", "맞아요. 우리도 할 수 있는 일부터 하죠."),

  // 거점 결정과 베이스캠프 전환
  d("deneb", "default", "카이든, 이곳을 거점으로 삼죠. 동료들이 뒤늦게 도착할 수도 있으니까요."),
  d("kaiden", "default", "예. 베이스캠프용 천막을 설치하겠습니다."),
  d("deneb", "default", "마냥 지체할 수는 없으니, 저희끼리라도 먼저 던전 내부를 천천히 살펴보도록 해요."),
  d("deneb", "default", "어떤 위협이 있을 지 모르니 , 서두르지 말고 함께 움직여요."),
  stage("arrival-drop", ARRIVAL_DROP_MS, true, "arrival-drop"),
  fade("out", 700),
];

/**
 * Intro states: HQ_INTRO → ARRIVAL_INTRO → BASE_CAMP. Each map is its own sequence, so "건너뛰기"
 * moves exactly one state forward:
 *   HQ_INTRO      → ARRIVAL_INTRO (the arrival map from its first step: black, landing, wind, warp-in…)
 *   ARRIVAL_INTRO → BASE_CAMP     (intro completion is recorded exactly as when it is played to the end)
 */
export type Chapter3IntroState = "HQ_INTRO" | "ARRIVAL_INTRO" | "BASE_CAMP";
export const CHAPTER3_INTRO_HQ_STORY_ID = "chapter3-intro-hq";
export const CHAPTER3_INTRO_ARRIVAL_STORY_ID = "chapter3-intro-arrival";
/** A skip right after a map starts is ignored (no double-click skipping two states at once). */
export const CHAPTER3_INTRO_SKIP_GUARD_MS = 900;

const introPart = (storyId: string, title: string, sceneId: string, steps: StoryStep[]): StorySequence => ({
  id: storyId,
  title,
  className: "story-player-chapter3",
  minInputDwellMs: 280,
  backgrounds: {},
  actors: CHAPTER3_STORY_ACTORS,
  replayable: false,
  skippable: true,
  skipTarget: { complete: true },
  skipDelayMs: CHAPTER3_INTRO_SKIP_GUARD_MS,
  onCompleteScreen: "baseCamp",
  scenes: [{ id: sceneId, steps }],
});

export const CHAPTER3_INTRO_HQ_SEQUENCE: StorySequence = introPart(CHAPTER3_INTRO_HQ_STORY_ID, "3단원 인트로 — 작전본부", "chapter3-hq", HQ_STEPS);
export const CHAPTER3_INTRO_ARRIVAL_SEQUENCE: StorySequence = introPart(CHAPTER3_INTRO_ARRIVAL_STORY_ID, "3단원 인트로 — 던전 도착", "chapter3-arrival", ARRIVAL_STEPS);

/** The whole intro as one sequence (data view used by the checks; the player runs the two parts). */
export const CHAPTER3_INTRO_SEQUENCE: StorySequence = {
  ...introPart(CHAPTER3_INTRO_STORY_ID, "3단원 인트로", "chapter3-hq", HQ_STEPS),
  scenes: [
    { id: "chapter3-hq", steps: HQ_STEPS },
    { id: "chapter3-arrival", steps: ARRIVAL_STEPS },
  ],
};

/** Every image the intro can show (preloaded before the first frame). */
export const CHAPTER3_INTRO_IMAGE_URLS: string[] = [
  CHAPTER3_ASSETS.sky,
  ...Object.values(CHAPTER3_ASSETS.hq),
  ...Object.values(CHAPTER3_ASSETS.arrival),
  CHAPTER3_ASSETS.vfx.holoGlobeSheet,
  CHAPTER3_ASSETS.vfx.exclamationSheet,
  CHAPTER3_ASSETS.illust.nationSwallowingPortal,
  ...Object.values(RECAP_IMAGES),
  // standing frames and blink sheets of every stage actor (decoded before the first frame — no blank blink)
  ...Object.values(CHAPTER3_STAGE_SPRITES).flatMap((sprite) => [
    ...Object.values(sprite.images),
    ...(sprite.blink ? Object.values(sprite.blink.images) : []),
  ]),
];
