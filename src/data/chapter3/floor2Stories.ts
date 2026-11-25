import type { StoryActor, StorySequence, StoryStep } from "../../types/story";
import { CHAPTER3_STORY_ACTORS } from "./chapter3Actors";

/**
 * Unit 3 · Floor 2 dialogue — 「일제 침략에 맞선 다양한 노력(애국계몽운동과 의거 활동)」 / 퀘스트 「우리를 잊은 동료」.
 * Source: docs/chapter3/floor2-script-phase3.txt (wording, speakers, expressions, choices and scene order
 * preserved; typos are reported, not rewritten). Stage directions and notes are never shown as dialogue.
 * - The player has no standing PNG. 카프 appears with the supplied period-costume standing illustration;
 *   she does not regain her memory, is never added to the party or the base camp, and stays at the school.
 * - 카프's activities are fiction: no real independence activist is named as her comrade and no target,
 *   time, method or comrade of her planned action is added beyond the script.
 */
export const UNIT3_FLOOR2_STAGE_ID = "unit3-floor2-stage";

const asset = (path: string) => `${import.meta.env.BASE_URL}assets/chapter3/${path}`;

export const UNIT3_FLOOR2_ILLUST = {
  street: asset("floor2/illust/school-street.png"),
  backstreet: asset("floor2/illust/school-backstreet.png"),
  classroom: asset("floor2/illust/school-classroom.png"),
  fundraising: asset("floor2/illust/debt-repayment.png"),
  harbin: asset("floor2/illust/harbin-news.png"),
  yard: asset("floor2/illust/school-yard.png"),
} as const;
/** 카프's period-costume standing illustration (843×1329, transparent). No blink sheet was supplied. */
export const UNIT3_FLOOR2_KAF_STANDING = asset("floor2/standing/kaf-period.png");

const portraitActor = (id: string, name: string, imageUrl: string): StoryActor => ({
  id, name, role: "", accentColor: "#e9d7a8", defaultExpression: "default",
  portraits: { default: { imageUrl, placeholder: { label: name, gradient: "linear-gradient(135deg,#30291f,#111)" } } },
});

const ACTORS: Record<string, StoryActor> = {
  deneb: CHAPTER3_STORY_ACTORS.deneb,
  kaiden: CHAPTER3_STORY_ACTORS.kaiden,
  // No period-costume portraits were supplied: 카프 keeps her existing expression portraits
  // (default / smile / serious / angry exist), the period costume is shown by the standing illustration.
  kaf: { ...CHAPTER3_STORY_ACTORS.kapp, id: "kaf", name: "카프", displayRole: undefined },
  official: portraitActor("official", "학교 관계자", asset("floor2/portraits/school-official.png")),
  student: portraitActor("student", "학생", asset("floor2/portraits/student.png")),
  // The dungeon-made enemy speaks before the fight; its supplied monster artwork doubles as the portrait.
  sycophant: portraitActor("sycophant", "아부쟁이 친일파", asset("floor2/monsters/sycophant.png")),
  // Same people as on Floor 1 (주민 / 다른 주민): their existing portraits are reused.
  resident: portraitActor("resident", "주민", asset("floor1/portraits/street-resident.png")),
  resident2: portraitActor("resident2", "다른 주민", asset("floor1/portraits/street-resident-2.png")),
};
type ActorId = keyof typeof ACTORS;

let auto = 0;
const nextId = (prefix: string) => `u3f2-${prefix}-${(auto += 1).toString().padStart(3, "0")}`;
const d = (actorId: ActorId, expression: string, text: string, opts: { id?: string; next?: string } = {}): StoryStep => ({
  id: opts.id ?? nextId(actorId), type: "dialogue", speakerId: actorId, speakerName: ACTORS[actorId].name,
  activeActorId: actorId, expression, text, nextStepId: opts.next, advanceMode: "click",
});
const n = (text: string, opts: { id?: string } = {}): StoryStep => ({ id: opts.id ?? nextId("narration"), type: "narration", text, advanceMode: "click" });
const wait = (durationMs: number): StoryStep => ({ id: nextId("wait"), type: "wait", durationMs, advanceMode: "auto" });
/** Stage phase of the Floor 2 illustration stage (see Unit3Floor2Stage); hides the dialogue box while it changes. */
const stage = (phase: string, durationMs = 750): StoryStep => ({
  id: nextId(`stage-${phase}`), type: "setStagePhase", stageId: UNIT3_FLOOR2_STAGE_ID, phase, durationMs, hideDialogue: true, advanceMode: "auto",
});
const checkpoint = (checkpointId: string): StoryStep => ({ id: nextId(`cp-${checkpointId}`), type: "checkpoint", checkpointId, advanceMode: "auto" });

const sequence = (id: string, title: string, steps: StoryStep[], extra: Partial<StorySequence> = {}): StorySequence => ({
  id, title, replayable: false, skippable: false, dialogueSkip: true,
  onCompleteScreen: "dungeon", backgrounds: {}, actors: ACTORS,
  scenes: [{ id: `${id}-scene`, steps }],
  ...extra,
});

/* ---------------------------------------------------------------- A. 퀘스트 수령 (베이스캠프, 데네브) */
export const UNIT3_FLOOR2_QUEST_ACCEPTED_CHECKPOINT = "unit3-floor2-quest-accepted";
export const UNIT3_FLOOR2_QUEST_OFFER_STORY = sequence("unit3-floor2-quest-offer", "퀘스트 수령: 우리를 잊은 동료", [
  d("deneb", "default", "(플레이어 이름), 민수님께 카프에 관한 이야기를 더 들었어요."),
  d("deneb", "default", "카프는 학교를 세우려는 사람들과 함께 있었다고 해요."),
  d("kaiden", "default", "학교로 이어지는 길을 확인했습니다. 책을 실은 수레도 그쪽으로 가고 있었습니다."),
  d("deneb", "serious", "카프도 민수님처럼 원래 기억을 잃었을 수 있어요. 저희를 알아보지 못할지도 모르죠."),
  d("kaiden", "default", "우선 만나서 상태를 확인하지. 갑자기 데려가려 하면 오히려 우리를 의심할 수도 있으니."),
  d("deneb", "default", "네. 먼저 카프의 이야기를 들어봐요."),
  { id: "u3f2-offer-choice", type: "choice", options: [
    { id: "accept", label: "카프를 찾으러 가겠습니다.", nextStepId: "u3f2-offer-accept" },
    { id: "later", label: "잠시 준비하겠습니다.", nextStepId: "u3f2-offer-later" },
  ], advanceMode: "click" },
  // ① accepted the moment it is chosen (checkpoint), then Deneb's line; ② ends without accepting.
  { id: "u3f2-offer-accept", type: "checkpoint", checkpointId: UNIT3_FLOOR2_QUEST_ACCEPTED_CHECKPOINT, advanceMode: "auto" },
  d("deneb", "smile", "고마워요. 출발하죠.", { next: "u3f2-offer-end" }),
  d("deneb", "default", "준비되면 다시 이야기해 주세요.", { id: "u3f2-offer-later", next: "u3f2-offer-end" }),
  { id: "u3f2-offer-end", type: "wait", durationMs: 0, advanceMode: "auto" },
], { onCompleteScreen: "baseCamp", dialogueSkip: false });

/** Short replayable lines while the quest is active / after it is completed — script lines reused verbatim. */
export const UNIT3_FLOOR2_ACTIVE_REMINDER_STORY = sequence("unit3-floor2-active-reminder", "던전 2층 조사", [
  d("deneb", "default", "네. 먼저 카프의 이야기를 들어봐요."),
], { onCompleteScreen: "baseCamp", replayable: true });
export const UNIT3_FLOOR2_KAIDEN_ACTIVE_STORY = sequence("unit3-floor2-kaiden-active", "카이든", [
  d("kaiden", "default", "우선 만나서 상태를 확인하지. 갑자기 데려가려 하면 오히려 우리를 의심할 수도 있으니."),
], { onCompleteScreen: "baseCamp", replayable: true });
export const UNIT3_FLOOR2_AFTER_COMPLETE_STORY = sequence("unit3-floor2-after-complete", "베이스캠프", [
  d("deneb", "default", "네. 카프는 오늘 함께 책을 지킨 일은 기억하겠다고 했어요."),
], { onCompleteScreen: "baseCamp", replayable: true });
export const UNIT3_FLOOR2_KAIDEN_TALK_STORY = sequence("unit3-floor2-kaiden-talk", "카이든", [
  d("kaiden", "default", "데네브님 말씀대로, 다른 동료들을 찾으면서 카프의 상태도 계속 살피도록 하죠."),
], { onCompleteScreen: "baseCamp", replayable: true });

/* ---------------------------------------------------------------- B. 시작방: 카프 발견 */
export const UNIT3_FLOOR2_SHOUT_CHECKPOINT = "unit3-floor2-offscreen-shout";
export const UNIT3_FLOOR2_START_STORY = sequence("unit3-floor2-start", "던전 2층 시작방", [
  stage("street", 900),
  wait(1500),
  n("사람들이 새 학교에 놓을 책상과 책을 나르고 있다."),
  n("수레 옆에는 갈색 머리의 여성이 서 있다."),
  stage("street-kaf", 800),
  d("deneb", "smile", "카프! 여기 있었군요!"),
  d("kaf", "serious", "…제 이름을 어떻게 아시죠?"),
  n("카프가 수레 앞으로 나서며 일행의 길을 막는다."),
  d("kaiden", "default", "우리를 알아보겠나? 어드벤처 아카데미에서 함께 출발하지 않았나."),
  d("kaf", "serious", "처음 듣는 이름이네요. 어디에서 오신 분들이죠?"),
  d("deneb", "default", "민수라는 분에게 이야기를 들었어요. 괴물에게 쫓기던 짐꾼을 도와주셨죠?"),
  d("kaf", "default", "…그분은 무사한가요?"),
  d("deneb", "default", "네. 저희 캠프에서 쉬고 계세요."),
  d("kaf", "serious", "…"),
  d("kaf", "serious", "다행이네요. 하지만 그분을 안다는 이유만으로 여러분을 믿을 수는 없어요."),
  d("kaf", "serious", "학교 설립을 돕는 사람들이 누구인지 알아내려고 일부러 접근하는 자들도 있거든요."),
  d("official", "default", "카프님, 무슨 일입니까?"),
  d("kaf", "default", "먼저 안으로 들어가 계세요. 제가 이야기하겠습니다."),
  // 잠시 dialogue 숨김 + 화면 바깥에서 사람이 외치는 소리 (checkpoint)
  stage("street-kaf", 300),
  checkpoint(UNIT3_FLOOR2_SHOUT_CHECKPOINT),
  wait(900),
  d("official", "default", "학교 뒤편에 수상한 자가 나타났습니다!"),
  d("kaf", "serious", "…! 모두 그 사람에게서 떨어지세요!"),
  // 학교 앞 거리 illust fade out + 카프 standing illust fade out
  stage("none", 800),
]);

/* ---------------------------------------------------------------- C. 메인 루트: 학교 뒷길 (필수 전투 전/후) */
export const UNIT3_FLOOR2_SCHOOL_INTRO_STORY = sequence("unit3-floor2-school-intro", "학교 뒷길", [
  stage("backstreet", 900),
  n("학교 앞에서 한 남자가 상자를 뒤지고 있다."),
  n("남자의 발밑에서는 검은 기운이 피어오른다."),
  d("sycophant", "default", "이런 책으로 아이들에게 무슨 생각을 가르치려는 거지?"),
  d("sycophant", "default", "학교를 돕는 자들의 이름까지 모두 알리면, 일본 관리께서 크게 칭찬하시겠군!"),
  d("official", "default", "그만두시오! 아이들이 읽을 책이오!"),
  d("kaf", "angry", "그 상자에서 손 떼세요. 사람들도 건드리지 마시고요."),
  d("sycophant", "default", "네가 이들을 지키던 자로군! 너도 함께 끌고 가면 되겠어!"),
  d("kaf", "angry", "큭, 어쩔 수 없네요."),
  d("kaf", "angry", "맞서 싸우겠습니다! 모두 전투 태세를!"),
  d("kaiden", "shout", "우리도 돕겠다!"),
  d("kaiden", "shout", "(플레이어 이름), 전투 준비!"),
  stage("none", 700),
]);

/** After the mandatory 아부쟁이 친일파 combat, back on the exploration screen with 카프's standing illustration. */
export const UNIT3_FLOOR2_SCHOOL_AFTER_STORY = sequence("unit3-floor2-school-after", "학교를 지킨 뒤", [
  stage("kaf", 800),
  n("남자는 검은 연기로 흩어진다. 카프는 사람들과 책을 차례로 확인한다."),
  d("kaf", "default", "…다친 분은 없네요. 책도 무사하고요."),
  d("deneb", "default", "카프, 당신은 괜찮나요?"),
  d("kaf", "default", "네. 저도 무사해요."),
  d("kaf", "default", "신세를 졌네요. 덕분에 이곳을 지킬 수 있었어요."),
  d("deneb", "default", "이곳은.. 새로 설립하는 학교인가요?"),
  d("kaf", "smile", "맞아요. 대한제국 사람들의 애국심을 불러일으키고 대한제국이라는 나라를 부강하게 하려면, 교육이 필요하니까요."),
  d("kaf", "smile", "그래서 학교를 세우고 있었던 거예요."),
  d("deneb", "default", "...그러면 저희도 돕지 않을 수 없겠네요."),
  d("kaiden", "default", "남은 책도 함께 옮기지."),
  d("kaf", "serious", "당신들은..."),
  d("kaf", "serious", "...고마워요."),
  d("kaf", "serious", "…그럼 책을 옮기는 일만 부탁드릴게요. 제가 안내하는 길로 움직여 주세요."),
  d("kaf", "serious", "그렇지만 아직 완전히 당신들을 믿는 건 아니에요. 학교를 돕는 분들의 이름이나 다른 일은 말씀드릴 수 없어요."),
  d("deneb", "smile", "네. 이해해요."),
  // 카프 standing illust fade out — she travels with the party only to carry the books (no party member, no map sprite).
  stage("none", 800),
]);

/* ---------------------------------------------------------------- D·E·F. 스토리 이벤트 방 (방문 순서 자유) */
const STORY_1 = sequence("unit3-floor2-story-1", "새로운 학교의 교실", [
  stage("classroom", 900),
  wait(1500),
  n("열린 교실 문 너머로 사람들이 책상을 옮기고, 먼지를 닦는 모습이 보인다."),
  d("official", "default", "책은 여기 놓아 주십시오. 덕분에 수업 준비가 한결 빨라지겠습니다."),
  n("한 학생이 다가와 책 상자 안을 조심스럽게 들여다본다."),
  d("student", "default", "선생님, 저도 책을 옮겨도 될까요?"),
  d("official", "default", "그럼. 무겁지 않게 조금씩 가져가거라."),
  n("학생은 책 두 권을 꺼내 품에 안는다. 그중 한 권의 모서리가 구겨진 것을 보고 손으로 펴 준다."),
  d("kaf", "default", "책이 마음에 드나요?"),
  d("student", "default", "네! 집에서는 책이 귀해서 마음껏 읽어 보지 못했거든요."),
  d("student", "default", "여기 있는 책을 다 읽으려면 오래 걸리겠죠?"),
  d("student", "default", "저도 어서 똑똑해져서, 우리나라에 도움이 되고 싶어요!"),
  d("kaf", "smile", "서두를 필요 없어요. 한 권씩 읽어 가면 되니까요."),
  d("student", "default", "그럼 내일도 와서 정리하는 걸 도울게요!"),
  n("학생이 책을 들고 교실 안으로 들어간다. 카프는 잠시 그 뒷모습을 바라본다."),
  d("deneb", "smile", "무척 기다렸던 책인가 봐요."),
  d("kaf", "default", "…네. 저 아이는 학교가 언제 문을 여는지 매일 물으러 와요."),
  d("kaf", "default", "그러니 책이 오는 길을 막는 자들을 그냥 둘 수는 없죠."),
  d("kaiden", "default", "오늘 함께 옮긴 보람이 있군."),
  d("kaf", "default", "…도와주신 건 고맙게 생각해요."),
  n("카프는 짧게 고개를 숙인 뒤, 다시 문밖을 살핀다."),
  stage("none", 800),
]);

export const UNIT3_FLOOR2_FOOTSTEPS_CHECKPOINT = "unit3-floor2-footsteps";
const STORY_2 = sequence("unit3-floor2-story-2", "국채 보상 운동 모금 현장", [
  stage("fundraising", 900),
  wait(1500),
  n("사람들이 돈과 장신구를 모으고 있다. 한 주민이 작은 돈주머니를 내놓는다."),
  d("resident", "default", "담배를 끊고 모은 돈이오. 나라의 빚을 갚는 데 보태 주시오."),
  d("kaiden", "default", "나라의 빚을 주민들이 함께 갚으려는 건가?"),
  d("resident", "default", "그렇소. 일본이 빚을 구실로 우리나라 일에 간섭하고 있으니, 우리 힘으로 갚아 보려는 것이오."),
  d("deneb", "default", "이건..."),
  d("deneb", "default", "‘국채 보상 운동’이네요. 일제에 진 빚을 갚아서 경제적으로 자립하려고 하는 노력이죠."),
  d("resident2", "default", "우리 집에서도 비녀와 가락지를 가져왔소. 적은 돈이라도 함께 모으면 힘이 되겠지."),
  d("kaf", "default", "모두 각자 할 수 있는 일을 하고 있군요."),
  d("resident", "default", "그대들은 어디로 가는 길이오?"),
  // Story choice (not a combat question): both answers merge.
  { id: "u3f2-story2-choice", type: "choice", options: [
    { id: "books", label: "학교에 보낼 책을 옮기고 있습니다.", nextStepId: "u3f2-story2-books" },
    { id: "comrade", label: "헤어진 동료를 찾고 있습니다.", nextStepId: "u3f2-story2-comrade" },
  ], advanceMode: "click" },
  d("resident", "default", "아이들이 배울 책이로군. 조심해서 옮겨 주시오.", { id: "u3f2-story2-books", next: "u3f2-story2-merge" }),
  d("kaf", "serious", "...", { id: "u3f2-story2-comrade" }),
  d("resident", "default", "걱정이 크겠소. 꼭 다시 만나기를 바라오.", { next: "u3f2-story2-merge" }),
  // 선택지 분기 합류 → 발소리 sfx
  { id: "u3f2-story2-merge", type: "checkpoint", checkpointId: UNIT3_FLOOR2_FOOTSTEPS_CHECKPOINT, advanceMode: "auto" },
  wait(700),
  d("kaf", "default", "...!"),
  n("가까운 골목에서 발소리가 들리자 카프가 대화를 멈추고 주위를 살핀다."),
  d("kaf", "serious", "…한곳에 오래 머물지는 않는 게 좋겠어요. 이제 가죠."),
  stage("none", 800),
]);

const STORY_3 = sequence("unit3-floor2-story-3", "안중근 의거 소식", [
  stage("harbin", 900),
  wait(1500),
  n("사람들이 중국 하얼빈에서 전해진 소식을 읽고 있다."),
  d("resident", "default", "안중근이라는 분이 이토 히로부미를 처단했다는군!"),
  d("deneb", "serious", "이토 히로부미.. 분명 우리나라를 침략하는 데 앞장섰던 인물이죠."),
  d("kaiden", "default", "맞습니다. 안중근 의사는 분명 1909년, 하얼빈역에서 이토 히로부미를 처단하였죠."),
  d("kaiden", "default", "지금 보고 있는 장면은 1909년의 장면인가 봅니다."),
  d("kaf", "serious", "당신들, 지금 무슨 말을 하고 있는거예요? 도저히 모르겠네요."),
  d("kaf", "serious", "…그나저나 안중근 의사... 붙잡힐 위험도 알고 계셨을 텐데. 큰 결심을 하셨군요."),
  d("deneb", "sad", "..."),
  d("deneb", "default", "카프도 비슷한 일을 생각하고 있나요?"),
  d("kaf", "serious", "…그건 왜 물으시죠?"),
  // 잠시 정적 (dialogue hidden, illustration stays)
  stage("harbin", 1200),
  d("deneb", "default", "걱정되어서 그래요. 위험한 일을 혼자 준비하고 있는 건 아닌가 해서요."),
  d("kaf", "serious", "제 일만으로 끝나는 문제가 아니에요. 함께하는 분들도 있으니까요."),
  d("kaf", "serious", "더는 묻지 말아 주세요."),
  d("kaiden", "default", "…책을 마저 옮기러 가지."),
  stage("none", 800),
]);

export const UNIT3_FLOOR2_STORY_ROOM_STORIES: readonly StorySequence[] = [STORY_1, STORY_2, STORY_3];

/* ---------------------------------------------------------------- G. 세 이벤트 완료 후 (카프는 떨어진 곳에서 책 상자 확인) */
export const UNIT3_FLOOR2_POST_EVENTS_STORY = sequence("unit3-floor2-post-events", "세 이벤트 완료 후", [
  d("kaiden", "serious", "데네브님, 카프는 학교를 돕는 일 외에도 무언가 준비하고 있는 것 같습니다."),
  d("deneb", "serious", "네. 의거를 준비하고 있을지도 몰라요. 하지만 아직 저희를 믿지 않는지, 쉽게 말해주지 않는군요."),
  d("kaiden", "default", "아직 기억이 돌아오지 않았습니다. 계속 캐물으면 더 경계할 겁니다."),
  d("deneb", "default", "우선 맡은 일을 함께 끝내요. 저희가 카프를 도우러 왔다는 것부터 보여 줘야겠어요."),
]);

/* ---------------------------------------------------------------- H. 마지막 방: 학교 마당 (전투·보스 없음) */
export const UNIT3_FLOOR2_FINAL_STORY = sequence("unit3-floor2-final", "우리를 잊은 동료", [
  stage("yard", 900),
  wait(1500),
  n("마지막 책 상자가 학교에 도착했다. 학생들이 달려와 책을 나누어 옮긴다."),
  d("official", "default", "모두 무사히 도착했군요. 도와주셔서 고맙습니다."),
  // The script fades 카프's standing illustration out later in this scene without a fade-in line:
  // she appears with her first line here (reported as an ambiguous direction).
  stage("yard-kaf", 700),
  d("kaf", "default", "안쪽 정리는 부탁드릴게요. 저는 이분들과 잠깐 이야기하겠습니다."),
  n("사람들이 학교 안으로 들어가자, 카프가 일행을 돌아본다."),
  d("kaf", "default", "오늘 도와주신 일은 잊지 않겠어요. 이제 돌아가셔도 됩니다."),
  d("deneb", "default", "..."),
  d("deneb", "default", "카프, 부탁이 있어요. 저희가 도와드린 대가라고 생각해주세요."),
  d("deneb", "default", "부디 저희와 함께 가주세요. 당신에게 해야 할 이야기가 있습니다."),
  d("kaf", "serious", "…왜 저를 데려가려고 하시죠?"),
  d("kaiden", "default", "자네가 우리가 찾던 동료이기 때문이다."),
  d("kaf", "serious", "...아까부터 정말 이상한 말만 하는군요!"),
  d("kaf", "angry", "여러분은 그렇게 말씀하시지만, 저는 여러분을 기억하지 못해요."),
  d("kaf", "angry", "도와주신 건 고맙지만, 처음 만난 사람을 따라 모르는 곳으로 갈 수는 없어요."),
  d("kaf", "default", "저는 이곳에서 해야 할 일이 있어요. 학교도 지켜야 하고…"),
  // 잠시 정적
  stage("yard-kaf", 1200),
  d("kaf", "serious", "일제의 침략에 직접 맞서려는 동료들도 있어요. 저도 그분들과 행동할 준비를 하고 있다고요."),
  d("kaf", "serious", "자세한 이야기는 할 수 없어요. 제가 자리를 비웠다가 다른 분들까지 위험해질 수 있으니까요."),
  d("deneb", "serious", "역시, 의거를 준비하고 있었군요."),
  d("kaf", "default", "사람들이 배울 수 있도록 돕는 것도, 침략에 맞서는 것도 나라를 지키기 위한 일이에요."),
  d("kaf", "default", "어느 쪽도 쉽게 그만둘 수는 없어요."),
  d("deneb", "default", "정말이지, 카프답군요."),
  d("deneb", "default", "알겠어요. 억지로 데려가지는 않을게요. 다만 저희가 카프를 걱정하고 있다는 건 알아주세요."),
  d("deneb", "default", "저희가 당신을 적극적으로 돕고 싶다는 것도요."),
  // 플레이어의 말 — story choice only (no right/wrong, no combat/score/reward effect).
  { id: "u3f2-final-choice", type: "choice", options: [
    { id: "remember", label: "오늘 함께 학교를 지킨 일은 기억해 주세요.", nextStepId: "u3f2-final-remember" },
    { id: "visit", label: "다시 만나러 와도 괜찮을까요?", nextStepId: "u3f2-final-visit" },
  ], advanceMode: "click" },
  d("kaf", "default", "…그 일은 기억하겠어요. 여러분이 위험을 무릅쓰고 도와주셨으니까요.", { id: "u3f2-final-remember", next: "u3f2-final-merge" }),
  d("kaf", "default", "학교 앞에서 저를 불러 주세요. 다른 분들에게 제 일을 물어보고 다니지는 마시고요.", { id: "u3f2-final-visit", next: "u3f2-final-merge" }),
  d("deneb", "default", "네. 다음에는 먼저 카프를 찾을게요.", { id: "u3f2-final-merge" }),
  d("kaf", "default", "…돌아가는 길 조심하세요."),
  n("카프는 일행이 떠나는 모습을 지켜본다. 도움을 받은 것은 인정했지만, 끝까지 경계를 풀지는 않았다."),
  // 카프 standing illust fade out (she stays at the school)
  stage("yard", 800),
  d("deneb", "serious", "…카프는 이곳에서 해야 할 일이 자신의 전부라고 믿고 있네요."),
  d("kaiden", "default", "저희와 함께했던 기억이 없으니 그럴 겁니다. 돌아가서 다른 방법을 생각해 보죠."),
  d("deneb", "default", "네. 반드시 다시 만나러 올 거예요."),
  stage("none", 900),
], { onCompleteScreen: "baseCamp" });

/* ---------------------------------------------------------------- I. 퀘스트 완료 (데네브) */
export const UNIT3_FLOOR2_QUEST_COMPLETE_STORY = sequence("unit3-floor2-quest-complete", "퀘스트 완료: 우리를 잊은 동료", [
  d("deneb", "default", "수고했어요, (플레이어 이름). 카프가 있는 곳과 지금 어떤 상태인지 확인했네요."),
  d("kaiden", "serious", "카프는 자신을 이 시대의 독립운동가라고 믿고 있습니다. 기억은 아직 돌아오지 않았지요."),
  d("deneb", "serious", "카프가 중요한 일을 준비중이라는 것은 알지만, 이대로 두면 카프가 던전에 완전히 동화되어 버릴 수 있어요. 하루빨리 카프의 기억을 복구시켜야 합니다."),
  d("kaiden", "default", "데네브님 말씀대로, 다른 동료들을 찾으면서 카프의 상태도 계속 살피도록 하죠."),
  d("deneb", "default", "네. 카프는 오늘 함께 책을 지킨 일은 기억하겠다고 했어요."),
  d("deneb", "default", "그러니까... 그 일을 시작으로 조금씩 믿음을 쌓아 가요."),
], { onCompleteScreen: "baseCamp" });

export const UNIT3_FLOOR2_ALL_STORIES: readonly StorySequence[] = [
  UNIT3_FLOOR2_QUEST_OFFER_STORY, UNIT3_FLOOR2_START_STORY, UNIT3_FLOOR2_SCHOOL_INTRO_STORY, UNIT3_FLOOR2_SCHOOL_AFTER_STORY,
  ...UNIT3_FLOOR2_STORY_ROOM_STORIES, UNIT3_FLOOR2_POST_EVENTS_STORY, UNIT3_FLOOR2_FINAL_STORY, UNIT3_FLOOR2_QUEST_COMPLETE_STORY,
];
