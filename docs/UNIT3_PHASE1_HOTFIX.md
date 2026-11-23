# 3단원 Phase 1 핫픽스 — 흰 화면 원인 · 1인칭 플레이어 표시 제거

기준: `dhkqpr4624-cell/AdventureAcademy5-2-3` main `fe778635e265b324db57ac6e4fec627861e16470`. GitHub에는 아무것도 쓰지 않았습니다.

## 1. 흰 화면 원인 (근거 포함)

| 근거 | 내용 |
|---|---|
| Actions 화면 | 워크플로가 둘입니다. 저장소의 **Deploy to GitHub Pages**(`deploy.yml`, Vite 빌드)는 `fe77863`에서 23초 만에 **실패**했습니다. 성공한 것은 GitHub 기본 **pages-build-deployment**입니다(사용자가 본 `build` / `report-build-status` / `deploy` 3개 작업이 이것). |
| 실패 내용(실행 #45086596488 주석) | `actions/configure-pages` 단계: *"Get Pages site failed. Please verify that the repository has Pages enabled and configured to build using GitHub Actions … HttpError: Not Found"*. 그래서 `npm ci`·`npm run build`는 시작도 하지 않았습니다. |
| pages-build-deployment의 의미 | Pages 원본이 **Deploy from a branch**일 때 도는 워크플로입니다. 빌드하지 않은 `main` 브랜치 파일을 그대로 올립니다. |
| 배포된 HTML | 메타 태그와 제목만 있고, `/AdventureAcademy5-2-3/assets/…` 번들 스크립트가 없습니다. 원본 `index.html`이 그대로 배포되었습니다. |
| 로컬 재현 | 원본 브랜치를 `/AdventureAcademy5-2-3/`에 그대로 서빙했습니다. 브라우저가 `<script src="/src/main.tsx">`를 도메인 루트(`/src/main.tsx`)에서 찾다가 **404**가 나고, `#root`가 비어 **흰 화면**이 됩니다. 증상이 똑같습니다. |

**결론:** 코드나 base 경로 문제가 아닙니다. Pages가 GitHub Actions 빌드 결과(`dist`)가 아니라 빌드 전 소스를 배포하고 있습니다.

같은 커밋을 CI와 같은 TypeScript 5.9.3과 lock 기준 타입(React 19.2, Node 24, three r181, Vite 7.3.6 `client.d.ts`)으로 `tsc -b` 했을 때 오류 0이었습니다. 빌드가 돌았다면 통과했을 것입니다.

함께 확인한 것:
- base는 워크플로가 저장소 이름으로 넣는 `VITE_BASE_PATH`에서 정해집니다. 결과는 `/AdventureAcademy5-2-3/`입니다.
- 소스·워크플로·빌드 결과 어디에도 `AdventureAcademy5-2-2` 경로가 하드코딩되어 있지 않습니다.
- 업로드 경로는 `dist`로 맞습니다.

### 직접 하실 일 (필수)

1. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꿉니다.
2. **Actions → Deploy to GitHub Pages → Run workflow**(또는 수정 파일을 올리는 커밋)로 다시 실행합니다.
3. 실행에서 `Install dependencies` → `Build` → `Upload` → `Deploy`가 모두 초록색인지 확인합니다.

### 코드 쪽 보강 (`index.html`)

- `#root` 안에 "불러오는 중" 문구를 넣었습니다. React가 마운트되면 바로 사라집니다.
- 소스 진입 태그에 `onerror`를 달았습니다. 빌드하지 않은 소스가 다시 배포되면 흰 화면 대신 원인과 해결 방법을 화면에 보여 줍니다.
- Vite 빌드는 이 태그를 해시된 번들 태그로 바꾸므로 정상 배포에는 영향이 없습니다.
- 오류를 숨기거나 지연을 넣지 않았습니다.

## 2. 1인칭 규칙: 플레이어를 그리지 않음

- 삭제
  - `public/assets/chapter3/actors/player-standing.png`
  - `scripts/chapter3/make_player_silhouette.py`
- 배우 목록에서 `player`를 없앴습니다. 타입·스프라이트·에셋 URL·미리 불러오기 목록·베이스캠프 NPC에서도 모두 뺐습니다. 이름·선택지·저장·능력치·인벤토리·던전 1인칭 무기 표시는 그대로입니다.
- 본부: 테오·루나·아론·카프가 탁자 왼쪽에 서 있고, 데네브·카이든이 그 바로 오른쪽에 빈틈 없이 합류합니다. 연구원은 탁자 반대편(x 1020)에서 등장합니다. 워프 마법진은 원정대 NPC 6명 발밑에만 생기고, 빈 플레이어 표시는 없습니다.
- 도착 맵: 처음엔 빈 착지 지점(`arrival-landing`)만 보이고, 카이든과 데네브가 차례로 워프로 등장합니다.
- 베이스캠프: 입구 양옆에 데네브(x 545)와 카이든(x 1115)만 서 있습니다.

## 3. 검증

| 항목 | 결과 |
|---|---|
| `tsc -b` (TypeScript 5.9.3, CI와 같은 타입 버전) | 오류 0 |
| `npm run check` 해당 스크립트(`run-final-checks.mjs`) | 82개 PASS. 새 1인칭 검사 포함: 플레이어 배우 없음, 마법진 6개, 본부 시작 4명, 도착 첫 화면 0명, 베이스캠프 NPC 2명 |
| 자산 검사 4종(bgm · dungeon10 · dungeon9 · question-ui) | PASS |
| `/AdventureAcademy5-2-3/` 하위 경로 프로덕션 빌드 · Chrome | 타이틀 표시, 일러스트 로드(1671px), 단원 표기 확인 |
| 본부 세 경로 / 도착 두 응답 | 모두 합류해서 베이스캠프 도착 |
| 이름 치환 | "어서 오십시오, 하늘." 확인 |
| 이어하기 | 새로고침 후 베이스캠프로 바로 이동 |
| 2단원 저장 키 | 미리 넣어 둔 값이 그대로 |
| BGM 순서 | 본부 → 긴장 → 베이스캠프, 겹침 없음 |
| 오류 | 콘솔 오류 0, 404 0, 플레이어 이미지 요청 0 |
| 모바일 가로 844×390 | 같은 흐름 통과 |
| 루트 경로 `/` 빌드 | 인트로 시작까지 확인 |
| 전차·구름 | 첫 대기 30~60초, 화면 밖에서 진입·퇴장, 화면 이탈 시 정리, 구름 연속 이동 |

**실행하지 못한 것**
- `npm ci`와 실제 `vite build`: 이 작업 환경은 npm 레지스트리에 접속할 수 없습니다. 브라우저 점검은 `scripts/local-esbuild-build.mjs`(Vite와 같은 base·에셋 처리)로 만든 빌드로 했습니다.
- 실제 GitHub Pages 확인: 이 환경에서 github.io에 직접 접속할 수 없고, 배포 권한도 없습니다. **Pages 원본을 바꾸고 다시 배포한 뒤 사이트가 정상인지 꼭 확인해 주세요.**
