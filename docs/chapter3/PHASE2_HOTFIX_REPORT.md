# 어드벤처 아카데미 5-2-3 — Phase 2 Hotfix 보고서

- **시작 HEAD**: `736c68b9875353d7376c9230499691a9b87a5c2b` (main, "phase2 - dungeon1")
- **GitHub**: 읽기(clone, ls-remote)만 했습니다. 로컬 복제본의 push 주소는 `DISABLED_NO_PUSH`로 막아 두었고, 커밋·브랜치·PR·워크플로 실행·설정 변경은 하지 않았습니다. 작업 후 원격 main은 그대로 `736c68b`, 로컬에도 새 커밋 0개입니다.
- **빌드 방식**: 이 환경은 npm 레지스트리에 접근할 수 없어 **`npm ci`와 `vite build`는 실행하지 못했습니다.** Phase 1·2와 같은 대체 빌드(로컬 TypeScript 5.9.3 `tsc -b` + esbuild 기반 `scripts/local-esbuild-build.mjs`)로 `/AdventureAcademy5-2-3/` 하위 경로 빌드를 만들어 검증했습니다.

## 1. 던전 3D 공간 확대·배치 개선

| 항목 | 수정 전 (Phase 2) | 수정 후 | 배율 |
|---|---|---|---|
| 도로 폭 | 6 | 18 | 3× |
| 광장(방) 크기 | 10×10 | 24×24 | 2.4× |
| 방 간격(시각) | 16 | 48 | 3× |
| FBX 건물 평균 높이 / 폭 | 6.6 / 5.8 | 17.2 / 15.1 | 2.6× / 2.6× |
| 맵당 FBX 건물 수 | 약 33 | 약 76 | — |
| 맵당 직접 만든 상자 건물 | 약 1,567 | **0** | — |

(시드 40개 평균 수치입니다. 자동 검사에 포함되어 있습니다.)

- **논리 구조와 시각 배치를 나눔**: `prepareUnit3Floor1Map`(방 종류·연결·짐수레/스토리/최종 방 조건)이 먼저 실행됩니다. 그다음 `toGyeongseongVisualMap`이 **위치만** 3배로 벌립니다. 방 id·연결·필수 여부·몬스터·이벤트는 그대로이며, 검사에서 두 맵이 같은지 확인합니다. 카메라에서 몬스터까지의 거리(4)도 그대로라 전투 화면 구도는 바뀌지 않습니다.
- 미니맵은 위치를 정규화해 그리므로 그대로 동작합니다. 방향 선택 UI, 이동, 무기, 전투 전환도 변경하지 않았습니다.
- 거리가 3배로 길어져 카메라 이동 속도를 2.2배로 올렸습니다. 한 번 이동하는 시간은 Phase 2의 약 1.4배입니다.
- 건물은 실제 사각형 범위로 겹침과 도로 침범을 검사합니다(시드 40개). 도로·광장의 모든 칸에 타일이 있고, 건물이 없는 빈 칸에는 보도 타일을 깔아 맨땅이 드러나지 않게 했습니다. 거리에 맞닿은 칸의 92%를 건물 정면이 덮고, 나머지는 안쪽 건물과 안개가 가립니다.
- 원경은 안개(55→190), 하늘 돔, 카메라 far 300으로 처리했습니다.

## 2. 제공한 FBX만 건물로 사용

`3d assets.zip`의 FBX 5개를 조사했습니다(three.js FBXLoader로 실제 로딩).

| 파일 | 종류 | 원본 BBox (W×H×D) | 피벗 | 삼각형 | 텍스처 | 적용 높이(배율) |
|---|---|---|---|---|---|---|
| 1/1.fbx | 목조 상점 | 0.712×0.980×0.572 | 바닥 중앙 | 54,629 | 1_tex.jpg 512² | 12.4~21.6 (평균 16.8) |
| 2/2.fbx | 벽돌 모퉁이 상점 | 0.739×0.977×0.727 | 바닥 중앙 | 50,084 | 2_tex.jpg 512² | 13.6~23.8 (평균 19.7) |
| 3/3.fbx | 한옥 | 0.968×0.792×0.953 | 바닥 중앙 | 55,820 | 3_tx.jpg 512² | 8.7~15.1 (평균 12.4) |
| 4/4.fbx | 역사(시계탑) | 0.971×0.963×0.501 | 바닥 중앙 | 50,739 | tripo_image_….jpg 512² | 16.7~29.1 (평균 22.5) |
| 5/5.fbx | 양관(저택) | 183.5×160.3×129.6 (Z-up, 내부 scale 100) | 바닥 | 49,106 | 5_tex.jpg 2048² → 1024² | 11.8~20.5 (평균 17.2) |

- 모델마다 원본 크기와 비율이 달라 높이 기준 배율을 따로 정했습니다(목조 20, 벽돌 22, 한옥 14, 역사 27, 저택 19). 자리에 맞추기 위해 0.62~1.08배 안에서 조정합니다.
- 5.fbx는 Z-up이라 X축 −90°로 세우고, 입구가 −Z를 향해 Y축 180°를 돌려 정면을 +Z로 맞췄습니다.
- **텍스처가 안 보이던 원인**: FBX 안의 텍스처 경로가 Tripo 서버나 Blender 임시 폴더의 절대경로(`/mnt/pfs/…/tripo_image_…jpg`, `C:\Users\…\Color.jpg`)였습니다. 함께 온 jpg와 파일명도 달라서, FBX를 그대로 불러오면 텍스처가 404가 되어 단색으로 보입니다. 그래서 변환할 때 함께 제공된 jpg를 모델별로 직접 연결했고, 브라우저에서 텍스처가 정상 표시되는 것을 확인했습니다.
- **변환**: `scripts/chapter3/convert-gyeongseong-buildings.mjs`로 원본 메시를 그대로 옮겼습니다. 정점만 합쳐(16만 → 4~5만) 인덱스 메시로 만들었고 삼각형 수는 같습니다.
- **원거리 LOD**: 같은 FBX 메시를 three.js SimplifyModifier로 약 20%(약 1만 삼각형)까지 줄이고, 텍스처 색을 정점 색으로 구웠습니다. 카메라에서 55 이상 떨어진 건물에만 쓰고, 185 밖의 건물은 그리지 않습니다.
- **삭제**: 직접 만든 상자 건물(BoxGeometry, 캔버스 벽돌 텍스처)과 Phase 2의 이전 건물 메시·텍스처 16개를 지웠습니다(`DELETED_FILES.txt`). 이전 FBX 원본은 `art-source/`에 그대로 남아 있습니다.
- 도로·보도는 기존 07b/07a 타일을 재사용했습니다. **`12a-cracked-road`는 사용하지 않습니다.** 배포 빌드에도 없고, 회귀 검사도 유지했습니다.
- 반복이 규칙적으로 보이지 않도록 모델·크기·정면 들여쓰기·좌우 반전을 시드 기반으로 무작위로 정합니다.

## 3. 베이스캠프

- **! / ? 표시**: 기호·색·표시 규칙은 그대로 두었습니다. 더 두꺼운 어두운 외곽선, 부드러운 후광, 은은한 빛, 2.4초 부유와 2.8초 밝기 변화(1.0↔1.18)를 넣었습니다. 깜빡임은 없고, 모션 줄이기 설정을 켜면 애니메이션이 꺼집니다.
- **보급물품**: 크기를 0.0844에서 0.1688(2배)로 키웠고 비율은 그대로입니다. 바닥선에 맞췄고, 카이든과 겹치지 않도록 중심을 x 1300에서 1320으로 옮겼습니다(검사 포함). 클릭 영역도 2배로 키웠고, hover 흰 외곽선이 동작하는 것을 확인했습니다.
- **이름표**: `상점`(윗줄, 괄호 없음, 금색) / `보급물품`(아랫줄) 2줄로 표시하고, 글자를 조금 키웠습니다. 다른 NPC 이름표는 그대로입니다.

## 4. 인트로 건너뛰기

- **상태**: `HQ_INTRO → ARRIVAL_INTRO → BASE_CAMP`. 작전본부와 도착 맵을 별도 시퀀스로 나누고, `Chapter3IntroPlayer`가 상태를 관리합니다. 상태가 바뀔 때 StoryPlayer를 새로 만들어 이전 맵의 타이머·단계·페이드·연출을 모두 버립니다.
- HQ에서 건너뛰기 → 도착 맵의 **첫 단계**부터 시작합니다(검은 화면 → 착지 → 바람 → 페이드 인 → 카이든 등장).
- 도착 맵에서 건너뛰기 → 베이스캠프로 갑니다. 끝까지 봤을 때와 같은 완료 기록(`chapter3-intro`)과 저장이 남습니다.
- **연속 클릭 방지**: 각 맵이 시작되고 0.9초 동안은 건너뛰기를 받지 않습니다. 더블클릭으로 두 단계를 한 번에 넘기지 않는 것을 확인했습니다.
- **소리**: HQ를 떠날 때 SFX(워프 충전 등)를 멈추고 BGM을 0.4초 동안 줄입니다. 도착 맵의 바람 소리는 도착 맵 연출이 새로 시작합니다.
- 이름과 저장 데이터는 유지됩니다. 분기 선택은 각 맵 안에서 그대로 진행됩니다. 새로고침 후 이어하기는 베이스캠프로 갑니다.

## 5. 테오·루나·카이든 blink 오류

- **실제 원인**: 인트로 무대의 `StageActor`가 눈을 깜빡이는 동안 서 있는 `<img>`를 **아예 빼고**, 미리 불러오지 않은 blink 시트를 `background-image`로 쓰는 `<span>`으로 바꿨습니다. 시트를 받고 디코딩하는 동안 그 자리가 비어, 캐릭터 전체가 잠깐 사라졌습니다. 깜빡임이 끝나면 `<img>`를 다시 만들어 한 번 더 깜빡였습니다.
- **수정**:
  - 서 있는 프레임은 항상 남겨 둡니다.
  - blink 시트는 같은 상자에 항상 붙어 있는 덮개 층으로 두고, 눈 감은 프레임(1~3)일 때만 보이게 했습니다.
  - 시트를 `Image.decode()`로 미리 디코딩한 뒤에만 깜빡임을 시작합니다.
  - 방향이 바뀌면 깜빡임 주기를 0프레임부터 다시 시작합니다.
  - 인트로 로딩 때 모든 standing/blink 시트를 미리 불러옵니다.
- **베이스캠프 카이든**: 이미 덮개 방식이었습니다. 다만 위치·크기가 소수 픽셀이라(600×0.3 = 180.00000000000003) 프레임이 하위 픽셀만큼 밀릴 수 있어, 정수 픽셀로 맞췄습니다.
- **확인**: 인트로를 14초 동안 관찰하는 동안 actor `<img>` 제거 0회, blink 덮개 표시 54회를 기록했습니다.

## 6. 테스트

- `tsc -b` 통과. `node scripts/run-final-checks.mjs` 84개 항목 통과. Phase 2 검사에 이번 내용을 추가했습니다(시각 맵=논리 맵, FBX 건물만, 사각형 겹침 없음, 도로 칸마다 타일, 건물 아래 보도 없음, 크기 2.3~3배, 도로 18/광장 24, 12a 미사용, 인트로 2단계와 건너뛰기 보호, 보급물품 2배와 카이든 비겹침, 이름표 2줄).
- **Playwright 실제 브라우저**(Chrome, 소프트웨어 WebGL, `/AdventureAcademy5-2-3/`):
  - 새 게임 → 인트로 건너뛰기(더블클릭 포함) → `arrival-landing`부터 시작 → 건너뛰기 → 베이스캠프. 완료 기록, 이름 유지, 이어하기 → 베이스캠프 확인.
  - 베이스캠프(1280×720, 844×390): ! / ? 후광과 애니메이션, 보급물품 2배, `상점/보급물품`, hover 외곽선, 클릭 → 상점 열림.
  - 던전 1층 끝까지: 퀘스트 거절/수락 → 시작 이벤트 → 짐수레 전투 → 스토리 방 3→1→2 → 세 이벤트 후 대화 → 마지막 방 → 귀환 내레이션 → 보상(골드 +10, 소형 포션 +2, 환도, 업적, 중복 없음). 쓰러짐 → 다시 도전(짐수레 재전투 없음), 새로고침 유지, 완료 후 재입장 시 귀환 안내까지 확인했습니다.
  - 콘솔 오류 0개, 404 0개(화면 전환으로 취소된 오디오 요청만 있음). 3D 에셋 19개가 모두 로드됐습니다.
- 스크린샷: `dungeon-start-before-after.png`, `dungeon-cart-room-before-after.png`, `basecamp-before-after.png` 외.

## 7. 미해결·참고

- 근거리 건물은 FBX 원본 그대로 약 5만 삼각형입니다. LOD와 거리 컬링을 넣었지만, 실제 학교 기기(저사양 노트북·크롬북)의 프레임은 측정하지 못했습니다(테스트는 소프트웨어 렌더러). 느리면 `BUILDING_LOD_DISTANCE`(55)를 줄이면 됩니다.
- 원거리 LOD는 텍스처 대신 정점 색이라, 가까이 다가가 LOD가 바뀌는 순간 질감이 살짝 바뀔 수 있습니다(안개 범위 안).
- 몇몇 건물은 옆면이나 뒷면이 거리 쪽으로 보입니다(FBX 뒷면에도 텍스처가 있음).
- 저장소 루트에 지난번 ZIP의 `CHANGED_FILES.txt`, `DELETED_FILES.txt`가 커밋되어 있습니다. 이번 ZIP에도 같은 이름의 파일이 들어 있으니, 루트의 두 파일은 지워도 됩니다.
- 지난 Phase 2에서 삭제를 요청했던 `public/assets/chapter3/actors/player-standing.png`, `scripts/chapter3/make_player_silhouette.py`가 main에 아직 남아 있어 이번 `DELETED_FILES.txt`에 다시 넣었습니다. 둘 다 아무 데서도 쓰지 않습니다.

## 8. 수정 파일

**수정**
- `src/three/dungeon/gyeongseong/gyeongseongLayout.ts`, `GyeongseongEnvironment.ts`, `src/three/dungeon/DungeonCameraController.ts`, `src/screens/DungeonScreen/DungeonScreen.tsx`
- `src/data/chapter3/chapter3BaseCamp.ts`, `src/components/NpcNameTag.tsx`, `src/screens/BaseCampScreen/BaseCampWorld.tsx`, `src/types/baseCamp.ts`
- `src/data/chapter3/chapter3IntroScript.ts`, `src/game/chapter3/Chapter3IntroPlayer.tsx`, `src/game/story/StoryPlayer.tsx`, `src/types/story.ts`
- `src/game/chapter3/StageActor.tsx`, `src/styles/chapter3.css`, `src/chapter3Phase2Checks.ts`
- `public/assets/chapter3/gyeongseong/meshes/manifest.json`

**추가**
- `public/assets/chapter3/gyeongseong/meshes/gs-*.bin`(10개), `buildings-manifest.json`, `textures/gs-*.jpg`(5개)
- `scripts/chapter3/convert-gyeongseong-buildings.mjs`, `scripts/chapter3/gyeongseong-buildings-convert.html`
- `art-source/chapter3/gyeongseong-buildings/`(제공 FBX와 텍스처 원본)
- `docs/chapter3/PHASE2_HOTFIX_REPORT.md`

**삭제**: `DELETED_FILES.txt` 참고(18개).
