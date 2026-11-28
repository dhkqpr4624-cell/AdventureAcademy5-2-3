import type { StoryActor, StorySequence, StoryStep } from "../../types/story";
import { CHAPTER3_STORY_ACTORS, UNIT3_KAF_ACADEMY_ACTOR } from "./chapter3Actors";

/**
 * Unit 3 · Floor 4 dialogue — 「3·1 운동과 대한민국 임시정부」 / 퀘스트 「꺼지지 않는 만세 소리」 (Phase 5).
 * Source: the Phase 5 request script. Speakers, expressions, wording, choices and order are kept; stage directions
 * are cues for Unit3Floor4Screen (checkpoint steps / stage phases / event-map actions), never shown as lines. The
 * player has no standing PNG; "(플레이어 이름)" is replaced by the saved name. 유관순's lines, the shield and the
 * 임시정부 meeting speakers (가상 인물) are the script's own creative staging.
 *
 * Cue checkpoints (`cue(...)`, handled by the screen): sound / music cues that must land exactly on a line.
 */
export const UNIT3_FLOOR4_STAGE_ID = "unit3-floor4-stage";

const asset = (path: string) => `${import.meta.env.BASE_URL}assets/chapter3/${path}`;
export const UNIT3_FLOOR4_ILLUST = {
  tapgol: asset("floor4/illust/tapgol-declaration.png"), // 독립선언서와 만세 행렬
  shanghai: asset("floor4/illust/shanghai-government.png"), // 상하이에서 정부 수립을 의논하는 사람들
} as const;

const LUNA_EXPRESSIONS = ["default", "smile", "serious", "angry", "sad", "shout"] as const;
export const UNIT3_LUNA_PERIOD_PORTRAIT_URLS = LUNA_EXPRESSIONS.map((expression) => asset(`floor4/portraits/luna-period/${expression}.png`));
/** 루나 in the 1919 scenes: the supplied 독립운동가-costume portraits (she joins the camp in her academy outfit). */
const LUNA_PERIOD_ACTOR: StoryActor = {
  ...CHAPTER3_STORY_ACTORS.luna,
  id: "luna", name: "루나", displayRole: undefined, defaultExpression: "default",
  portraits: Object.fromEntries(LUNA_EXPRESSIONS.map((expression, index) => [expression, {
    imageUrl: UNIT3_LUNA_PERIOD_PORTRAIT_URLS[index],
    placeholder: { label: "루나", gradient: "linear-gradient(135deg, #4a1a1a, #111)" },
  }])),
};
/** People with no supplied portrait (주민 · 유관순 · 정재용 · 헌병 경찰 · 독립운동가): name only, no portrait. */
const voiceActor = (id: string, name: string, displayRole?: string): StoryActor => ({ id, name, displayRole, role: "", accentColor: "#e9d7a8", defaultExpression: "default", portraits: {} });

export const UNIT3_FLOOR4_ACTORS: Record<string, StoryActor> = {
  deneb: CHAPTER3_STORY_ACTORS.deneb,
  kaiden: CHAPTER3_STORY_ACTORS.kaiden,
  // 카프 has her memory back: her own Adventure Academy portraits.
  kaf: { ...UNIT3_KAF_ACADEMY_ACTOR, id: "kaf" },
  luna: LUNA_PERIOD_ACTOR,
  // 루나 back at the base camp (academy outfit, Unit 2 portraits)
  lunaAcademy: { ...CHAPTER3_STORY_ACTORS.luna, id: "lunaAcademy", name: "루나", displayRole: undefined },
  jeong: voiceActor("jeong", "정재용", "독립운동가"),
  yu: voiceActor("yu", "유관순"),
  crowd: voiceActor("crowd", "주민들"),
  resident: voiceActor("resident", "주민"),
  resident2: voiceActor("resident2", "다른 주민"),
  police: voiceActor("police", "화면 밖 헌병 경찰"),
  activist1: voiceActor("activist1", "독립운동가 1"),
  activist2: voiceActor("activist2", "독립운동가 2"),
  activist3: voiceActor("activist3", "독립운동가 3"),
};
type ActorId = keyof typeof UNIT3_FLOOR4_ACTORS;
export const UNIT3_FLOOR4_PORTRAIT_URLS: string[] = [...UNIT3_LUNA_PERIOD_PORTRAIT_URLS];

let auto = 0;
const nextId = (prefix: string) => `u3f4-${prefix}-${(auto += 1).toString().padStart(3, "0")}`;
const d = (actorId: ActorId, expression: string, text: string, opts: { id?: string; next?: string } = {}): StoryStep => ({
  id: opts.id ?? nextId(actorId), type: "dialogue", speakerId: actorId, speakerName: UNIT3_FLOOR4_ACTORS[actorId].name,
  activeActorId: actorId, expression, text, nextStepId: opts.next, advanceMode: "click",
});
const n = (text: string): StoryStep => ({ id: nextId("narration"), type: "narration", text, advanceMode: "click" });
const wait = (durationMs: number): StoryStep => ({ id: nextId("wait"), type: "wait", durationMs, advanceMode: "auto" });
/** Illustration stage phase (Unit3Floor4Stage); hides the dialogue box while it changes. */
const stage = (phase: string, durationMs = 750): StoryStep => ({
  id: nextId(`stage-${phase}`), type: "setStagePhase", stageId: UNIT3_FLOOR4_STAGE_ID, phase, durationMs, hideDialogue: true, advanceMode: "auto",
});
/** A sound / music cue for the screen, exactly at this point of the script. */
export const cue = (name: string): StoryStep => ({ id: nextId(`cue-${name}`), type: "checkpoint", checkpointId: `u3f4:${name}`, advanceMode: "auto" });

// Every Floor 4 sequence hides StoryPlayer's own skip: the screen's single bottom-right 「건너뛰기」 skips a whole
// section (to its normal end state), never just one line.
const sequence = (id: string, title: string, steps: StoryStep[], extra: Partial<StorySequence> = {}): StorySequence => ({
  id, title, replayable: false, skippable: false, dialogueSkip: false,
  onCompleteScreen: "dungeon", backgrounds: {}, actors: UNIT3_FLOOR4_ACTORS,
  scenes: [{ id: `${id}-scene`, steps }],
  ...extra,
});
const camp = (id: string, title: string, steps: StoryStep[], extra: Partial<StorySequence> = {}) =>
  sequence(id, title, steps, { onCompleteScreen: "baseCamp", dialogueSkip: true, ...extra });

/* ---------------------------------------------------------------- 퀘스트 수령 (데네브) */
export const UNIT3_FLOOR4_QUEST_ACCEPTED_CHECKPOINT = "unit3-floor4-quest-accepted";
export const UNIT3_FLOOR4_QUEST_OFFER_STORY = camp("unit3-floor4-quest-offer", "퀘스트 수령: 꺼지지 않는 만세 소리", [
  d("deneb", "default", "(플레이어 이름), 다음 층을 조사할 준비가 되었나요?"),
  d("kaiden", "default", "카프는 먼저 입구 주변을 살피러 갔습니다. 멀리 가지 않고 저희를 기다리기로 했습니다."),
  d("deneb", "default", "네. 이제 카프도 함께 움직일 수 있게 되었네요."),
  d("deneb", "default", "이번에는 다른 동료들의 흔적도 찾을 수 있으면 좋겠어요."),
  d("kaiden", "default", "다음 층에서는 사람들이 모여 외치는 소리가 들렸습니다. 들어가서 확인해 봐야겠습니다."),
  { id: "u3f4-offer-choice", type: "choice", options: [
    { id: "accept", label: "다음 층으로 가겠습니다.", nextStepId: "u3f4-offer-accept" },
    { id: "later", label: "잠시 준비하겠습니다.", nextStepId: "u3f4-offer-later" },
  ], advanceMode: "click" },
  { id: "u3f4-offer-accept", type: "checkpoint", checkpointId: UNIT3_FLOOR4_QUEST_ACCEPTED_CHECKPOINT, advanceMode: "auto" },
  d("deneb", "default", "네. 카프와 합류하러 가죠.", { next: "u3f4-offer-end" }),
  d("deneb", "default", "준비되면 다시 이야기해 주세요.", { id: "u3f4-offer-later", next: "u3f4-offer-end" }),
  { id: "u3f4-offer-end", type: "wait", durationMs: 0, advanceMode: "auto" },
], { dialogueSkip: false });

/** Short replayable camp lines while Floor 4 is in progress / done — script lines reused verbatim (none were scripted). */
export const UNIT3_FLOOR4_DENEB_ACTIVE_STORY = camp("unit3-floor4-deneb-active", "데네브", [
  d("deneb", "default", "네. 카프와 합류하러 가죠."),
], { replayable: true });
export const UNIT3_FLOOR4_KAIDEN_ACTIVE_STORY = camp("unit3-floor4-kaiden-active", "카이든", [
  d("kaiden", "default", "다음 층에서는 사람들이 모여 외치는 소리가 들렸습니다. 들어가서 확인해 봐야겠습니다."),
], { replayable: true });
export const UNIT3_FLOOR4_DENEB_AFTER_STORY = camp("unit3-floor4-deneb-after", "데네브", [
  d("deneb", "default", "3·1 운동으로 바로 독립한 것은 아니에요. 하지만 독립을 바라는 뜻을 널리 알렸고, 임시정부 수립으로도 이어졌죠."),
], { replayable: true });
export const UNIT3_FLOOR4_KAIDEN_AFTER_STORY = camp("unit3-floor4-kaiden-after", "카이든", [
  d("kaiden", "default", "이제 다음 수색을 준비하자. 아론과 테오도 기다리고 있을 거다."),
], { replayable: true });
export const UNIT3_LUNA_BASE_TALK_STORY = camp("unit3-luna-base-talk", "루나", [
  d("lunaAcademy", "smile", "걱정 마! 내가 누구야! 누구보다 뛰어난 정찰요원, 루나라고!"),
  d("lunaAcademy", "smile", "두 사람도 금방 찾을 수 있을 거야!"),
], { replayable: true });

/* ---------------------------------------------------------------- 시작 장면 — 탑골공원 (illustration stage) */
export const UNIT3_FLOOR4_TAPGOL_STORY = sequence("unit3-floor4-tapgol", "탑골공원", [
  stage("tapgol", 1000),
  cue("murmur-start"),
  wait(1400),
  n("사람들은 탑골공원에 모였다."),
  n("사람들 앞에 선 한 청년이 우리나라의 독립을 선언하는 글을 펼쳤다."),
  cue("murmur-fade"),
  wait(1200),
  // 독립선언서 낭독 — one recording per line; the previous one is stopped before the next starts.
  cue("declaration-1"),
  d("jeong", "default", "우리는 오늘 조선이 독립한 나라이며, 조선인이 이 나라의 주인임을 선언한다."),
  cue("declaration-2"),
  d("jeong", "default", "우리는 이를 세계 모든 나라에 알려 인류가 모두 평등하다는 큰 뜻을 분명히 하고, 우리 후손이 민족 스스로 살아갈 정당한 권리를 영원히 누리게 할 것이다!"),
  cue("declaration-end"),
  // 잠시 dialogue 숨김 → 대한 독립 만세 SFX
  stage("tapgol", 400),
  cue("manse"),
  wait(1800),
  n("선언서 낭독이 끝나자 사람들은 태극기를 흔들며 대한 독립 만세를 외쳤다."),
  // 만세 SFX 종료 후 4층 BGM (낮은 음량)
  cue("bgm-after-manse"),
  stage("tapgol-kaf", 900),
  d("kaf", "default", "오셨군요. 저도 방금 도착해서 보고 있었어요. 사람들이 공원 밖으로도 모여들고 있어요."),
  d("deneb", "default", "이것은…!"),
  d("deneb", "default", "3·1 운동이네요. 일제의 지배에서 벗어나겠다는 의지를 보여 준 만세 시위죠."),
  d("kaiden", "default", "학생과 농민, 상인까지… 다양한 사람들이 보이는군."),
  d("kaf", "default", "네. 함께 독립을 외치고 있어요."),
  d("deneb", "angry", "하지만 이 사람들은… 결국…"),
  d("deneb", "angry", "…혼란스러워질 거예요. 다들 주위를 조심하도록 해요."),
  stage("none", 900),
]);

/* ---------------------------------------------------------------- 아우내 장터 (event map segments) */
const em = (id: string, steps: StoryStep[]) => sequence(id, "아우내 장터", steps);
export const UNIT3_FLOOR4_SEGMENTS = {
  crowd: em("u3f4-crowd", [
    d("crowd", "default", "대한 독립 만세! 대한 독립 만세!"),
    d("yu", "serious", "독립을 바라는 뜻을 함께 알립시다!"),
    d("luna", "default", "뒤쪽에도 사람들이 모였어! 모두 들리게 함께 외치자!"),
  ]),
  voice: em("u3f4-voice", [
    d("kaf", "default", "…이 목소리는?"),
  ]),
  reunion: em("u3f4-reunion", [
    d("kaf", "smile", "루나!"),
    d("luna", "smile", "어? 카프 부대장님!"),
    d("luna", "smile", "데네브 대장님, 카이든 대장님! (플레이어 이름)도!"),
    d("deneb", "default", "루나, 여기 있었군요. 저희를 기억하나요?"),
    d("luna", "default", "당연하지! 난 기억력 하나는 끝내주거든!"),
    d("luna", "default", "그런데 사실… 이번엔 조금 힘들었어. 자꾸 동료들에 대한 기억이 희미해지려고 해서…"),
    d("luna", "default", "어째서인지 나만 혼자 여기에 있었고…"),
    d("luna", "default", "어쨌든 정말 걱정했는데, 만나서 다행이야…"),
    d("kaiden", "default", "카프는 한동안 우리를 기억하지 못했다. 자네도 그럴까 걱정했어."),
    d("luna", "default", "보다시피 멀쩡해! 난 아주 튼튼하다고!"),
    d("luna", "default", "그런데 사실 완전히 예전과 같으냐고 하면, 그건 또 아니야…"),
    d("kaf", "serious", "루나, 혹시 당신도 저처럼…"),
    d("luna", "default", "응. 나한테도 마치 처음부터 이 시대 사람이었던 것 같은 이상한 기억들이 흘러들어 오고 있어."),
    d("luna", "default", "어드벤처 아카데미의 요원 루나도 나지만, 여기에서 만세 운동을 준비하던 루나 역시 나야."),
    d("luna", "default", "그래서 부탁이야, 대장님! 나는 계속 함께해 온 이 사람들을 두고 갈 수 없어…"),
    d("luna", "default", "내가 이 사람들과 해야 할 일을 마칠 수 있도록 도와줘!"),
    d("deneb", "default", "…루나…"),
    d("deneb", "smile", "걱정 말아요. 저희도 이곳을 그냥 떠날 생각은 없었어요."),
  ]),
  // 호각 → 군홧발 → 화면 밖 헌병 경찰 (일본어 음성)
  command: em("u3f4-command", [
    cue("command-1"),
    d("police", "default", "抑えろ(제압하라)！"),
  ]),
  surrounded: em("u3f4-surrounded", [
    d("kaiden", "serious", "양쪽에서 접근하고 있군. 포위되었나…!"),
    d("deneb", "serious", "카이든, 저와 왼쪽을 막아요. 카프와 루나는 오른쪽을 부탁해요!"),
    d("kaf", "serious", "알겠습니다. 루나, 제 옆으로 와요!"),
    d("luna", "serious", "응! 함께 막을게!"),
  ]),
  pressure: em("u3f4-pressure", [
    d("resident", "default", "아이들을 가운데로! 서로 밀지 마시오!"),
    d("deneb", "angry", "큭, 예상보다 강한 힘이에요."),
    d("kaiden", "angry", "(플레이어 이름), 네 힘이 필요하다!"),
    d("kaf", "angry", "(플레이어 이름), 부탁할게요!"),
  ]),
  talk3: em("u3f4-talk3", [
    n("사람들이 다시 태극기를 든다."),
    d("crowd", "default", "대한 독립 만세!"),
    d("luna", "default", "…이렇게 무서운데도 계속 외치고 있어."),
    d("yu", "serious", "우리나라가 독립을 바란다는 뜻을 전 세계에 알릴 것입니다!"),
    d("kaf", "smile", "…나라를 지키려는 마음은 무기를 든 사람들에게만 있는 게 아니죠."),
    d("deneb", "default", "네. 이 목소리가 더 많은 사람에게 전해질 거예요."),
  ]),
  evacuate6a: em("u3f4-evacuate6a", [
    d("kaf", "angry", "어마어마한 수의 적이군요…! 만일에 대비해 주민들을 대피시켜야 합니다!"),
    d("resident", "default", "이 골목으로 지나갈 수 있소! 아이들과 다친 사람부터 보내시오!"),
    d("kaiden", "default", "한꺼번에 몰리지 말고 천천히 이동하라!"),
  ]),
  evacuate6b: em("u3f4-evacuate6b", [
    d("kaf", "serious", "루나, 저쪽을 봐요. 사람들이 빠져나가고 있어요."),
    d("luna", "default", "응. 조금만 더 버티면 더 많은 사람이 살아남을 수 있겠어."),
    d("deneb", "default", "저희가 벌어 준 시간이 도움이 되고 있어요. 이제 조금만 더 버티면 돼요! 힘내세요!"),
  ]),
  success1: em("u3f4-success1", [
    d("kaiden", "default", "수고했다, (플레이어 이름). 아직 보호막이 버티고 있다!"),
  ]),
  success2: em("u3f4-success2", [
    d("luna", "default", "…조금만 더. 아직 남은 사람들이 있어."),
  ]),
  fail: em("u3f4-fail", [
    d("resident", "default", "으윽…!"),
    d("resident2", "default", "여기 사람이 쓰러졌소! 도와주시오!"),
    d("deneb", "serious", "보호막이 무너졌어요…!"),
    d("luna", "shout", "안 돼! 아직 사람들이…!"),
    d("kaiden", "angry", "이렇게 강한 힘이라니…!"),
  ]),
  quiet: em("u3f4-quiet", [
    d("resident", "default", "멈춘 건가…?"),
  ]),
  biggerForce: em("u3f4-bigger-force", [
    d("deneb", "serious", "…아니에요. 더 큰 힘이 오고 있어요!"),
  ]),
  brace: em("u3f4-brace", [
    d("kaf", "angry", "큭…! 모두 가운데로 모이세요!"),
    d("luna", "shout", "아직… 버텨야 해!"),
  ]),
  getDown: em("u3f4-get-down", [
    d("kaiden", "shout", "몸을 낮추십시오!"),
  ]),
  afterCollapse: em("u3f4-after-collapse", [
    d("resident", "default", "다친 사람을 부축해 주시오! 골목으로 가야 하오!"),
    d("kaf", "serious", "움직일 수 있는 분들은 서로 도와주세요! 이쪽 길은 아직 열려 있어요!"),
  ]),
  arrest: em("u3f4-arrest", [
    cue("command-2"),
    d("police", "default", "저들을 붙잡아라!!"),
  ]),
  lunaWait: em("u3f4-luna-wait", [
    d("luna", "shout", "기다려! 그 사람들을 데려가지 마!"),
  ]),
  lunaStopped: em("u3f4-luna-stopped", [
    d("kaf", "serious", "루나! 아직 여기에도 도와야 할 사람들이 있어요!"),
    d("luna", "angry", "하지만…!"),
    d("luna", "angry", "…알겠어…"),
    n("일행은 쓰러진 사람들을 부축하고 남아 있는 골목으로 이동했다."),
    n("모두를 구할 수는 없었지만, 먼저 빠져나간 사람들과 소식을 전하러 떠난 이들이 있었다."),
  ]),
  alley: em("u3f4-alley", [
    d("luna", "sad", "…보호막을 지켰잖아. 그런데 왜…"),
    d("deneb", "sad", "우리가 벌어 준 시간에 피한 사람들이 있어요. 그 시간은 헛되지 않았어요."),
    d("deneb", "sad", "하지만 실제 역사에서 일제는 만세 운동을 무력으로 탄압했어요. 많은 사람이 다치고, 목숨을 잃거나 붙잡혔죠."),
    d("kaiden", "serious", "유관순도 아우내 만세 운동 뒤에 붙잡혔습니다. 이후 감옥에서 순국했지요."),
    d("luna", "sad", "…우리가 모든 일을 막을 수는 없었던 거구나."),
    d("luna", "sad", "그게 역사니까… 그렇지?"),
    d("kaf", "default", "…그래도 독립을 바랐던 사람들의 뜻까지 사라진 것은 아니에요."),
    d("resident", "default", "다른 마을에서도 만세를 외친다고 들었소. 이곳의 소식도 전해질 것이오."),
    d("deneb", "default", "이 목소리가 어디로 이어지는지 함께 확인해 봐요."),
  ]),
  choice: em("u3f4-choice", [
    d("luna", "default", "…어드벤처 아카데미 요원으로서의 기억과, 이곳에서 독립운동을 준비하던 기억이 섞여 혼란스러웠어."),
    d("luna", "default", "하지만 이제는 앞으로 나아가야지."),
    d("luna", "default", "모두 덕분에 내가 이곳에서 해야 할 일을 끝까지 할 수 있었으니까 말이야!"),
    d("kaf", "smile", "루나, 당신이 있었기에 더 많은 사람을 탈출시킬 수 있었어요."),
    d("kaf", "smile", "역사 속 사람들을 지켜 낼 수 있었던 데에는 루나의 도움이 컸죠."),
    d("luna", "sad", "…"),
    d("luna", "smile", "응!"),
    d("deneb", "default", "구하지 못한 사람들이 마음에 걸리겠지요. 하지만 우리가 그들을 마음속에 담아 두고 살아간다면, 그들의 희생은 헛된 것이 아니에요."),
    d("deneb", "default", "이제 돌아가요, 베이스캠프로."),
    d("deneb", "default", "과거의 사람들을 위해서도, 현실 세계의 사람들을 위해서도…"),
    d("deneb", "default", "우리는 앞으로 나아가야 합니다."),
    d("luna", "default", "…응! 이제 내가 누구인지 명확해졌어. 어드벤처 아카데미의 원정대원, 루나."),
    d("luna", "default", "힘차게 나아가야지!"),
    d("kaf", "smile", "같이 가요, 루나."),
    d("kaiden", "default", "이제 아론과 테오만 남았군."),
    d("luna", "smile", "걱정 마! 내가 누구야! 누구보다 뛰어난 정찰요원, 루나라고!"),
    d("luna", "smile", "두 사람도 금방 찾을 수 있을 거야!"),
  ]),
} as const;
export type Unit3Floor4SegmentKey = keyof typeof UNIT3_FLOOR4_SEGMENTS;

/* ---------------------------------------------------------------- 대한민국 임시정부 (illustration stage; no expedition members) */
export const UNIT3_FLOOR4_SHANGHAI_STORY = sequence("unit3-floor4-shanghai", "대한민국 임시정부", [
  stage("shanghai", 1100),
  wait(3400), // caption typed, held ~2 s, faded
  n("독립을 바라는 뜻은 국내외의 독립운동가들에게 이어졌다."),
  n("사람들은 독립운동을 함께 이끌 정부를 세우기 위해 힘을 모았다."),
  d("activist1", "default", "국내에서 많은 사람이 만세를 외쳤습니다. 일제의 탄압에도 독립을 바라는 뜻은 꺾이지 않았습니다."),
  d("activist2", "default", "이제 그 뜻을 모아 독립운동을 함께 이끌 정부를 세워야 합니다."),
  d("activist3", "default", "나라를 빼앗겼다고 해서 우리 스스로 나라를 되찾으려는 노력까지 멈출 수는 없습니다."),
  d("activist1", "default", "나라의 이름은 ‘대한민국’으로 합시다. 국민이 나라의 주인이 되는 민주공화국을 세우는 것입니다."),
  d("activist2", "default", "왕 한 사람이 다스리는 나라가 아니라, 국민의 뜻에 따라 나라의 일을 결정하는 것이군요."),
  d("activist3", "default", "그렇습니다. 이 임시정부를 중심으로 힘을 모아 독립운동을 이어 갑시다."),
  n("1919년 4월 11일, 중국 상하이에서 대한민국 임시정부가 수립되었다."),
  n("만세를 외쳤던 사람들의 뜻은 독립을 위한 새로운 노력으로 이어졌다."),
  d("activist1", "default", "국내외의 동포들에게 이 소식을 전합시다. 독립을 위한 노력은 계속될 것입니다."),
  n("회의를 마친 사람들이 문서를 챙기며 각자의 일을 시작한다."),
  stage("none", 1000),
]);

/* ---------------------------------------------------------------- 베이스캠프: 퀘스트 완료 (데네브) */
export const UNIT3_FLOOR4_QUEST_COMPLETE_STORY = camp("unit3-floor4-quest-complete", "퀘스트 완료: 꺼지지 않는 만세 소리", [
  d("deneb", "default", "수고했어요, (플레이어 이름). 보호막에 힘을 보태 준 덕분에 더 많은 사람이 피할 수 있었어요."),
  d("lunaAcademy", "default", "그리고 그 사람들이 바랐던 일이 여기서 끝나지 않았다는 것도 보았지."),
  d("deneb", "default", "3·1 운동으로 바로 독립한 것은 아니에요. 하지만 독립을 바라는 뜻을 널리 알렸고, 임시정부 수립으로도 이어졌죠."),
  d("kaiden", "default", "이제 다음 수색을 준비하자. 아론과 테오도 기다리고 있을 거다."),
], { dialogueSkip: true });

export const UNIT3_FLOOR4_ALL_STORIES: readonly StorySequence[] = [
  UNIT3_FLOOR4_QUEST_OFFER_STORY, UNIT3_FLOOR4_TAPGOL_STORY, ...Object.values(UNIT3_FLOOR4_SEGMENTS), UNIT3_FLOOR4_SHANGHAI_STORY,
  UNIT3_FLOOR4_QUEST_COMPLETE_STORY, UNIT3_LUNA_BASE_TALK_STORY,
];
