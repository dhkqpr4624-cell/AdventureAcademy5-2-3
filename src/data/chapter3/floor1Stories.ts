import type { StoryActor, StorySequence, StoryStep } from "../../types/story";
import { CHAPTER3_STORY_ACTORS } from "./chapter3Actors";

/**
 * Unit 3 · Floor 1 dialogue (원문: docs/chapter3/floor1-original-script.txt — wording preserved).
 * Phase 2 overrides applied to the original script:
 * - the porter/민수 has no standing PNG, map sprite, base-camp NPC or base-camp dialogue
 *   ("짐꾼 standing png 등장/fade out" lines are omitted; his portrait is used in dialogue only);
 * - Event I (first base-camp return) is a short narration that 민수 was escorted to a protected area;
 * - the persistent 민수 basic dialogue (Event K) is removed.
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
  resident2: portraitActor("resident2", "다른 주민", "street-resident.png"),
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
  d("kaiden", "default", "베이스캠프 설치는 끝났습니다. 다만 본부와는 아직 통신이 연결되지 않는군요."),
  d("deneb", "default", "다른 네 사람의 소식도 아직 없어요. 직접 찾아봐야겠네요."),
  d("kaiden", "default", "앞쪽 길에서 짐수레 바퀴 자국을 발견했습니다. 사람이 오간 흔적도 있었고요."),
  d("deneb", "default", "사람들이 있다면 동료들을 보았을 수도 있겠어요. 함께 조사해 보죠."),
  { id: "u3f1-offer-choice", type: "choice", options: [
    { id: "accept", label: "함께 가겠습니다.", nextStepId: "u3f1-offer-accept" },
    { id: "later", label: "잠시 준비하겠습니다.", nextStepId: "u3f1-offer-later" },
  ], advanceMode: "click" },
  d("deneb", "smile", "고마워요. 무언가 발견하면 바로 알려 주세요.", { id: "u3f1-offer-accept" }),
  checkpoint(UNIT3_FLOOR1_QUEST_ACCEPTED_CHECKPOINT),
  d("kaiden", "default", "내가 앞쪽을 살피겠다. 멀리 떨어지지 않도록.", { next: "u3f1-offer-end" }),
  d("deneb", "default", "네. 준비되면 다시 이야기해 주세요.", { id: "u3f1-offer-later", next: "u3f1-offer-end" }),
  { id: "u3f1-offer-end", type: "wait", durationMs: 0, advanceMode: "auto" },
], { onCompleteScreen: "baseCamp", dialogueSkip: false });

/** Short replayable reminders while the quest is active — lines reused verbatim from the script (no new dialogue). */
export const UNIT3_FLOOR1_ACTIVE_REMINDER_STORY = sequence("unit3-floor1-active-reminder", "던전 1층 조사", [
  d("deneb", "default", "사람들이 있다면 동료들을 보았을 수도 있겠어요. 함께 조사해 보죠."),
], { onCompleteScreen: "baseCamp", replayable: true });
export const UNIT3_FLOOR1_KAIDEN_ACTIVE_STORY = sequence("unit3-floor1-kaiden-active", "카이든", [
  d("kaiden", "default", "내가 앞쪽을 살피겠다. 멀리 떨어지지 않도록."),
], { onCompleteScreen: "baseCamp", replayable: true });

/* ---------------------------------------------------------------- B. 시작방 최초 입장 */
export const UNIT3_FLOOR1_CART_CRASH_CHECKPOINT = "unit3-floor1-cart-crash";
export const UNIT3_FLOOR1_START_STORY = sequence("unit3-floor1-start", "던전 1층 시작방", [
  stage("street", 900),
  wait(1500),
  n("낡은 상점들이 늘어선 거리에서 사람들이 신문을 둘러싸고 있다."),
  d("resident", "default", "일본이 우리 외교권을 빼앗았다니! 이대로 보고만 있어야 한단 말이오!"),
  d("resident2", "default", "다른 나라와 교섭하는 일까지 일본이 맡겠다는 것 아니겠소."),
  d("deneb", "serious", "…을사늑약에 관한 이야기네요. 일본이 강제로 대한제국의 외교권을 빼앗은 사건이에요."),
  d("kaiden", "default", "이곳은 1905년 무렵의 역사를 보여 주는 것 같군요."),
  d("deneb", "default", "네. 먼저 사람들의 이야기를 들어보죠. 동료들의 소식도 물어보고요."),
  stage("street", 300),
  checkpoint(UNIT3_FLOOR1_CART_CRASH_CHECKPOINT),
  wait(900),
  d("porter", "default", "으악! 누가 좀 도와주시오!"),
  d("kaiden", "angry", "소리는 저쪽이다! 어서 가보지!"),
  stage("none", 800),
]);

/* ---------------------------------------------------------------- C. 메인 루트: 넘어진 짐수레 (전투 전/후) */
export const UNIT3_FLOOR1_CART_INTRO_STORY = sequence("unit3-floor1-cart-intro", "넘어진 짐수레", [
  stage("cart", 900),
  wait(1000),
  n("넘어진 짐수레 앞에 남자가 주저앉아 있다. 흩어진 짐 사이에서 검은 종이들이 솟아오른다."),
  d("porter", "default", "가까이 오지 마시오! 저것들이 또…!"),
  d("kaiden", "angry", "(플레이어 이름), 전투 준비다!"),
  stage("none", 700),
]);

export const UNIT3_FLOOR1_CART_AFTER_STORY = sequence("unit3-floor1-cart-after", "짐꾼 구출", [
  d("porter", "default", "살았군… 정말 고맙소."),
  d("deneb", "default", "다친 곳은 없나요?"),
  d("porter", "default", "괜찮소. 의병에게 보낼 식량을 옮기던 참이었소. 주막에서 기다릴 텐데…"),
  n("남자가 서둘러 짐을 줍는다. 그때, 옷깃 안쪽에서 작은 카드가 떨어진다."),
  stage("card-hidden", 800),
  wait(600),
  d("kaiden", "serious", "잠깐. 그 카드는…"),
  d("deneb", "serious", "어드벤처 아카데미의 본부 출입증이네요. 어디서 구하셨나요?"),
  d("porter", "default", "본부…? 그러고 보니 물건을 배달하러 갔던 것 같기도…"),
  d("kaiden", "default", "저희가 있는 본부 말입니까?"),
  d("porter", "default", "…아니, 무슨 소리요. 나는 원래 이 마을의 짐꾼이오."),
  stage("card-hidden", 1200),
  d("deneb", "default", "일단 안전한 곳으로 가죠. 저희도 주막까지 함께 가겠습니다."),
  d("porter", "default", "그래 주면 고맙겠소. 요즘은 길도 자꾸 막혀서 말이오."),
  stage("none", 800),
]);

/* ---------------------------------------------------------------- D·E·F. 스토리 이벤트 방 (방문 순서 자유) */
const STORY_1 = sequence("unit3-floor1-story-1", "빼앗긴 외교권", [
  stage("newspaper", 900),
  wait(1500),
  d("resident", "default", "우리나라의 일을 다른 나라가 대신 정한다니, 기가 막힐 일이오."),
  d("porter", "default", "주막에서도 이 이야기뿐이었소. 다들 분해서 잠을 못 잔다더군."),
  d("kaiden", "default", "사람들이 받아들인 약속은 아니었던 거군요."),
  d("deneb", "serious", "네. 힘으로 강요된 것이었어요. 그래서 ‘을사늑약’이라고 부르죠."),
  d("resident", "default", "그쪽도 소식을 들었소? 무엇을 빼앗겼다는 건지 알고 있소?"),
  { id: "u3f1-story1-choice", type: "choice", options: [
    { id: "diplomacy", label: "다른 나라와 교섭하고 조약을 맺는 외교권입니다.", nextStepId: "u3f1-story1-right" },
    { id: "language", label: "우리말을 쓰고 배우는 권리입니다.", nextStepId: "u3f1-story1-wrong" },
  ], advanceMode: "click" },
  d("resident", "default", "그렇소. 우리나라의 뜻을 다른 나라에 전하는 일까지 막힌 것이오.", { id: "u3f1-story1-right", next: "u3f1-story1-merge" }),
  d("deneb", "default", "이 사건에서 빼앗긴 것은 외교권이에요. 우리말에 대한 억압은 이 이후의 역사이죠.", { id: "u3f1-story1-wrong", next: "u3f1-story1-merge" }),
  n("사람들이 신문을 돌려 읽으며 저마다 들은 소식을 나눈다.", { id: "u3f1-story1-merge" }),
  d("porter", "default", "신문… 나도 매일 아침 어느 건물 앞에서 봤는데."),
  d("kaiden", "default", "어떤 건물이었습니까?"),
  d("porter", "default", "이상하오. 분명 아는 곳인데… 생각이 안 나오."),
  stage("none", 800),
]);

const STORY_2 = sequence("unit3-floor1-story-2", "함께 지키려는 사람들", [
  stage("militia", 900),
  wait(1500),
  d("liaison", "default", "식량을 가져왔군! 기다리고 있었소."),
  n("농민과 유생, 포수들이 쌀자루와 옷가지, 약재를 함께 나른다."),
  d("kaiden", "default", "무기를 든 사람들만 있는 것은 아니군요."),
  d("liaison", "default", "싸우는 이도 있어야 하고, 먹을 것과 소식을 전하는 이도 있어야 하지 않겠소."),
  d("deneb", "default", "평민 출신 의병장 신돌석처럼, 여러 사람들이 나라를 지키려 나섰어요."),
  d("liaison", "default", "이 약재는 안쪽에 놓아 주겠소? 다친 이들이 기다리고 있소."),
  n("일행은 식량과 약재를 옮기는 일을 도왔다."),
  d("porter", "default", "이제 다음 배달 장소로…"),
  stage("militia", 1200),
  d("porter", "default", "배달…? 내가 방금 뭐라고 했소?"),
  d("deneb", "default", "원래 하시던 일이 떠오른 건가요?"),
  d("porter", "default", "모르겠소. 이런 일을 마치면 집으로 돌아갔던 것 같은데…"),
  d("porter", "default", "기다리는 사람의 얼굴이 떠오르지 않소."),
  stage("none", 800),
]);

const STORY_3 = sequence("unit3-floor1-story-3", "해산된 군인들", [
  stage("soldier", 900),
  wait(1500),
  n("군복을 입은 사람이 의병들에게 무기 다루는 법을 알려 주고 있다."),
  d("kaiden", "default", "대한제국 군인입니까?"),
  d("soldier", "default", "…군대가 해산되었으니, 이제는 그렇게 부를 수 있을지 모르겠소."),
  d("deneb", "serious", "이번에는 1907년의 기록이네요. 일본은 대한제국의 군대도 강제로 해산시켰어요."),
  d("soldier", "default", "그렇다고 나라를 지키는 일까지 그만둘 수는 없소. 뜻을 함께하는 이들과 싸움을 이어 갈 것이오."),
  d("kaiden", "default", "훈련받은 군인들이 의병에 합류한 것이군요."),
  d("deneb", "default", "네. 의병의 전투력도 강화되었죠."),
  n("남자는 떠나는 군인들을 바라보다가 자신의 출입증을 꺼내 든다."),
  d("porter", "default", "…나는 언제부터 여기 있었지?"),
  d("kaiden", "serious", "괜찮으십니까?"),
  d("porter", "default", "자꾸 무언가 잊고 있는 것 같소. 그런데 무엇을 잊었는지도 모르겠소."),
  d("deneb", "default", "혼자 계시지 마세요. 저희와 함께 가요."),
  stage("none", 800),
]);

export const UNIT3_FLOOR1_STORY_ROOM_STORIES: readonly StorySequence[] = [STORY_1, STORY_2, STORY_3];

/* ---------------------------------------------------------------- G. 세 이벤트 완료 후 (다음 탐험 화면) */
export const UNIT3_FLOOR1_POST_EVENTS_STORY = sequence("unit3-floor1-post-events", "세 이벤트 완료 후", [
  d("kaiden", "serious", "데네브님, 저 사람은 본부 출입증을 가지고 있습니다. 우리 시대의 기억도 조금 남아 있는 것 같고요."),
  d("deneb", "serious", "네. 그런데 떠올리려 할수록 오히려 혼란스러워하고 있어요."),
  d("kaiden", "serious", "포탈에 삼켜진 주민일 가능성이 있겠군요."),
  d("deneb", "serious", "먼저 이곳에서 데리고 나가야겠어요."),
]);

/* ---------------------------------------------------------------- H. 마지막 방 (전투 없음) */
export const UNIT3_FLOOR1_FINAL_STORY = sequence("unit3-floor1-final", "돌아갈 곳을 잊은 사람", [
  stage("alley", 900),
  wait(1500),
  n("골목 끝에 다다르자 남자가 걸음을 멈춘다."),
  d("porter", "default", "나는 여기 남아야 하오. 아직 날라야 할 짐이 있소."),
  d("deneb", "default", "오늘 맡으신 식량은 모두 전달했잖아요. 이제 쉬러 가요."),
  d("porter", "default", "하지만… 이곳을 떠나면 어디로 가야 한단 말이오?"),
  d("porter", "default", "나는 여기서 태어났고, 줄곧 여기 살았는데…"),
  d("kaiden", "serious", "가지고 계신 출입증을 보십시오. 이 마을의 물건이 아닙니다."),
  stage("alley-card-hidden", 800),
  d("deneb", "default", "아까 집에서 기다리는 사람이 있다고 하셨죠. 천천히 떠올려 보세요."),
  d("porter", "default", "기다리는 사람…"),
  n("남자가 출입증의 검은 얼룩을 손으로 문지른다."),
  d("porter", "default", "…딸아이요. 아침에 제 손을 잡고, 오늘은 일찍 오라고 했어요."),
  // 출입증의 검은 얼룩이 걷히며 이름 ‘민수’ 표시 + 골목의 검은 안개가 조금 옅어짐 (dialogue 숨김)
  stage("alley-card-revealed", 2200),
  wait(500),
  d("minsu", "default", "민수… 맞아요. 제 이름입니다. 저는 본부에 물품을 배달하던 사람이에요."),
  d("minsu", "default", "하늘에 금이 생기더니 길이 사라졌습니다. 정신을 차렸을 때는 여기였어요."),
  d("minsu", "default", "처음에는 집에 돌아가려고 했는데… 어느 순간부터 제가 원래 이곳의 짐꾼이었다고 믿고 있었습니다."),
  d("deneb", "serious", "현실에서 온 사람이 던전 속 역할에 동화되고 있었군요."),
  d("minsu", "default", "네. 이름도, 가족도… 모두 잊을 뻔했어요."),
  stage("alley-clear", 900),
  d("kaiden", "serious", "그렇다면 다른 네 사람도 같은 일을 겪고 있을 수 있겠습니다."),
  d("deneb", "serious", "…우리를 기억하지 못할 수도 있겠네요."),
  stage("alley-clear", 1200),
  d("kaiden", "default", "하지만 기억을 되찾을 수 있다는 것도 확인했습니다. 아직 방법은 있습니다."),
  d("deneb", "default", "네. 먼저 찾아야겠어요."),
  d("minsu", "default", "혹시 찾으시는 분들 중에 카프라는 분이 있습니까?"),
  d("deneb", "serious", "카프를 만났나요?"),
  d("minsu", "default", "괴물에게 쫓길 때 저를 도와줬습니다. 약재는 다친 사람들에게 먼저 가져다주라고 하더군요."),
  d("minsu", "default", "그분은 학교로 물건을 옮기는 사람들과 저 골목 너머로 갔어요."),
  d("deneb", "default", "…카프답네요. 알려 주셔서 고마워요."),
  d("kaiden", "default", "우선 이분을 거점으로 모시겠습니다. 다음 수색은 그 뒤에 진행하죠."),
  stage("none", 900),
], { onCompleteScreen: "baseCamp" });

/* ---------------------------------------------------------------- I. 베이스캠프 최초 귀환 (짧은 내레이션) */
export const UNIT3_FLOOR1_BASE_CAMP_RETURN_STORY = sequence("unit3-floor1-base-camp-return", "베이스캠프 귀환", [
  n("민수는 일행의 호위를 받아 베이스캠프의 보호 구역으로 안전하게 옮겨졌다."),
], { onCompleteScreen: "baseCamp" });

/* ---------------------------------------------------------------- J. 퀘스트 완료 (데네브) */
export const UNIT3_FLOOR1_QUEST_COMPLETE_STORY = sequence("unit3-floor1-quest-complete", "퀘스트 완료: 돌아갈 곳을 잊은 사람", [
  d("deneb", "default", "수고했어요, (플레이어 이름). 덕분에 한 분을 무사히 데려왔네요."),
  d("deneb", "default", "던전에 삼켜진 사람들이 어떻게 되는지도 알게 되었고요."),
  d("kaiden", "default", "앞으로 만나는 사람들도 주의 깊게 살펴야겠습니다. 겉모습만으로는 구분하기 어렵겠군요."),
  d("deneb", "default", "네. 다음에는 카프가 향했다는 학교 쪽을 조사해 보죠."),
  d("deneb", "default", "카프가 우리를 알아보지 못하더라도… 이번에는 저희가 기억을 되찾도록 도와주면 돼요."),
  d("kaiden", "default", "출발 전에는 자네도 쉬어라. 준비가 끝나면 다시 움직이자."),
], { onCompleteScreen: "baseCamp" });

/** Deneb / Kaiden after the quest is complete (short, replayable; script lines reused). */
export const UNIT3_FLOOR1_AFTER_COMPLETE_STORY = sequence("unit3-floor1-after-complete", "베이스캠프", [
  d("deneb", "default", "다음에는 카프가 향했다는 학교 쪽을 조사해 보죠."),
], { onCompleteScreen: "baseCamp", replayable: true });

export const UNIT3_FLOOR1_KAIDEN_TALK_STORY = sequence("unit3-floor1-kaiden-talk", "카이든", [
  d("kaiden", "default", "출발 전에는 자네도 쉬어라. 준비가 끝나면 다시 움직이자."),
], { onCompleteScreen: "baseCamp", replayable: true });

export const UNIT3_FLOOR1_ALL_STORIES: readonly StorySequence[] = [
  UNIT3_FLOOR1_QUEST_OFFER_STORY, UNIT3_FLOOR1_START_STORY, UNIT3_FLOOR1_CART_INTRO_STORY, UNIT3_FLOOR1_CART_AFTER_STORY,
  ...UNIT3_FLOOR1_STORY_ROOM_STORIES, UNIT3_FLOOR1_POST_EVENTS_STORY, UNIT3_FLOOR1_FINAL_STORY,
  UNIT3_FLOOR1_BASE_CAMP_RETURN_STORY, UNIT3_FLOOR1_QUEST_COMPLETE_STORY,
];
