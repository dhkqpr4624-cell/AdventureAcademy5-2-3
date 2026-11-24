import type { StoryActor, StorySequence, StoryStep } from "../../types/story";
import { CHAPTER3_STORY_ACTORS } from "./chapter3Actors";

/**
 * Unit 3 · Floor 1 dialogue — 「을사늑약과 항일 의병 운동」 / 퀘스트 「돌아갈 곳을 잊은 사람」.
 * Source: docs/chapter3/floor1-script-hotfix3.txt (Phase 2 Hotfix 3 revision; wording, speakers, expressions,
 * choices and scene order preserved — typos are reported, not rewritten).
 * Standing rule kept from Phase 2: the porter/민수 has no standing PNG, map sprite, base-camp NPC, name tag,
 * hover area or repeatable dialogue ("짐꾼 standing png 등장/fade out" lines are not shown; his portrait is used
 * in dialogue only). 민수 appears in the Floor 1 story and in the one-off first base-camp return cutscene.
 */
export const UNIT3_FLOOR1_STAGE_ID = "unit3-floor1-stage";

const asset = (path: string) => `${import.meta.env.BASE_URL}assets/chapter3/floor1/${path}`;

export const UNIT3_FLOOR1_ILLUST = {
  street: asset("illust/street-1905.png"),
  cart: asset("illust/fallen-cart.png"),
  cardHidden: asset("illust/academy-id-card-hidden.png"),
  cardRevealed: asset("illust/academy-id-card-revealed.png"),
  newspaper: asset("illust/newspaper-crowd.png"),
  militia: asset("illust/militia-supplies.png"),
  soldier: asset("illust/disbanded-soldier.png"),
  alley: asset("illust/dark-alley.png"),
} as const;

const portraitActor = (id: string, name: string, file: string, role = ""): StoryActor => ({
  id,
  name,
  role,
  accentColor: "#e9d7a8",
  defaultExpression: "default",
  portraits: {
    default: { imageUrl: asset(`portraits/${file}`), placeholder: { label: name, gradient: "linear-gradient(135deg,#30291f,#111)" } },
  },
});

const ACTORS: Record<string, StoryActor> = {
  deneb: CHAPTER3_STORY_ACTORS.deneb,
  kaiden: CHAPTER3_STORY_ACTORS.kaiden,
  resident: portraitActor("resident", "주민", "street-resident.png"),
  // '다른 주민' has its own portrait (Hotfix 3), separate from '주민'.
  resident2: portraitActor("resident2", "다른 주민", "street-resident-2.png"),
  porter: portraitActor("porter", "짐꾼", "porter.png"),
  // Same person after the reveal: only the speaker name changes (짐꾼 → 민수).
  minsu: portraitActor("minsu", "민수", "porter.png"),
  liaison: portraitActor("liaison", "의병 연락원", "militia-liaison.png"),
  soldier: portraitActor("soldier", "해산 군인", "korean-empire-soldier.png"),
};
type ActorId = keyof typeof ACTORS;

let auto = 0;
const nextId = (prefix: string) => `u3f1-${prefix}-${(auto += 1).toString().padStart(3, "0")}`;
const d = (actorId: ActorId, expression: string, text: string, opts: { id?: string; next?: string } = {}): StoryStep => ({
  id: opts.id ?? nextId(actorId), type: "dialogue", speakerId: actorId, speakerName: ACTORS[actorId].name,
  activeActorId: actorId, expression, text, nextStepId: opts.next, advanceMode: "click",
});
const n = (text: string, opts: { id?: string } = {}): StoryStep => ({ id: opts.id ?? nextId("narration"), type: "narration", text, advanceMode: "click" });
const wait = (durationMs: number): StoryStep => ({ id: nextId("wait"), type: "wait", durationMs, advanceMode: "auto" });
/** Stage phase of the Floor 1 illustration stage (see Unit3Floor1Stage); hides the dialogue box while it changes. */
const stage = (phase: string, durationMs = 750, stepId?: string): StoryStep => ({
  id: stepId ?? nextId(`stage-${phase}`), type: "setStagePhase", stageId: UNIT3_FLOOR1_STAGE_ID, phase, durationMs, hideDialogue: true, advanceMode: "auto",
});
const checkpoint = (checkpointId: string): StoryStep => ({ id: nextId(`cp-${checkpointId}`), type: "checkpoint", checkpointId, advanceMode: "auto" });

const sequence = (id: string, title: string, steps: StoryStep[], extra: Partial<StorySequence> = {}): StorySequence => ({
  id, title, replayable: false, skippable: false, dialogueSkip: true,
  onCompleteScreen: "dungeon", backgrounds: {}, actors: ACTORS,
  scenes: [{ id: `${id}-scene`, steps }],
  ...extra,
});

/* ---------------------------------------------------------------- A. 퀘스트 수령 (베이스캠프, 데네브) */
export const UNIT3_FLOOR1_QUEST_ACCEPTED_CHECKPOINT = "unit3-floor1-quest-accepted";
export const UNIT3_FLOOR1_QUEST_OFFER_STORY = sequence("unit3-floor1-quest-offer", "퀘스트 수령: 돌아갈 곳을 잊은 사람", [
  d("deneb", "default", "(플레이어 이름), 잠깐 이야기할 수 있을까요?"),
  d("kaiden", "default", "베이스캠프 설치는 끝났습니다. 하지만 본부와는 아직 연락이 닿지 않는군요."),
  d("deneb", "default", "다른 네 사람의 소식도 없어요. 아무래도 워프가 어긋난 것이 맞는 것 같군요."),
  d("kaiden", "angry", "안 그래도 위험한 던전 안에 들어와 있는데, 하필이면 동료와 떨어지다니..."),
  d("deneb", "default", "네 사람이라면 분명 괜찮겠지만... 무슨 일이 생길지 모르니 걱정되네요. 저희가 직접 찾아봐야겠요."),
  d("kaiden", "default", "앞쪽 길에서 짐수레 바퀴 자국을 발견했습니다. 사람이 오간 흔적도 있었고요."),
  d("deneb", "default", "…! 던전 안에 사람이 있다면, 어쩌면 그 사람들이 저희 동료들의 행방을 알고 있을 수도 있어요. 함께 가서 물어보죠."),
  { id: "u3f1-offer-choice", type: "choice", options: [
    { id: "accept", label: "함께 가겠습니다.", nextStepId: "u3f1-offer-accept" },
    { id: "later", label: "잠시 준비하겠습니다.", nextStepId: "u3f1-offer-later" },
  ], advanceMode: "click" },
  d("deneb", "smile", "고마워요. 작은 흔적이라도 발견하면 알려 주세요.", { id: "u3f1-offer-accept" }),
  checkpoint(UNIT3_FLOOR1_QUEST_ACCEPTED_CHECKPOINT),
  d("kaiden", "default", "내가 앞쪽을 살피겠다. 멀리 떨어지지 말도록.", { next: "u3f1-offer-end" }),
  d("deneb", "default", "네. 준비되면 다시 이야기해 주세요.", { id: "u3f1-offer-later", next: "u3f1-offer-end" }),
  { id: "u3f1-offer-end", type: "wait", durationMs: 0, advanceMode: "auto" },
], { onCompleteScreen: "baseCamp", dialogueSkip: false });

/** Short replayable reminders while the quest is active — lines reused verbatim from the accepted branch (no new dialogue). */
export const UNIT3_FLOOR1_ACTIVE_REMINDER_STORY = sequence("unit3-floor1-active-reminder", "던전 1층 조사", [
  d("deneb", "smile", "고마워요. 작은 흔적이라도 발견하면 알려 주세요."),
], { onCompleteScreen: "baseCamp", replayable: true });
export const UNIT3_FLOOR1_KAIDEN_ACTIVE_STORY = sequence("unit3-floor1-kaiden-active", "카이든", [
  d("kaiden", "default", "내가 앞쪽을 살피겠다. 멀리 떨어지지 말도록."),
], { onCompleteScreen: "baseCamp", replayable: true });

/* ---------------------------------------------------------------- B. 시작방 최초 입장 */
export const UNIT3_FLOOR1_CART_CRASH_CHECKPOINT = "unit3-floor1-cart-crash";
export const UNIT3_FLOOR1_START_STORY = sequence("unit3-floor1-start", "던전 1층 시작방", [
  stage("street", 900),
  wait(1500),
  n("낡은 상점들이 늘어선 거리에서 사람들이 신문을 둘러싸고 있다."),
  d("resident", "default", "일본이 우리 외교권을 빼앗았다니! 이대로 보고만 있어야 한단 말이오!"),
  d("resident2", "default", "다른 나라와 의논하고 약속하는 일까지 일본이 대신하겠다니, 말이 되오?"),
  d("deneb", "serious", "외교권을 빼앗겼다는 것은..."),
  d("deneb", "serious", "…을사늑약에 관한 이야기네요. 1905년에 일본이 강제로 대한제국의 외교권을 빼앗았던 일이죠."),
  d("kaiden", "default", "외교권은 다른 나라와 의논하거나 조약을 맺을 수 있는 권리이지요."),
  d("deneb", "default", "네. 그 권리를 빼앗겨 우리나라가 다른 나라와 자유롭게 외교를 할 수 없게 된 거예요."),
  // 잠시 dialogue 숨김 → 짐수레가 넘어지는 SFX (checkpoint)
  stage("street", 300),
  checkpoint(UNIT3_FLOOR1_CART_CRASH_CHECKPOINT),
  wait(900),
  d("porter", "default", "으악! 누가 좀 도와주시오!"),
  d("kaiden", "angry", "이 소리는..?!"),
  d("kaiden", "angry", "소리는 저쪽이다! 어서 가보지!"),
  stage("none", 800),
]);

/* ---------------------------------------------------------------- C. 메인 루트: 넘어진 짐수레 (전투 전/후) */
export const UNIT3_FLOOR1_CART_INTRO_STORY = sequence("unit3-floor1-cart-intro", "넘어진 짐수레", [
  stage("cart", 900),
  wait(1000),
  n("넘어진 짐수레 앞에 남자가 주저앉아 있다. 흩어진 짐 사이에서 검은 종이들이 솟아오른다."),
  d("porter", "default", "가까이 오지 마시오! 저것들이 또…!"),
  d("deneb", "angry", "저건...!"),
  d("deneb", "angry", "몬스터예요! 주민 분을 지켜야 합니다!"),
  d("kaiden", "angry", "(플레이어 이름), 전투 준비다!"),
  stage("none", 700),
]);

/* After the mandatory 먹물 든 을사늑약 문서 combat, back on the exploration screen (no standing PNG). */
export const UNIT3_FLOOR1_CART_AFTER_STORY = sequence("unit3-floor1-cart-after", "짐꾼 구출", [
  d("porter", "default", "살았군… 정말 고맙소."),
  d("deneb", "default", "다친 곳은 없나요?"),
  d("porter", "default", "괜찮소. 걱정해 주어 고맙네."),
  d("porter", "default", "그대들은 누구시오? 처음 보는 작자들인데."),
  d("porter", "default", "나는 의병에게 보낼 식량을 옮기던 참이었소."),
  d("kaiden", "default", "의병을 돕고 있었나."),
  d("deneb", "default", "의병...나라를 지키려고 스스로 모여 싸운 사람들 말이죠."),
  d("porter", "default", "그렇다네. 이번에 우리나라가 일본에게 외교권을 빼앗기지 않았나."),
  d("porter", "default", "이건 비밀인데, 분노한 시민들이 맞서 싸울 준비를 하고 있네. 이 식량들은 그 사람들을 위한 것이야."),
  d("porter", "default", "그대들이 없었다면 이 소중한 식량들을 잃어버릴 뻔했지."),
  n("남자가 떨어진 짐을 줍는다. 그때, 옷깃 안쪽에서 작은 카드가 떨어진다."),
  stage("card-hidden", 800),
  wait(600),
  d("kaiden", "serious", "잠깐. 그 카드는…"),
  d("deneb", "serious", "어드벤처 아카데미 본부 출입증이네요. 어디서 구하셨나요?"),
  d("porter", "default", "본부…? 커다란 건물에 물건을 배달하러 갔던 것 같기도…"),
  d("kaiden", "default", "혹시 저희가 사는 곳에서 오신 겁니까?"),
  d("porter", "default", "…아니, 무슨 소리요. 나는 태어날 때부터 이 마을에 살았소."),
  // 잠시 정적 (dialogue hidden, card stays)
  stage("card-hidden", 1200),
  d("deneb", "default", "..."),
  d("deneb", "default", "일단 짐을 옮기러 가죠. 저희도 함께하겠습니다."),
  d("porter", "default", "그래 주면 고맙겠소. 요즘은 길에 괴물이 나타나 혼자 다니기 어렵다오."),
  // 출입증 fade out (짐꾼 standing 미표시). The porter keeps the card and travels with the party (story events only).
  stage("none", 800),
]);

/* ---------------------------------------------------------------- D·E·F. 스토리 이벤트 방 (방문 순서 자유) */
const STORY_1 = sequence("unit3-floor1-story-1", "빼앗긴 외교권", [
  stage("newspaper", 900),
  wait(1500),
  d("resident", "default", "아니, 이게 무슨 말이야! 외교권을 빼앗겼다고?!"),
  d("resident", "default", "정녕 대한제국이 이런 터무니없는 조약에 동의했단 말인가!"),
  d("resident2", "default", "일본이 군대를 앞세워 위협하는데, 어떻게 제대로 반대할 수 있었겠소!"),
  d("kaiden", "default", "이곳 사람들도 을사늑약에 대해 이야기하고 있군요."),
  d("kaiden", "default", "주민들의 말을 들어보니, 대한제국이 원해서 맺은 조약이 아닌가 봅니다."),
  d("deneb", "serious", "네. 힘으로 강요해서 맺은 조약이죠. 그렇기 때문에 을사조약이 아니라 ‘을사늑약’이라고 불러요."),
  d("resident", "default", "그대들은 누구시오? 그쪽도 소식을 들었소? 우리가 무엇을 빼앗겼는지 알고 있소?"),
  { id: "u3f1-story1-choice", type: "choice", options: [
    { id: "diplomacy", label: "다른 나라와 의논하고 조약을 맺는 외교권입니다.", nextStepId: "u3f1-story1-right" },
    { id: "language", label: "우리말을 쓰고 배우는 권리입니다.", nextStepId: "u3f1-story1-wrong" },
  ], advanceMode: "click" },
  d("resident", "default", "그렇소. 우리나라의 뜻대로 외교를 할 수 없게 된 것이오.", { id: "u3f1-story1-right", next: "u3f1-story1-merge" }),
  d("deneb", "default", "이 사건에서 빼앗긴 것은 외교권이에요. 우리말 사용을 억누른 정책은 이후의 역사에서 나타나죠.", { id: "u3f1-story1-wrong", next: "u3f1-story1-merge" }),
  n("사람들이 신문을 돌려 읽으며 이야기를 나눈다.", { id: "u3f1-story1-merge" }),
  n("외교권을 빼앗긴 대한제국의 사람들에게서 서글픈 목소리만이 새어 나왔다."),
  stage("none", 800),
]);

const STORY_2 = sequence("unit3-floor1-story-2", "함께 지키려는 사람들", [
  stage("militia", 900),
  wait(1500),
  d("liaison", "default", "식량이 왔군! 기다리고 있었소."),
  n("농사짓는 사람, 글을 공부하던 선비, 사냥하던 포수가 함께 짐을 옮긴다."),
  d("kaiden", "default", "서로 다른 일을 하던 사람들이 모였군."),
  d("liaison", "default", "나라를 지키고 싶은 마음은 같으니까."),
  d("kaiden", "default", "여기서 무엇을 하고 있는 거지?"),
  d("liaison", "default", "우리는 일본군과 직접 싸우기도 하고, 식량과 약을 마련하기도 한다오."),
  d("liaison", "default", "최근엔 신돌석 대장과 함께 세력을 넓히고 있지."),
  d("deneb", "smile", "신돌석... 평민 출신의 의병장이죠. 태백산 호랑이라는 별명으로 불릴 정도의 사람이니, 확실히 그가 있으면 든든하겠어요."),
  d("liaison", "default", "그렇소. 신돌석 대장에 대해 잘 알고 있는 것을 보아하니, 그들도 우리 의병을 도우러 온 것이겠지?"),
  d("liaison", "default", "그렇다면 이 약재는 안쪽으로 옮겨 주겠소? 다친 이들이 기다리고 있소."),
  n("일행은 식량과 약재를 옮기는 일을 도왔다."),
  d("porter", "default", "휴, 여기는 대충 정리 되었군."),
  d("porter", "default", "이제 다음 배달 장소로…"),
  // 잠시 정적
  stage("militia", 1200),
  d("porter", "default", "이상하네. 이 일을 마치면 집으로 돌아가야 할 것 같은데."),
  d("deneb", "default", "집에서 기다리는 사람이 있나요?"),
  d("porter", "default", "있었던 것 같소."),
  d("porter", "default", "..."),
  d("porter", "default", "...그런데 얼굴이 떠오르지 않소."),
  stage("none", 800),
]);

const STORY_3 = sequence("unit3-floor1-story-3", "해산된 군인들", [
  stage("soldier", 900),
  wait(1500),
  n("군복을 입은 사람이 의병들에게 무기 다루는 법을 알려 주고 있다."),
  d("kaiden", "default", "대한제국의 군인인가?"),
  d("soldier", "default", "그랬지. 하지만 군대를 없애라는 명령을 받고 쫓겨났소."),
  d("deneb", "serious", "...일본은 대한제국의 군대를 강제로 해산시켰죠."),
  d("deneb", "serious", "이 때문에 대한제국의 군대는 사라지고 군인들을 흩어지게 되었어요."),
  d("soldier", "default", "잘 알고 있군... 우리는 갈 곳을 잃었소."),
  d("soldier", "default", "하지만, 그렇다고 나라를 지키는 일까지 그만둘 수는 없소. 우리는 이제 의병들과 함께 싸우려 하오."),
  d("kaiden", "default", "군사 훈련을 받은 사람들이 의병에 합류하니 큰 도움이 되겠군."),
  n("짐꾼이 군인들을 바라보다가 자신의 출입증을 꺼내 든다."),
  d("porter", "default", "…나는 언제부터 의병이 되었더라?"),
  d("kaiden", "serious", "...괜찮나?"),
  d("porter", "default", "자꾸 무언가 잊고 있는 것 같소. 무엇을 잊었는지도 모르겠소."),
  d("deneb", "default", "혼자 계시지 마세요. 저희와 함께 가요."),
  stage("none", 800),
]);

export const UNIT3_FLOOR1_STORY_ROOM_STORIES: readonly StorySequence[] = [STORY_1, STORY_2, STORY_3];

/* ---------------------------------------------------------------- G. 세 이벤트 완료 후 (다음 탐험 화면, 짐꾼은 떨어진 곳에서 짐 정리) */
export const UNIT3_FLOOR1_POST_EVENTS_STORY = sequence("unit3-floor1-post-events", "세 이벤트 완료 후", [
  d("kaiden", "serious", "데네브님, 저 사람은 본부 출입증을 가지고 있습니다. 우리 시대에서 살았던 기억도 있는 것 같고요."),
  d("deneb", "serious", "맞아요. 그런데 함께 다니는 동안 그 기억이 점점 흐려지고 있어요."),
  d("kaiden", "serious", "...어쩌면 그는..."),
  d("kaiden", "serious", "이 포탈에 삼켜진 주민일지도 모르겠습니다."),
  d("deneb", "serious", "네. 그리고 이 던전의 영향을 받아 현실 세계의 기억을 점점 잃어가고 있는 것이 분명해요."),
  d("deneb", "serious", "마치 과거의 인물인 것처럼..."),
  d("deneb", "serious", "그를 베이스캠프로 데려가야 합니다. 본부에서 그를 구출할 수 있게요."),
]);

/* ---------------------------------------------------------------- H. 마지막 방 (전투·보스 없음, 기억 회복) */
export const UNIT3_FLOOR1_FINAL_STORY = sequence("unit3-floor1-final", "돌아갈 곳을 잊은 사람", [
  stage("alley", 900),
  wait(1500),
  n("베이스캠프로 돌아가는 길에 남자가 걸음을 멈춘다."),
  d("porter", "default", "나는 여기 남겠소. 아직 날라야 할 짐이 있소."),
  d("deneb", "default", "오늘 맡으신 식량과 약재는 모두 전달하지 않았나요?"),
  d("deneb", "default", "날이 늦었으니, 저희와 함께 가요."),
  d("porter", "default", "하지만 여기가 내 고향이오. 이곳을 떠나면 어디로 가야 한단 말이오?"),
  d("kaiden", "serious", "가지고 계신 출입증을 다시 봐라. 그것은 분명 이 시대의 물건이 아니다."),
  stage("alley-card-hidden", 800),
  d("deneb", "default", "아까 집에 돌아가야 할 것 같다고 하셨죠. 누가 기다리고 있었나요?"),
  d("porter", "default", "기다리는 사람… 생각이 안 나오."),
  // 플레이어의 말 — story choice only (no right/wrong, no combat/score/reward effect); both continue to the same scene.
  { id: "u3f1-final-choice", type: "choice", options: [
    { id: "together", label: "서두르지 않아도 돼요. 함께 생각해 봐요.", nextStepId: "u3f1-final-merge" },
    { id: "morning", label: "아침에 집을 나설 때를 떠올려 보세요.", nextStepId: "u3f1-final-merge" },
  ], advanceMode: "click" },
  n("남자는 출입증을 꼭 쥐고 한동안 눈을 감는다.", { id: "u3f1-final-merge" }),
  d("porter", "default", "…작은 손이 내 손을 잡고 있었소."),
  d("porter", "default", "딸아이예요. 오늘은 일찍 오라고 했어요."),
  // 잠시 dialogue 숨김: 출입증의 검은 얼룩이 걷히며 이름 ‘민수’ 표시 + 골목의 검은 안개가 조금 옅어짐
  stage("alley-card-revealed", 2200),
  wait(500),
  d("porter", "default", "민수… 맞아요. 제 이름입니다. 저는 어드벤처 아카데미 본부에 물품을 배달하러 가던 사람이에요."),
  // 이후 이름을 ‘민수’로 표시
  d("minsu", "default", "하늘에 금이 생기더니 길이 사라졌습니다. 정신을 차렸을 때는 여기였어요."),
  d("minsu", "default", "처음에는 집에 돌아가려고 했는데, 어느 순간부터 제가 원래 이 마을의 짐꾼이라고 믿게 되었어요."),
  d("deneb", "serious", "원래 살던 곳의 기억이 사라지고, 이 마을 속 주민처럼 생활하게 되었다는 뜻인가요?"),
  d("minsu", "default", "네. 저는 이곳에 온 뒤로 제가 누군지도 모른 채 계속 짐만 나르고 있었습니다."),
  // 출입증 illust fade out (the alley stays, fog thinned)
  stage("alley-clear", 900),
  d("kaiden", "serious", "던전이 사람을 역사 속 인물처럼 살아가게 만드는 것 같습니다."),
  d("deneb", "serious", "던전에 빨려 들어온 사람들이 던전에 동화되는 거예요."),
  d("deneb", "serious", "어쩌면 카프, 아론, 테오, 그리고 루나도..."),
  d("kaiden", "default", "하지만 저 사람처럼 기억을 되찾을 수도 있습니다. 하루빨리 찾아 내야 합니다."),
  d("minsu", "default", "혹시 찾으시는 분들 중에 카프라는 분이 있습니까?"),
  d("deneb", "serious", "카프를 만났나요?"),
  d("minsu", "default", "예. 얼마 전에 갈 색머리 여성 의병에게 도움을 받은 적이 있습니다."),
  d("minsu", "default", "그때도 괴물에게 쫓기고 있었는데, 그 의병이 저를 도와줬어요."),
  d("minsu", "default", "그 의병에게 이름을 물었더니, 카프라고 대답하였습니다."),
  d("deneb", "default", "…갈색 머리 의병이라..."),
  d("kaiden", "default", "카프일 확률이 높습니다."),
  d("kaiden", "default", "우선 캠프로 돌아가서 재정비하지요."),
  d("kaiden", "default", "민수, 그대도 함께 가지."),
  stage("none", 900),
], { onCompleteScreen: "baseCamp" });

/* ---------------------------------------------------------------- I. 베이스캠프 최초 귀환 (일회성 컷신, 민수 초상화만) */
export const UNIT3_FLOOR1_BASE_CAMP_RETURN_STORY = sequence("unit3-floor1-base-camp-return", "베이스캠프 귀환", [
  d("minsu", "default", "여기서는 머리가 조금 맑아지는 것 같습니다."),
  d("kaiden", "default", "이 주변에는 던전의 기운을 막아 주는 보호 장치가 있습니다. 당분간 여기서 쉬십시오."),
  d("deneb", "default", "기억나는 것을 적어 두세요. 이름과 가족, 집에 관한 것들이요. 다시 잊지 않도록요."),
  d("minsu", "default", "네. 이번에는 꼭 기억하겠습니다."),
], { onCompleteScreen: "baseCamp" });

/* ---------------------------------------------------------------- J. 퀘스트 완료 (데네브) */
export const UNIT3_FLOOR1_QUEST_COMPLETE_STORY = sequence("unit3-floor1-quest-complete", "퀘스트 완료: 돌아갈 곳을 잊은 사람", [
  d("deneb", "default", "수고했어요, (플레이어 이름). 덕분에 현실세계의 주민 한 분을 무사히 구출했네요."),
  d("kaiden", "default", "포탈에 삼켜진 현실세계 사람들이 던전 안에 있다는 것도 확인했으니, 앞으로 만나는 사람들도 잘 살펴봐야겠군."),
  d("deneb", "default", "네. 다음에는 카프가 향했다는 곳을 조사해 보죠."),
  d("deneb", "default", "민수님이 이야기하시기에, 카프는 학교를 세우려는 사람들과 함께였다고 해요."),
  d("deneb", "default", "저희를 기억하지 못할 가능성도 있으니, 주의해야 합니다."),
  d("kaiden", "default", "(플레이어 이름), 출발 전에 충분히 휴식을 취하도록. 준비가 끝나면 다시 움직이지."),
], { onCompleteScreen: "baseCamp" });

/** Deneb / Kaiden after the quest is complete (short, replayable; quest-complete lines reused verbatim). */
export const UNIT3_FLOOR1_AFTER_COMPLETE_STORY = sequence("unit3-floor1-after-complete", "베이스캠프", [
  d("deneb", "default", "네. 다음에는 카프가 향했다는 곳을 조사해 보죠."),
], { onCompleteScreen: "baseCamp", replayable: true });

export const UNIT3_FLOOR1_KAIDEN_TALK_STORY = sequence("unit3-floor1-kaiden-talk", "카이든", [
  d("kaiden", "default", "(플레이어 이름), 출발 전에 충분히 휴식을 취하도록. 준비가 끝나면 다시 움직이지."),
], { onCompleteScreen: "baseCamp", replayable: true });

export const UNIT3_FLOOR1_ALL_STORIES: readonly StorySequence[] = [
  UNIT3_FLOOR1_QUEST_OFFER_STORY, UNIT3_FLOOR1_START_STORY, UNIT3_FLOOR1_CART_INTRO_STORY, UNIT3_FLOOR1_CART_AFTER_STORY,
  ...UNIT3_FLOOR1_STORY_ROOM_STORIES, UNIT3_FLOOR1_POST_EVENTS_STORY, UNIT3_FLOOR1_FINAL_STORY,
  UNIT3_FLOOR1_BASE_CAMP_RETURN_STORY, UNIT3_FLOOR1_QUEST_COMPLETE_STORY,
];
