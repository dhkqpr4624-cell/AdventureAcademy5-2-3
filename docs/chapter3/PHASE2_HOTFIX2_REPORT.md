# Adventure Academy 5-2-3 — Phase 2 Hotfix 2 보고서

- 시작 HEAD: `651969319cac476a27d88eee6824e676d6cbf0f7` (`phase2- fix`, main)
- 작업 방식: 최신 main을 새 로컬 폴더에 clone(push URL 비활성화)하여 로컬에서만 수정·검증
- GitHub 쓰기 작업: **없음** (commit·push·branch·PR·workflow 실행·Pages 설정 변경 모두 하지 않음. 작업 후 `git ls-remote origin main` = `6519693…` 그대로, 로컬 커밋 0개)

---

## 1. BGM

### 1-1. 파일과 재생 구간

| 트랙 id | 파일 (원본과 바이트 동일) | 재생 구간 |
|---|---|---|
| `unit3-hq` | `public/assets/audio/bgm/intro-adventureacademy.wav` (= INTRO_ADVENTUREACADEMY.wav, SHA-256 `5942121e…`) | 작전본부 맵 첫 단계(`hq-gather`)에서 1.2초 페이드인 → 대사·선택지·등장 연출·연구원 등장·브리핑·워프 충전까지 계속 → 워프 섬광(`hq-warp-flash`)에서 1.2초 페이드아웃 → 도착 맵 전환 시점에 정지 |
| `unit3-basecamp` | `public/assets/audio/bgm/unit3-basecamp.wav` (= BASECAMP.wav, SHA-256 `0b722872…`) | 베이스캠프 진입 시 1.5초 페이드인 → NPC 대화·상점·퀘스트 수락/완료 대사·보상 팝업 중 유지 → 던전 진입 시 1.2초 페이드아웃 → 귀환·이어하기·새로고침 후 다시 재생 |

- 기존 연구원 등장 시의 긴장 BGM 전환(`bgm-tension` → `unit3-tension` 크로스페이드)은 "연구원 등장 후에도 유지" 요구와 충돌하므로 `hq-researcher` 단계의 cue만 제거했습니다(트랙·처리 코드는 그대로 둠).
- 기존 워프 연출: 이전에는 워프 충전 시작과 동시에 BGM을 2.4초 페이드아웃했습니다. 지금은 충전 동안 BGM을 0.6배(약 −4.4 dB)로 1.5초에 걸쳐 낮춰 유지하고(워프 충전음이 묻히지 않도록), 섬광 순간에 페이드아웃합니다. 워프 충전음·섬광음·바람 소리의 타이밍은 바꾸지 않았습니다.
- 본부 건너뛰기: 0.8초 페이드아웃 후 도착 맵으로 넘어가며, 본부 BGM이 도착 맵이나 베이스캠프로 이어지지 않습니다.
- 던전 BGM 참고: 3단원 1층 던전에는 원래 전용 BGM이 없습니다(`DungeonScreen`의 BGM 효과는 floor-10에서만 동작). 이전에는 캠프 BGM이 던전까지 계속 이어졌고, 이번 요구에 따라 던전에서는 BGM 없이 던전 효과음만 들립니다. 던전 BGM 추가는 이번 범위 밖이라 하지 않았습니다.

### 1-2. 반복 방식
- HTMLAudio의 기본 `loop`(같은 요소를 반복, 다시 만들지 않음)를 사용합니다.
- 두 파일 모두 첫·끝 샘플이 0이라 반복 지점에서 클릭 잡음이 없습니다.
- 다만 원본에 앞뒤 무음이 있습니다. 반복 사이에 HQ 곡은 약 2.5초(앞 1.99초 + 뒤 0.49초), 캠프 곡도 약 2.5초(앞 0.77초 + 뒤 1.75초) 쉬었다가 다시 시작합니다. 원본 파일은 수정하지 않았습니다.

### 1-3. 음량 분석 (ffmpeg EBU R128)

| 파일 | 통합 음량 | True Peak | RMS | LRA |
|---|---|---|---|---|
| INTRO_ADVENTUREACADEMY.wav | **−12.2 LUFS** | −0.1 dBTP | −15.2 dB | 13.0 |
| BASECAMP.wav | **−19.0 LUFS** | −0.8 dBTP | −22.0 dB | 10.2 |
| 기존 basecamp-bgm.wav (기준) | −25.5 LUFS | −13.1 | −28.6 | 11.4 |
| 기존 village-theme.wav (이전 HQ 곡) | −27.4 LUFS | −13.8 | −30.8 | 15.4 |
| 기존 dungeon-theme.wav | −31.8 LUFS | −16.1 | −34.5 | 11.4 |
| button-clicked-sfx.mp3 | −30.0 LUFS (순간 최대 −27.7) | −8.6 | | |
| hit-sfx.mp3 | −20.0 LUFS (순간 최대 −14.6) | −2.2 | | |
| heal-sfx.mp3 | −25.9 LUFS (순간 최대 −22.7) | −5.0 | | |

새 두 곡은 기존 BGM보다 각각 **약 13 dB, 6.5 dB 큽니다.** 그대로 기존 볼륨(0.42)에 넣으면 효과음을 덮습니다.

### 1-4. 최종 gain (트랙별 보정, 파일은 무수정)
- 기존 BGM 세트의 기준인 basecamp-bgm.wav(−25.5 LUFS, 볼륨 0.42)와 같은 체감 음량이 되도록 트랙별 보정값 `BGM_LOUDNESS_TRIM`을 두었습니다.
  - `unit3-hq` = 10^((−25.5+12.2)/20) = **0.216** → 실제 볼륨 0.42×0.216 = **0.0907** (≈ −33.0 LUFS 상당)
  - `unit3-basecamp` = 10^((−25.5+19.0)/20) = **0.473** → 실제 볼륨 0.42×0.473 = **0.1987** (≈ −33.0 LUFS 상당)
  - 다른 트랙의 보정값은 1이며, 음량은 바뀌지 않습니다.
- 두 곡의 체감 음량이 서로 같고 기존 캠프 BGM과도 같아, 장면이 바뀔 때 음량이 튀지 않습니다.
- 감쇠만 하므로 클리핑이 없습니다(원본 피크 0.986 → 출력 최대 약 0.09).

### 1-5. 효과음과의 균형 (브라우저 실측)
- 측정 방법: 테스트에서만 HTMLAudio를 MediaElementSource로, 절차적 효과음을 AnalyserNode로 연결해 100 ms 단위 RMS를 측정했습니다.
- HQ BGM 실측: RMS 중앙값 약 −39 dBFS, 피크 최대 −22 dBFS.
- 버튼 클릭: RMS 상위 10% −30.5 dBFS, 피크 −22 dBFS로 BGM보다 약 9 dB 위입니다.
- 워프 충전음: BGM을 낮춘 상태에서 충전 후반(2.4초 이후)에 BGM보다 커집니다. 섬광음은 RMS −10 dBFS로 BGM보다 약 30 dB 위입니다.
- 도착 맵의 바람 소리(−33 ~ −37 dBFS)는 HQ BGM이 정지된 뒤에 시작됩니다.
- 기존 효과음 파일과 그 볼륨 설정은 바꾸지 않았습니다.
- 주의: 헤드리스 Chrome 측정값입니다. 실제 스피커·이어폰으로 들어 본 청취 검증은 하지 않았으므로, 실제 기기에서 한 번 들어 보시길 권합니다.

### 1-6. AudioManager(`src/game/audioBgm.ts`) 변경
기존 관리자를 그대로 확장했고, 컴포넌트에 BGM 로직을 새로 만들지 않았습니다.
- 트랙 등록: `unit3-hq` 경로 변경, `unit3-basecamp` 추가.
- `BGM_LOUDNESS_TRIM`: 트랙별 gain.
- `BGM_RELEASE_MS`: HQ·캠프 곡이 다른 곡으로 바뀔 때 끊지 않고 1초 동안 줄어들게 합니다. 이 꼬리는 `stopBgm()`(타이틀)에서 함께 정리됩니다.
- 같은 곡을 다시 요청하면: 재생 중이면 그대로 두어 처음부터 다시 시작하지 않습니다. 페이드아웃 중이면 같은 요소의 볼륨을 다시 올려, 중복 재생하거나 정지하지 않습니다.
- `fadeOutBgm(ms, id)`: 지정한 곡이 아닐 때는 아무것도 하지 않습니다(예: 타이밍이 늦게 도착한 fade가 다른 장면의 곡을 끄지 않음).
- `duckBgm(factor, ms, id)`: 워프 충전 중 BGM을 잠깐 낮춥니다.
- `getBgmDebugState()` / `window.__aaBgmDebug`: 읽기 전용 상태 조회로, 브라우저 회귀 테스트에 사용합니다.
- 자동재생 제한 처리: 기존 방식(재생이 거부되면 첫 `pointerdown`/`keydown`에서 다시 시도)을 유지합니다. 실제로는 "확인"(이름 입력)이나 "이어하기" 클릭 뒤에 BGM이 시작되므로 사용자 입력 이후에 재생됩니다.

### 1-7. 브라우저 테스트 (Chrome, 대체 빌드, base `/AdventureAcademy5-2-3/`, Range 지원 정적 서버)

| 시나리오 | 결과 |
|---|---|
| HQ 첫 진입: 재생·loop·볼륨 0.0907·BGM 요소 1개 | PASS |
| HQ 대사 63줄·선택지·캐릭터 등장·연구원 등장·브리핑 동안 같은 요소, 재시작 0회(시간이 계속 증가) | PASS |
| 워프 충전 중 유지(낮춤), 섬광에서 페이드(0.0847→0.0385→0.0113), 도착 맵에서 0개 | PASS |
| 캠프 진입: 재생·loop·볼륨 0.1987·1개 | PASS |
| 캠프 첫 이야기(퀘스트 수락), NPC(데네브·카이든) 대화, 퀘스트 완료 대사·보상 팝업 동안 유지 | PASS |
| 상점 열기/닫기 동안 유지 | PASS |
| 던전 진입 시 페이드아웃(0.185→0.037), 던전 안에서 캠프 BGM 0개 | PASS |
| 던전 나가기 → 캠프에서 다시 재생(1개) | PASS |
| 처음 화면 → BGM 0개 → 이어하기 → 1개 | PASS |
| 새로고침 → 이어하기 → 1개 | PASS |
| HQ 대사 중 새로고침 → 이어하기 → HQ 곡 1개 | PASS |
| HQ 건너뛰기(더블클릭): 페이드아웃 후 정지, 도착 맵에 이어지지 않음 | PASS |
| 도착 건너뛰기 → 캠프 곡 1개 / HQ·도착 연속 빠른 건너뛰기 → 캠프 곡만 1개 | PASS |
| 기본 자동재생 정책(플래그 없음): 확인/이어하기(클릭·키보드) 후 재생 | PASS |
| 파일 끝을 넘을 때 같은 요소로 반복(currentTime 되감김) — HQ·캠프 둘 다 | PASS |
| 콘솔 오류 / WAV 404 | 0건 / 0건 (`intro-adventureacademy.wav`, `unit3-basecamp.wav` 200/206) |

- 판정 근거: 함수 호출만이 아니라 실제 `HTMLMediaElement`의 `paused`, `currentTime`, `volume`, `loop`와 재생 중인 요소 수, 렌더링된 신호 레벨입니다.
- 음질 자체(청감)는 사람이 들어서 확인하지 않았습니다.

---

## 2. GitHub Pages 배포 오류

### 2-1. 확인한 사실 (읽기 전용)
- 이 세션에서 GitHub API(`gh run view --log`)는 권한이 없어 403이 반환되었습니다. 실행 로그 원문은 로그인이 필요해서 읽지 못했습니다. 아래는 공개 웹 페이지에서 확인한 내용입니다.
- **Actions 목록에 실행 기록이 2개뿐**입니다.
  1. `Deploy to GitHub Pages` #1 — 커밋 `fe77863`(phase1 - intro), **실패**, deploy job 18초.
     - 오류 주석: `configure-pages@v5` 단계에서 **"Get Pages site failed. Please verify that the repository has Pages enabled and configured to build using GitHub Actions"**, `HttpError: Not Found`.
     - Artifacts 없음.
  2. `pages-build-deployment` #1 — **성공**. 이 워크플로는 Pages Source가 **"Deploy from a branch"** 일 때 GitHub가 자동으로 실행하는 것입니다.
- 현재 공개 사이트 `https://dhkqpr4624-cell.github.io/AdventureAcademy5-2-3/`는 빌드 결과가 아니라 **저장소의 원본 `index.html`(Vite 빌드 전 소스)**을 제공하고 있습니다.
- 이후 커밋(`449922a`, `736c68b`, `6519693`)에 대한 `Deploy to GitHub Pages` 실행은 공개 목록에 없습니다.
- 사용자가 보낸 `No artifacts named "github-pages"` 로그는 공개 목록에서 찾을 수 없어 직접 대조하지 못했습니다.

### 2-2. 원인 판단
1. **(확인된 주원인)** 저장소의 Pages Source가 **GitHub Actions가 아니라 "Deploy from a branch"** 로 설정되어 있습니다.
   - 근거: configure-pages의 404 주석, `pages-build-deployment` 성공, 공개 사이트가 빌드되지 않은 소스를 제공함.
   - 이 상태에서는 workflow가 성공해도 사이트에 반영되지 않습니다.
   - 이 설정은 사용자 화면에서만 바꿀 수 있으며, 저는 바꾸지 않았습니다(2-5 참고).
2. **(workflow 구조 문제, 수정함)** 기존 workflow는 빌드·업로드·배포가 **한 job**에 들어 있었습니다.
   - GitHub 공식 Pages 템플릿은 `build` job(업로드)과 `deploy` job(`needs: build`)으로 나뉩니다. `deploy-pages`는 "이 실행"에 등록된 `github-pages` artifact를 조회하므로, 같은 job 안에서 업로드 직후 조회하면 artifact가 아직 확정되지 않았을 수 있습니다.
   - 또 `cancel-in-progress: true` 때문에 연속 push 시 앞선 실행이 업로드 도중 취소되어, artifact 없이 끝나는 실행이 생길 수 있습니다.
   - "Found 0 artifact(s)" 메시지는 이 두 경로와 맞지만, 해당 실행의 로그를 직접 보지 못했으므로 **추정**입니다.
   - 단, 빌드나 업로드 단계가 실패하면 기본 동작상 같은 job의 이후 단계는 실행되지 않습니다. 따라서 "빌드 실패 → deploy가 0개 artifact를 조회"하는 경로는 아닌 것으로 봅니다.
3. 빌드 자체 문제는 발견되지 않았습니다.
   - `package-lock.json`이 존재합니다(lockfileVersion 3, vite 7.3.6). `npm run build` = `tsc -b && vite build`.
   - `vite.config.ts`는 `VITE_BASE_PATH`(저장소 이름)를 `/AdventureAcademy5-2-3/`로 바꿉니다.
   - 로컬 tsc와 대체 빌드도 통과했습니다(2-4).
   - `actions/checkout@v6`, `setup-node@v4`, `configure-pages@v5`, `upload-pages-artifact@v4`, `deploy-pages@v4`는 서로 호환되는 조합입니다. 실패 실행의 경고는 "Node 20 액션이 Node 24로 강제 실행된다"는 사용 중단 예고일 뿐 오류가 아닙니다.

### 2-3. 수정한 workflow (`.github/workflows/deploy.yml`)
**Before (요약):**
- job은 `deploy` 하나: checkout → setup-node → configure-pages → npm ci → build → upload-pages-artifact → deploy-pages
- `cancel-in-progress: true`

**After:**
- `build` job: checkout@v6 → setup-node@v4(Node 22, npm cache) → configure-pages@v5 → `npm ci` → `npm run build`(`VITE_BASE_PATH` = 저장소 이름) → **dist 검증** → upload-pages-artifact@v4(`path: dist`, 기본 이름 `github-pages`)
- **dist 검증 단계:**
  - `dist/index.html`이 없으면 실패합니다.
  - 빌드되지 않은 `/src/main.tsx` 참조가 남아 있으면 실패합니다.
  - `/AdventureAcademy5-2-3/assets/` 경로가 없으면 실패합니다.
  - 실패를 숨기지 않고 `::error::`로 표시해 job을 멈춥니다.
- `deploy` job: `needs: build`, environment `github-pages`, deploy-pages@v4. build가 성공해야만 실행되고, 같은 실행의 artifact만 사용합니다.
- `cancel-in-progress: false`로 바꿔, 진행 중인 배포가 중간에 취소되지 않게 했습니다.
- 그대로 둔 것: 트리거(main push, 수동 실행), 권한(`contents: read`, `pages: write`, `id-token: write`), 액션 버전, Node 버전, 빌드 명령.
- 하지 않은 것: punycode 경고 제거, 실패 무시(`continue-on-error`), 존재하지 않는 artifact 참조. `configure-pages`의 `enablement: true`도 넣지 않았습니다(저장소 설정을 바꾸는 동작이기 때문).

### 2-4. 로컬 검증 결과
- 일반 npm 레지스트리에 접근할 수 없어 `npm ci`/`vite build`를 실제로 실행하지 못했습니다. 대신 아래로 검증했습니다.
- `tsc -b`: 통과
- 기존 회귀 검사 `scripts/run-final-checks.mjs`: **84 PASS**, exit 0 (BGM 검사 확장 포함)
- `scripts/bgm-asset-checks.mjs`: WAV 5개가 원본과 바이트 동일하고 PCM 48kHz/16bit/stereo임을 확인 — PASS
- **대체 빌드**(`scripts/local-esbuild-build.mjs`, Vite 대용, `--base=/AdventureAcademy5-2-3/`):
  - `dist/index.html`이 `/AdventureAcademy5-2-3/assets/main-*.js` / `.css`를 참조합니다.
  - 번들의 고정 asset 경로 중 dist에 없는 것은 0개입니다.
  - 새 WAV 2개가 `dist/assets/audio/bgm/`에 포함됩니다.
  - **대체 빌드이므로 실제 Vite 산출물과 해시·분할은 다를 수 있습니다.**
- FBX: 런타임은 FBX가 아니라 변환된 `.bin` 메시를 사용합니다. 원본 FBX는 `art-source/`에 있고 배포 대상이 아닙니다. 브라우저 테스트 중 이미지·WAV·mesh 요청에서 404는 0건이었습니다.
- workflow의 dist 검증 스크립트를 로컬 dist에 그대로 실행해 통과를 확인했습니다. 원본 소스 `index.html`에 대해서는 의도대로 실패하는 것도 확인했습니다.
- YAML 구조를 파싱해 `jobs = [build, deploy]`, `deploy.needs = build`, upload `path: dist`를 확인했습니다.
- **실제 GitHub Actions 실행·배포 성공은 검증하지 않았습니다(실행 금지 사항).**
- dist 크기는 약 730 MB입니다(새 WAV 2개, 약 46 MB 포함). GitHub Pages의 사이트 크기 권장 상한(1 GB) 안이지만 여유가 크지 않습니다.

### 2-5. 사용자가 직접 할 일
1. 저장소 **Settings → Pages → Build and deployment → Source** 를 **"GitHub Actions"** 로 바꿉니다. 현재는 "Deploy from a branch"로 추정됩니다. 이 설정이 바뀌지 않으면 workflow가 성공해도 원본 소스 페이지가 계속 보입니다.
2. 이번 ZIP의 파일을 저장소에 반영(커밋·push)합니다. main push가 새 workflow를 자동 실행합니다. Actions 탭에서 "Run workflow"로 수동 실행해도 됩니다.
3. Actions 탭에서 `build` → `deploy` 두 job이 모두 성공했는지, 사이트가 열리는지 확인합니다. 실패하면 `build` job의 "Verify dist output" 또는 해당 단계의 로그를 보내 주세요.

---

## 3. 공통

### 변경 파일
- `.github/workflows/deploy.yml` — build/deploy 분리, dist 검증, 진행 중 배포 취소 방지
- `public/assets/audio/bgm/intro-adventureacademy.wav` — 신규 (HQ BGM)
- `public/assets/audio/bgm/unit3-basecamp.wav` — 신규 (캠프 BGM)
- `src/game/audioBgm.ts` — 트랙 등록, gain, release fade, 페이드 중 재요청 처리, duck, 상태 조회
- `src/game/chapter3/Chapter3IntroStage.tsx` — 워프 충전 시 낮춤, 섬광 시 페이드아웃
- `src/game/chapter3/Chapter3IntroPlayer.tsx` — 본부 종료/건너뛰기 페이드를 0.4초에서 0.8초로, 대상 트랙 지정
- `src/data/chapter3/chapter3IntroStage.ts` — `hq-researcher`의 긴장 BGM cue 제거
- `src/data/chapter3/chapter3IntroScript.ts` — 주석 1줄
- `src/app/App.tsx` — 캠프 BGM을 새 트랙으로, 캠프를 떠나면 페이드아웃
- `src/bgmFollowupChecks.ts`, `scripts/bgm-asset-checks.mjs` — 검사 갱신·추가
- `docs/chapter3/PHASE2_HOTFIX2_REPORT.md` — 이 보고서
- `CHANGED_FILES.txt`, `DELETED_FILES.txt` — 이번 핫픽스 기준으로 갱신(저장소 루트에 있던 Hotfix 1 목록을 대체)

### 삭제 파일
- 없음. 기존 `basecamp-bgm.wav`, `village-theme.wav`는 다른 트랙·검사에서 쓰므로 그대로 두었습니다.

### 변경하지 않은 것
- 스토리 대사, 던전, 전투, NPC, 퀘스트, 인트로 연출 타이밍, 저장, 인벤토리, 상점, 3D 환경, 기존 효과음 파일과 볼륨.

### 회귀 결과
- tsc 통과, final checks 84 PASS, BGM asset checks PASS, 대체 빌드 성공.
- 브라우저 BGM 시나리오 전부 PASS(1-7), 콘솔 오류 0건, 404 0건.

### 미해결 / 주의
- 실제 Actions 실행·배포는 검증하지 못했습니다. Pages Source 설정 변경이 필요합니다(2-5).
- 사용자가 보낸 "0 artifacts" 실행의 로그 원문은 권한 문제로 직접 보지 못했습니다. 따라서 2-2의 2번은 근거 있는 추정입니다.
- 3단원 1층 던전에는 전용 BGM이 없어, 캠프 곡이 페이드아웃된 뒤 던전은 BGM 없이 진행됩니다. 원하시면 다음 작업에서 던전 BGM을 지정해 주세요.
- 새 곡은 원본 앞뒤 무음 때문에 반복 사이에 약 2.5초 쉼이 있습니다. 끊김 없는 반복을 원하면 무음을 다듬은 파일이 필요합니다.
- 실제 기기에서의 청감 확인은 하지 않았습니다.
