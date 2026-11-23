# 어드벤처 아카데미 3단원 Phase 1 — 변경·검증 보고

- 기준: `dhkqpr4624-cell/AdventureAcademy5-2-2` main, 시작 HEAD `2f2dbebf73961155866a73ef8a1880e288365b61` (프롬프트와 동일). 1단원 저장소(`AdventureAcademy`, HEAD `6724eae…`)는 읽기만 했습니다.
- GitHub에는 아무것도 쓰지 않았습니다(로컬 복사본의 push URL은 `DISABLED_NO_PUSH`로 막음). 커밋도 만들지 않았습니다.

## 1. 흐름

타이틀(`<5학년 2학기 3단원>`, 새 타이틀 그림) → 새로 시작하기 → 기존 이름 입력 → 작전본부 인트로 → 던전 도착 맵 → 베이스캠프 도착.

- 이어하기: 인트로를 마친 저장이면 바로 베이스캠프, 아니면 인트로를 처음부터 다시 재생합니다(`src/app/chapter3Flow.ts`).
- 인트로 종료 시 완료 표시(`completedStoryIds: chapter3-intro`)와 이름을 상태 ref에 먼저 반영하고 즉시 저장한 뒤 베이스캠프로 전환합니다.
- 저장 키: `adventure-academy-unit3:save:{main,backup:1..3}`. 2단원 키(`adventure-academy:save:*`)는 읽기·쓰기·삭제 모두 하지 않습니다.
- Phase 1에서 던전·문제·보스 화면은 라우팅하지 않습니다(`navigate`가 story/baseCamp 외에는 타이틀로). 베이스캠프의 던전 입구는 그림만 있고 클릭 영역이 없습니다. 퀘스트·상점·2단원 NPC 이벤트는 연결하지 않았습니다.

## 2. 맵·레이어·카메라 (`src/game/chapter3/`)

- `MapStage`: 1672×941 맵 좌표 하나에 레이어·배우 발 위치·VFX를 두고, 화면을 덮도록(cover) 스케일합니다. 카메라 중심은 애니메이션 도중에도 매 프레임 클램프해서 맵 바깥이 보이지 않습니다.
- 순서: sky → cloud+atmosphere(루프) → sky prop → background_outside → background → foreground → foreground VFX(홀로 지구본) → npc → ground. 대화·모달·요약/포탈 일러스트·전환 오버레이는 맵 위에 따로 합성합니다.
- 구름 루프(`LoopingLayer`): 원본과 좌우 반전본을 이어 붙인 2배 폭 타일을 한 요소의 `repeat-x` 배경으로 흘립니다. 이음매가 생기지 않고, 위치를 공용 시계에서 계산하므로 리사이즈·카메라 이동·재마운트 때 튀지 않습니다. 타일은 인트로 시작 전에 미리 만들어 첫 프레임 공백이 없습니다.
- 홀로 지구본: 원본 시트(8192×3072, artPixel 2)의 2×2 블록이 모두 같은 것을 확인한 뒤 4096×1536으로 무손실 재포장했습니다(태블릿 텍스처 한도 대응). JSON의 48프레임·83ms 지속시간·피벗을 그대로 쓰고 좌표만 0.5배 했습니다. 탁자 중심(x≈800, 상판 y≈720) 위에 피벗을 둡니다.
- 도착 맵: 레이어에 하늘·균열이 없어 공용 `sky.png`와 SVG 균열(보라색 발광)을 보완했습니다. 마지막에 ground·foreground·npc만 함께 내려가고 background·하늘은 고정입니다.
- 베이스캠프: 기존 `BaseCampViewport/BaseCampWorld`를 재사용하고 구름 루프·전차·장면용 NPC 목록 옵션을 추가했습니다. 전차는 보이는 부분만 잘라 원래 레일 높이(y 430)를 유지하고, NPC 앞·ground 뒤에 그립니다. 첫 등장 전과 매 통과 후 30~60초 난수를 새로 뽑고, 화면 오른쪽 밖(x 1672)에서 왼쪽 밖(x −786)까지 12.5초 등속으로 지나갑니다. 화면을 나가면 타이머와 프레임을 해제합니다.

## 3. 인트로 (`src/data/chapter3/chapter3IntroScript.ts`, `chapter3IntroStage.ts`)

- 대사·표정·분기는 프롬프트 문구를 그대로 넣었습니다(띄어쓰기 포함, 예: "있을 지 모르니 ,"). 기존 `StoryPlayer`를 그대로 쓰고, 장면 연출은 `setStagePhase` → 단계표로 구동합니다.
- StoryPlayer 확장(기존 사용처 동작은 그대로): 장 전용 스테이지 렌더러, 팝업형 선택지(예/아니오), 이름 아래 직책(데네브·카이든 "지휘관"), 일러스트 어둡게, 입력 최소 대기(280ms, 연속 클릭으로 두 줄 넘김 방지), 선택지 잠금을 다음 단계 시작까지 유지.
- 요약 이미지 7장(기존 저장소 재사용):

| 장면 | 파일 |
|---|---|
| 1단원 항해·포탈 | `story/illustrations/intro_portal_swallow_plane.png` |
| 1단원 전과의 만남 | `story/dungeon4/jeon-found.png` |
| 1단원 공민왕 희생·골렘·귀환 | `ending/ending-4-party-enter.png` (귀환 장면으로 대체 — 희생 장면 전용 그림 없음) |
| 2단원 서울 상공 던전 진입 | `dungeon8/giant-portal.png` |
| 2단원 수상한 흔적 | `story/chapter2/dungeon1/mysterious-figure.png` |
| 2단원 데네브 발견 | `dungeon7/fallen-deneb-illustration.png` |
| 2단원 데네브 구출·역사포식자 | `dungeon10/boss/hungry-history-devourer-combat.png` (마지막 대사는 같은 그림을 어둡게) |

- 표정 대체: 카이든 serious → default(새 ZIP에 serious 없음), 데네브 serious → default, 연구원 serious → default(기본 하나뿐).
- 플레이어 스프라이트: 저장소에 플레이어 캐릭터 그림이 없어(1인칭 게임) 이름 없는 망토 실루엣을 생성했습니다(`public/assets/chapter3/actors/player-standing.png`, `scripts/chapter3/make_player_silhouette.py`). 같은 경로에 실제 그림을 넣으면 코드 수정 없이 바뀝니다.
- `src/assets/story/npcs/kaiden/standing_R.png`가 원본 저장소에서 잘린 파일(76,800바이트, 디코딩 실패)이라 standing_L 좌우 반전본으로 다시 만들었습니다.

## 4. 오디오·VFX

| 용도 | 사용 |
|---|---|
| 본부 BGM | `audio/village-theme.wav` (1단원 아카데미 테마, 2단원에선 미사용) → `unit3-hq` |
| 긴장 BGM | `audio/intro-story-theme.wav` → `unit3-tension`, 연구원 등장 때 2.2초 페이드아웃 후 페이드인 |
| 바람 루프, 워프·왜곡음 | 양쪽 저장소에 없음 → Web Audio로 생성(`src/game/audio/chapter3ProceduralSfx.ts`) |
| 느낌표 | 기존 `exclamation-sheet.png`(12프레임) |
| 전이 마법진·빛 기둥·워프 등장 빛·흰 플래시 | PixelFX로 만들려 했으나 내려받은 PixelFX 코드를 이 환경에서 실행하는 것이 정책으로 막혀, CSS/SVG 연출로 대체 |

장면 전환·타이틀 복귀 때 바람·워프 음과 카메라·타이머를 모두 정리합니다.

## 5. 2단원 콘텐츠 정리

- 삭제 97개(목록: `docs/UNIT3_PHASE1_DELETED_FILES.txt`): 2단원 인트로(데이터·스테이지·플레이어·에셋), 2단원 베이스캠프 퀘스트/보상 화면, 2단원 완료 스토리 컴포넌트, 테스트 스토리, 미사용 엔딩 화면, 아무 데서도 참조하지 않는 일러스트·배경·오디오·옛 타이틀(약 157MB). esbuild 메타파일 의존 그래프와 정적·템플릿 경로 문자열 검색을 모두 거친 뒤 지웠습니다.
- 남긴 것: 전투·인벤토리·던전 생성·문제 출제·정답 판정·보상 규칙, 공용 UI(인벤토리·상점·보상·업적 팝업 등), 저장 구조. `DungeonScreen`·`QuestionScreen`·`BossCombatScreen`은 라우팅하지 않은 채 보존했습니다. 이 화면들 안에 2단원 층별 이벤트 분기가 100곳 넘게 섞여 있어, 거기서만 쓰는 2단원 대본·문제·장비 데이터도 함께 남아 있습니다. 이 분리는 3단원 층·문제 설계가 정해지는 Phase 2에서 하는 것이 안전합니다.

## 6. 검증

| 항목 | 결과 |
|---|---|
| 타입 검사 `tsc -p tsconfig.app.json` (실제 React 19 / three 타입) | 오류 0 |
| `node scripts/run-final-checks.mjs` (기존 검사 + 새 `chapter3Checks`) | 전부 PASS |
| bgm / dungeon10 / dungeon9 / question-ui 자산 검사 | PASS |
| `final-nine-assets-checks.mjs` | 실패 — 손대지 않은 원본에서도 똑같이 실패(옛 `git diff` 상태를 단정하는 검사) |
| 브라우저 실제 플레이(Chrome, `/`와 `/AdventureAcademy5-2-2/`) | 세 본부 경로·도착 두 응답 모두 합류해서 베이스캠프 도착. 콘솔 오류 0, 404 0 |
| 연속 클릭 | 대사 더블클릭은 한 줄만, 선택지 더블클릭은 다음 대사를 건너뛰지 않음 |
| 워프 / 재집결 | 마법진 7개(연구원 제외) / 도착 맵 3명 |
| 오디오 순서 | 본부 BGM → 긴장 BGM → 워프 전에 페이드아웃 → 베이스캠프 BGM, 동시에 두 BGM이 재생되는 순간 없음 |
| 저장 | 완료 표시와 이름 저장, 새로고침 후 이어하기는 베이스캠프로. 미리 넣어 둔 2단원 키 값은 끝까지 그대로 |
| 전차(가짜 시계) | 첫 대기 31.2초(30~60초 범위), x 1672에서 출발, 초당 약 197px 등속, 통과 후 새 대기 54.7초, 화면 이탈 시 제거 |
| 화면 크기 | 1280×720, 1024×768, 820×1180, 2560×1080, 844×390에서 맵 가장자리 노출 없음 |

**실행하지 못한 것**
- `npm ci`·`vite build`: 이 환경은 npm 레지스트리에 접속할 수 없습니다. 대신 `scripts/local-esbuild-build.mjs`(base 경로, 에셋 해시, `?raw`, `public/` 복사를 Vite와 같게 처리)로 두 base 경로 빌드를 만들어 점검했습니다. 내려받은 뒤 `npm ci && npm run build`를 한 번 실행해 주세요.
- `tsc -b`의 `vite.config.ts` 부분은 `@vitejs/plugin-react`가 설치되어 있지 않아 이 환경에서 확인하지 못했습니다(원본도 같음).
- 실제 소리를 귀로 확인하지는 못했습니다. 재생 순서는 재생 기록으로 확인했습니다.

## 실행

```
npm ci
npm run dev                                         # 개발 서버
npm run build                                       # tsc -b && vite build
VITE_BASE_PATH=/AdventureAcademy5-2-2/ npm run build  # 하위 경로
npm run check                                       # 기존 + 3단원 검사
```
