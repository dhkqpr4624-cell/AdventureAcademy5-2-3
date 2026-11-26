import type { StoryActor, StorySequence, StoryStep } from "../../types/story";
import { CHAPTER3_STORY_ACTORS, UNIT3_KAF_ACADEMY_ACTOR, UNIT3_KAF_PERIOD_ACTOR, UNIT3_KAF_PERIOD_PORTRAIT_URLS } from "./chapter3Actors";

/**
 * Unit 3 · Floor 3 dialogue — 「일제의 식민 통치와 달라진 생활」 / 퀘스트 「잊지 않은 약속」 (Phase 4).
  * Source: the Phase 4 request script (speakers, expressions, choices, wording and order preserved;
 * typos and historical notes are reported, not rewritten). Stage directions are implemented as stage phases,
 * waits and event-map cues — they are never shown as dialogue. The player has no standing PNG; "(플레이어 이름)"
 * is replaced by the saved player name. 1910년대 (3·1 운동 이전). 주민·학교 관계자·농민 are fictional people.
 */
export const UNIT3_FLOOR3_STAGE_ID = "unit3-floor3-stage";

const asset = (path: string) => `${import.meta.env.BASE_URL}assets/chapter3/${path}`;

export const UNIT3_FLOOR3_ILLUST = {
  street: asset("floor3/illust/kenpei-street.png"), // 헌병이 지키는 거리
  government: asset("floor3/illust/government-general.png"), // 조선총독부
  alley: asset("floor3/illust/checkpoint-alley.png"), // 검문소 옆 골목
  farmers: asset("floor3/illust/farmers-packing.png"), // 집 앞에서 짐을 정리하는 농민
  classroom: asset("floor3/illust/stopped-classroom.png"), // 수업을 멈춘 교실
} as const;
/** In the dungeon 카프 still wears the period costume (Floor 2 standing). */
export const UNIT3_FLOOR3_KAF_STANDING = asset("floor2/standing/kaf-period.png");

const portraitActor = (id: string, name: string, imageUrl: string): StoryActor => ({
  id, name, role: "", accentColor: "#e9d7a8", defaultExpression: "default",
  portraits: { default: { imageUrl, placeholder: { label: name, gradient: "linear-gradient(135deg,#30291f,#111)" } } },
});

export const UNIT3_FLOOR3_ACTORS: Record<string, StoryActor> = {
  deneb: CHAPTER3_STORY_ACTORS.deneb,
  kaiden: CHAPTER3_STORY_ACTORS.kaiden,
  // 카프's existing expression portraits (default / smile / serious / angry / sad).
  // Phase 4 hotfix 2: `kaf` = before her memory returns (개화기 costume portraits); `kafAcademy` = the memory
  // flashback and everything after the recovery in the event map (own Adventure Academy portraits), incl. camp.
  kaf: UNIT3_KAF_PERIOD_ACTOR,
  kafAcademy: UNIT3_KAF_ACADEMY_ACTOR,
  // No Floor 3 resident portrait was supplied: the Floor 1 street resident portrait is reused (as on Floor 2).
  resident: portraitActor("resident", "주민", asset("floor1/portraits/street-resident.png")),
  // Supplied portrait (file name "현병 초상화.png" — reported as a typo of 헌병).
  kenpei: portraitActor("kenpei", "헌병", asset("floor3/portraits/kenpei.png")),
  farmer: portraitActor("farmer", "농민", asset("floor3/portraits/farmer.png")),
  student: portraitActor("student", "학생", asset("floor2/portraits/student.png")),
  official: portraitActor("official", "학교 관계자", asset("floor2/portraits/school-official.png")),
};
type ActorId = keyof typeof UNIT3_FLOOR3_ACTORS;
export const UNIT3_FLOOR3_PORTRAIT_URLS: string[] = ["resident", "kenpei", "farmer", "student", "official"]
  .map((id) => UNIT3_FLOOR3_ACTORS[id].portraits.default?.imageUrl)
  .filter((url): url is string => Boolean(url)).concat(UNIT3_KAF_PERIOD_PORTRAIT_URLS);

let auto = 0;
const nextId = (prefix: string) => `u3f3-${prefix}-${(auto += 1).toString().padStart(3, "0")}`;
const d = (actorId: ActorId, expression: string, text: string, opts: { id?: string; next?: string } = {}): StoryStep => ({
  id: opts.id ?? nextId(actorId), type: "dialogue", speakerId: actorId, speakerName: UNIT3_FLOOR3_ACTORS[actorId].name,
  activeActorId: actorId, expression, text, nextStepId: opts.next, advanceMode: "click",
});
const n = (text: string): StoryStep => ({ id: nextId("narration"), type: "narration", text, advanceMode: "click" });
const wait = (durationMs: number): StoryStep => ({ id: nextId("wait"), type: "wait", durationMs, advanceMode: "auto" });
/** Illustration stage phase (Unit3Floor3Stage); hides the dialogue box while it changes. */
const stage = (phase: string, durationMs = 750): StoryStep => ({
  id: nextId(`stage-${phase}`), type: "setStagePhase", stageId: UNIT3_FLOOR3_STAGE_ID, phase, durationMs, hideDialogue: true, advanceMode: "auto",
});

const sequence = (id: string, title: string, steps: StoryStep[], extra: Partial<StorySequence> = {}): StorySequence => ({
  id, title, replayable: false, skippable: false, dialogueSkip: true,
  onCompleteScreen: "dungeon", backgrounds: {}, actors: UNIT3_FLOOR3_ACTORS,
  scenes: [{ id: `${id}-scene`, steps }],
  ...extra,
});
const camp = (id: string, title: string, steps: StoryStep[], extra: Partial<StorySequence> = {}) =>
  sequence(id, title, steps, { onCompleteScreen: "baseCamp", ...extra });

/* ---------------------------------------------------------------- 퀘스트 수령 (카이든) */
export const UNIT3_FLOOR3_QUEST_ACCEPTED_CHECKPOINT = "unit3-floor3-quest-accepted";
export const UNIT3_FLOOR3_QUEST_OFFER_STORY = camp("unit3-floor3-quest-offer", "퀘스트 수령: 잊지 않은 약속", [
  d("kaiden", "default", "데네브님, 다음 층으로 이어지는 길을 살펴보고 왔습니다."),
  d("kaiden", "default", "카프가 있던 학교와 연결되어 있었지만, 주변 모습은 달라져 있었습니다."),
  d("deneb", "default", "어떻게 달라졌나요?"),
  d("kaiden", "serious", "거리 곳곳에서 헌병들이 사람들을 붙잡고 조사하고 있었습니다. 학교 앞에도 감시하는 자들이 있었고요."),
  d("deneb", "serious", "학교로 가는 길이 막혀 있다고요..."),
  d("deneb", "serious", "카프가 위험해질 수도 있겠네요. 다시 만나러 가봐야겠어요."),
  d("kaiden", "default", "(플레이어 이름), 이번에는 주민들의 상황도 함께 확인하지. 무슨 일이 있었는지 알아야 안전하게 움직일 수 있다."),
  { id: "u3f3-offer-choice", type: "choice", options: [
    { id: "accept", label: "함께 조사하겠습니다.", nextStepId: "u3f3-offer-accept" },
    { id: "later", label: "잠시 준비하겠습니다.", nextStepId: "u3f3-offer-later" },
  ], advanceMode: "click" },
  // ① accepted (던전 3층 open) the moment it is chosen; ② ends the talk without accepting.
  { id: "u3f3-offer-accept", type: "checkpoint", checkpointId: UNIT3_FLOOR3_QUEST_ACCEPTED_CHECKPOINT, advanceMode: "auto" },
  d("kaiden", "default", "좋다. 주민들이 놀라지 않도록 조심해서 움직이지.", { next: "u3f3-offer-end" }),
  d("kaiden", "default", "준비가 끝나면 다시 오도록.", { id: "u3f3-offer-later", next: "u3f3-offer-end" }),
  { id: "u3f3-offer-end", type: "wait", durationMs: 0, advanceMode: "auto" },
], { dialogueSkip: false });

/** Short replayable camp lines while Floor 3 is in progress — script lines reused verbatim (none were scripted). */
export const UNIT3_FLOOR3_KAIDEN_ACTIVE_STORY = camp("unit3-floor3-kaiden-active", "카이든", [
  d("kaiden", "default", "(플레이어 이름), 이번에는 주민들의 상황도 함께 확인하지. 무슨 일이 있었는지 알아야 안전하게 움직일 수 있다."),
], { replayable: true });
export const UNIT3_FLOOR3_DENEB_ACTIVE_STORY = camp("unit3-floor3-deneb-active", "데네브", [
  d("deneb", "serious", "카프가 위험해질 수도 있겠네요. 다시 만나러 가봐야겠어요."),
], { replayable: true });
export const UNIT3_FLOOR3_DENEB_AFTER_STORY = camp("unit3-floor3-deneb-after", "데네브", [
  d("deneb", "default", "네. 각자 다음 작전을 위해 재정비하도록 해요."),
], { replayable: true });
export const UNIT3_FLOOR3_KAIDEN_AFTER_STORY = camp("unit3-floor3-kaiden-after", "카이든", [
  d("kaiden", "default", "수고했다, (플레이어 이름). 주민들이 안전한 길을 찾도록 도왔고, 카프도 데려왔군."),
], { replayable: true });

/* ---------------------------------------------------------------- 시작방 최초 입장 */
export const UNIT3_FLOOR3_START_STORY = sequence("unit3-floor3-start", "던전 3층 시작방", [
  stage("street", 900),
  wait(1500),
  n("거리의 사람들은 목소리를 낮추고 서둘러 걸어간다."),
  n("길목에서는 제복을 입고 칼을 찬 헌병이 주민들의 짐을 검사하고 있다."),
  d("resident", "default", "야, 약을 구하러 가는 길입니다. 가족이 기다리고 있으니 제발 보내 주시오!"),
  d("kenpei", "default", "조사가 끝날 때까지 움직이지 마라!"),
  d("deneb", "serious", "…1910년에 일제가 우리나라를 강제로 빼앗은 뒤의 모습 같아요."),
  d("kaiden", "default", "외교권을 빼앗는 데서 그치지 않고, 나라 전체를 지배하게 된 것이군요."),
  d("deneb", "serious", "네. 일제는 우리나라에 조선총독부를 세우고 우리나라를 식민지로 다스렸어요."),
  d("deneb", "serious", "우리나라 사람들이 나라의 중요한 일을 스스로 결정할 수 없게 된 거예요."),
  // 잠시 dialogue 숨김 → 카프 (아직 보이지 않음) → 카프 standing illust fade in
  stage("street", 300),
  wait(700),
  d("kaf", "default", "…이쪽으로 오세요. 그 길로 가면 붙잡힐 수 있어요."),
  stage("street-kaf", 800),
  d("deneb", "default", "카프..."),
  d("kaf", "default", "또 오셨군요. 학교 앞에서 부르시라고 했잖아요."),
  d("kaiden", "default", "그쪽 길이 막혀 있어서 돌아오던 참이다. 무슨 일이 있었나?"),
  d("kaf", "serious", "학교를 감시하는 자들이 늘었어요. 주민들도 마음대로 다니지 못하고 있고요."),
  d("kaf", "serious", "자세한 이야기는 사람이 적은 곳에서 하죠."),
  // 거리 illust fade out + 카프 standing illust fade out
  stage("none", 800),
]);

/* ---------------------------------------------------------------- 메인루트 중간 이벤트 방 (조선총독부) */
export const UNIT3_FLOOR3_MID_STORY = sequence("unit3-floor3-mid", "조선총독부", [
  stage("government", 900),
  d("kaf", "default", "...저 건물이 보이나요?"),
  d("kaf", "default", "경복궁 앞을 가로막고 있는 저 건물 말이에요."),
  d("deneb", "sad", "저건..."),
  d("deneb", "sad", "조선총독부...!?"),
  d("kaf", "angry", "맞아요. 조선총독부가 생기고, 우리 대한제국이 일제의 식민지가 되어버린 그 순간부터 일제는 이렇게 강압적으로 주민들을 괴롭히기 시작했어요."),
  d("kaf", "angry", "그 후로 일제 헌병경찰들이 사사건건 우리를 감시하고 있고, 아주 약간의 틈만 보이면 매질을 당하기도 한다고요!"),
  d("kaf", "angry", "어쩌다 이렇게 되었는지, 정말..."),
  d("kaf", "default", "어쨌든... 오늘은 학교에 오지 못한 아이들을 찾아보려 해요. 집으로 돌아가는 길이 막힌 사람들도 있고요."),
  d("deneb", "default", "저희도 함께 찾아볼게요."),
  d("kaf", "serious", "…왜 계속 도와주시려는 거죠?"),
  d("kaiden", "default", "지난번에도 말했듯, 자네를 걱정하고 있다. 어려움에 처한 사람들을 그냥 지나칠 수도 없고."),
  d("kaf", "default", "당신들은 도대체..."),
  d("kaf", "default", "…지난번에 학교를 지켜 주신 건 기억하고 있어요."),
  d("kaf", "default", "그럼 이번에도 부탁드릴게요. 다만 주민들에게 불필요한 질문은 하지 말아 주세요."),
  d("deneb", "default", "네. 먼저 어떤 도움이 필요한지 들어볼게요."),
  stage("none", 800),
]);

/* ---------------------------------------------------------------- 스토리 이벤트 방 1 · 2 · 3 */
const ROOM1 = sequence("unit3-floor3-room-1", "검문소 옆 골목", [
  stage("alley", 900),
  wait(1500),
  n("주민들이 검문소를 피해 담장 아래에 모여 있다."),
  d("resident", "default", "장에 다녀오는 길에도 붙잡아 세우니, 일을 제대로 할 수가 없소."),
  d("resident", "default", "사람들이 모여 이야기만 해도 무슨 일을 꾸미느냐고 묻는다오."),
  d("kaiden", "default", "군인들이 주민들의 생활까지 감시하고 있군."),
  d("deneb", "serious", "군대와 헌병 경찰의 힘을 앞세워 민족의 정신을 억누르려고 하는 게 분명해요."),
  d("resident", "default", "이제 우리는 어떻게 되는 거요?"),
  d("resident", "default", "나는 아무것도 안했단 말이오!"),
  stage("none", 800),
]);
const ROOM2 = sequence("unit3-floor3-room-2", "농민 가족의 집", [
  stage("farmers", 900),
  wait(1500),
  n("한 가족이 낡은 살림살이와 농기구를 보따리에 넣고 있다."),
  d("kaf", "default", "어디로 떠나시려는 건가요?"),
  d("farmer", "default", "농사짓는 형편이 갈수록 어려워져서 말이오. 다른 곳에서 일자리를 찾아보려 하오."),
  d("deneb", "default", "어떤 일이 있었나요?"),
  d("farmer", "default", "땅 주인은 따로 있고 우리는 농사를 짓는 처지요. 그런데 예전처럼 농사짓던 권리를 인정받기도 어려워졌소."),
  d("farmer", "default", "조선총독부에서 내 땅을 가져가질 않나, 세금을 더 내라고 하질 않나..."),
  d("farmer", "default", "땅을 빌려 쓰는 대가를 내고 나면 먹고살기가 빠듯하다오."),
  d("farmer", "default", "내 땅이었던 곳은 어느 일본 사람이 사 갔다는군. 생각만 해도 치가 떨린다네."),
  d("kaiden", "serious", "이건... ‘토지 조사 사업’이군."),
  d("kaiden", "serious", "일제가 조선의 땅을 조사하는 과정에서 땅을 빼앗기거나, 오랫동안 농사짓던 땅을 계속 이용할 권리를 잃은 사람들도 있었지."),
  d("deneb", "default", "살던 곳을 떠나 일자리를 구해야 하는 사람들도 생긴 것이군요."),
  d("farmer", "default", "우리 아이만이라도 학교에 계속 다니면 좋겠는데…"),
  d("kaf", "default", "…오늘 당장 모든 일을 해결해 드리지는 못하겠지만, 학교에 사정을 전할게요."),
  d("kaf", "default", "우선 길이 안전해질 때까지 다른 주민들과 함께 계세요."),
  n("카프는 가족의 짐을 비에 젖지 않는 처마 아래로 옮겨 준다."),
  stage("none", 800),
]);
const ROOM3 = sequence("unit3-floor3-room-3", "학교 교실", [
  stage("classroom", 900),
  wait(1500),
  n("학교 관계자가 몇 권의 책을 상자에 따로 담고 있다."),
  n("지난번 만났던 학생이 문 앞에서 기다리고 있다."),
  d("student", "default", "오늘도 수업을 못 하나요?"),
  d("official", "default", "당분간 기다려야겠구나. 학교에서 가르치는 내용까지 간섭하고 있으니…"),
  d("kaf", "serious", "…이 책들은 왜 치우시는 거죠?"),
  d("official", "default", "일제에서 우리 역사를 가르치는 것을 문제 삼고 있습니다. 학교를 계속 열기도 어려워지고 있어요."),
  d("deneb", "serious", "허리에 차고 계신 그 칼은..."),
  d("official", "default", "이것도 일제에서 차라고 한 것입니다... 수업할 때에는 이렇게 허리에 칼을 차고 있어야 해요. 학생들이 독립운동 같은 생각 못하도록요."),
  d("student", "default", "너무 무서워요... 저, 저는 그냥 우리나라에 도움이 되고 싶었을 뿐인데..."),
  d("student", "default", "이런 마음을 가지면 저는 살아남지 못하는 건가요...?"),
  d("kaf", "serious", "…"),
  n("카프가 학생의 손에 들린 책을 바라본다. 지난번 함께 옮겼던 책이다."),
  d("student", "default", "그래도, 이 책만큼은 제가 지킬거예요. 지난번에 다 같이 힘들게 가져왔잖아요."),
  d("kaf", "default", "...그렇게 해요."),
  d("official", "default", "아이들을 안전하게 집으로 보내야겠습니다. 길을 확인해 주시겠습니까?"),
  d("kaiden", "default", "호위하겠다. 함께 움직이지."),
  stage("none", 800),
]);
export const UNIT3_FLOOR3_STORY_ROOM_STORIES = [ROOM1, ROOM2, ROOM3] as const;

/* ---------------------------------------------------------------- 세 스토리 이벤트 완료 후 (다음 탐험 화면, 1회) */
export const UNIT3_FLOOR3_POST_EVENTS_STORY = sequence("unit3-floor3-post-events", "세 장소의 안전 확인", [
  d("kaf", "serious", "길을 막고, 살림을 어렵게 하고, 배우는 일까지 막고 있군요."),
  d("deneb", "default", "이곳 주민들의 생활은, 정말이지...끔찍하군요."),
  d("kaf", "default", "...아이들과 주민들이 안전하게 지나갈 때까지, 조금만 더 함께해 주실 수 있나요?"),
  d("deneb", "default", "물론이에요. 아마 카프가 부탁하지 않았더라도 그렇게 했을 거예요. 함께 가요."),
]);

/* ---------------------------------------------------------------- 마지막 방: 대피로 이벤트 맵 (segments) */
// The event map (Unit3Floor3EventMap) plays these between its scripted cues; no stage phases here.
const em = (id: string, steps: StoryStep[]) => sequence(id, "대피로", steps);
export const UNIT3_FLOOR3_EVENT_MAP_SEGMENTS = {
  intro: em("u3f3-em-intro", [
    n("주민들과 학생들이 샛길을 따라 이동한다."),
    n("마지막 사람이 지나갈 무렵, 뒤쪽 골목에서 검은 안개가 밀려온다."),
  ]),
  alarm: em("u3f3-em-alarm", [
    d("kaiden", "serious", "…던전의 기운입니다. 모두 앞쪽으로 이동하십시오!"),
    d("kaf", "serious", "아이들이 아직 가까이 있어요. 제가 뒤를 막을게요!"),
    d("deneb", "serious", "혼자 남지 말아요. 함께 막고 빠져나가죠!"),
  ]),
  holding: em("u3f3-em-holding", [
    d("kaiden", "default", "주민들은 모두 지나갔다! 이제 후퇴를!"),
    d("kaf", "serious", "…여러분부터 가세요. 저는 조금 더 버티다가—"),
    d("deneb", "serious", "안 돼요. 누군가를 두고 갈 수는 없어요."),
    d("deneb", "serious", "카프가 그랬잖아요. 혼자 두지 않겠다고."),
    d("deneb", "serious", "저도 같은 마음이에요."),
    d("kaf", "serious", "…혼자 두지 않는다…?"),
    n("데네브의 말에 카프가 잠시 고개를 돌린다."),
    d("kaf", "serious", "이 목소리…"),
  ]),
  // 회상 (2단원 데네브 구출 당시의 카프 · 원래 복장 초상화, 회상 UI)
  memory: em("u3f3-em-memory", [
    d("kafAcademy", "angry", "데네브, 우리는 이제 준비가 되었어요! 테오와 루나, 그리고 (플레이어 이름)까지 함께인걸요!"),
    d("kafAcademy", "angry", "다 함께라면 할 수 있어요!"),
    d("kafAcademy", "angry", "우리는 당신을 더 이상 혼자 두지 않을 거야!"),
  ]),
  flashback: em("u3f3-em-flashback", [
    d("deneb", "default", "카프, 저를 봐요. 지난번에는 카프가 저를 찾으러 왔어요."),
    d("deneb", "default", "이번에는 제가 데리러 왔어요. 함께 나가요."),
  ]),
  recognition: em("u3f3-em-recognition", [
    d("kafAcademy", "serious", "…데네브. 당신이군요."),
    d("kafAcademy", "serious", "(플레이어 이름), 카이든 경까지…"),
    d("kafAcademy", "serious", "제가 어떻게 당신들을…"),
  ]),
  // after "잠시 정적" (a timed pause in the event map)
  remembered: em("u3f3-em-remembered", [
    d("kafAcademy", "serious", "…전부 기억났어요, 데네브. 이번에는 당신이 저를 찾으러 와 줬군요."),
    d("deneb", "default", "네. 이제는 함께 돌아갈 차례예요."),
    d("kafAcademy", "default", "…고마워요."),
  ]),
  retreat: em("u3f3-em-retreat", [
    d("kaiden", "default", "이쪽으로! 모두 서둘러라!"),
  ]),
  safeAlley: em("u3f3-em-safe-alley", [
    d("kafAcademy", "serious", "카이든님… (플레이어 이름)."),
    d("kafAcademy", "serious", "저는 어드벤처 아카데미의 원정대원이었지요. 전부 기억나요."),
    d("kaiden", "default", "기억이 돌아와 다행이군, 카프."),
    d("kaiden", "default", "조금 더 늦었으면 던전의 영향을 더 깊이 받아 위험해질 뻔했어."),
    d("kafAcademy", "default", "던전에 들어온 뒤로 제가 이 시대 사람이라고 믿고 있었어요. 그전의 제 삶은 전혀 떠오르지 않았으니까요."),
    d("kafAcademy", "default", "여러분이 이상한 말을 한다고만 생각했죠."),
    d("deneb", "default", "던전이 만들어 낸 기억을 진짜라고 믿게 된 거예요. 이곳으로 빨려 들어온 다른 주민분들도 마찬가지일 거예요."),
    d("kafAcademy", "serious", "그러고 보니 아론, 테오, 루나가 보이지 않는데…"),
    d("kafAcademy", "serious", "…다른 세 사람도 저와 같은 상황인 걸까요?"),
    d("kaiden", "default", "그럴 가능성이 높지. 그들도 찾아야 한다."),
    d("student", "default", "카프님… 카프님도 떠나시는 건가요?"),
    d("kafAcademy", "default", "…네. 찾아야 할 사람들이 있어요."),
    d("official", "default", "여기까지 도와주셔서 고맙습니다. 학생들은 제가 잘 챙기겠습니다."),
    d("kafAcademy", "smile", "책은 잘 간직해 주세요. 다시 배울 수 있을 때까지요."),
    d("student", "default", "네. 저도 포기하지 않을게요."),
  ]),
} as const;

/* ---------------------------------------------------------------- 베이스캠프: 퀘스트 완료 (카이든) · 카프 기본 대화 */
export const UNIT3_FLOOR3_QUEST_COMPLETE_STORY = camp("unit3-floor3-quest-complete", "퀘스트 완료: 잊지 않은 약속", [
  d("kaiden", "default", "수고했다, (플레이어 이름). 주민들이 안전한 길을 찾도록 도왔고, 카프도 데려왔군."),
  d("deneb", "smile", "지난번에 함께 학교를 지킨 일도 헛되지 않았어요. 카프가 저희 말을 들어 줄 수 있는 시작이 되었으니까요."),
  d("kafAcademy", "default", "저를 찾아와 줘서 고마워요."),
  d("kafAcademy", "default", "이제 아론과 테오, 루나도 함께 찾아야죠."),
  d("deneb", "default", "네. 각자 다음 작전을 위해 재정비하도록 해요."),
]);
export const UNIT3_KAF_BASE_TALK_STORY = camp("unit3-kaf-base-talk", "카프", [
  d("kafAcademy", "default", "그때는 학교를 떠나면 모든 것을 잃는다고 생각했어요. 제게 다른 삶이 있었다는 걸 잊고 있었으니까요."),
  d("kafAcademy", "smile", "이제는 기억해요. 지켜야 할 동료들도, 함께 돌아갈 곳도요."),
], { replayable: true });

export const UNIT3_FLOOR3_ALL_STORIES: readonly StorySequence[] = [
  UNIT3_FLOOR3_QUEST_OFFER_STORY, UNIT3_FLOOR3_START_STORY, UNIT3_FLOOR3_MID_STORY, ...UNIT3_FLOOR3_STORY_ROOM_STORIES,
  UNIT3_FLOOR3_POST_EVENTS_STORY, ...Object.values(UNIT3_FLOOR3_EVENT_MAP_SEGMENTS), UNIT3_FLOOR3_QUEST_COMPLETE_STORY, UNIT3_KAF_BASE_TALK_STORY,
];
