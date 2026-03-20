# E2E 테스트 (Playwright)

두 플레이어 동시 제어를 위한 브라우저 자동화 테스트.

## 실행 방법

```bash
cd tests/e2e
npm install              # 최초 1회
npm test                 # 전체 테스트 (headless, HTML 리포트 생성)
npm run test:headed      # 브라우저 표시
npm run test:debug       # 디버그 모드
npm run test:ui          # Playwright UI 모드
npm run report           # HTML 테스트 리포트 보기
```

## 테스트 구조

```
tests/e2e/
├── package.json           # npm 스크립트
├── playwright.config.ts   # Playwright 설정 (workers: 3, rate limiting OFF)
├── global-setup.ts        # 55개 테스트 계정 로그인 + 세션 저장
├── global-teardown.ts     # DB 리셋 (MongoDB + Redis)
├── helpers/
│   ├── auth.ts            # 계정 정보, 로그인 헬퍼, 브라우저 컨텍스트
│   ├── scenarios.ts       # 테스트 시나리오 매트릭스 (PickBanBehavior, testScenarios)
│   └── series.ts          # 시리즈 조작 헬퍼 (selectOpenings, confirm 등)
└── specs/
    ├── series-scenarios.spec.ts       # 시리즈 시나리오 (7개: 역전, 서든데스 등)
    ├── series-countdown.spec.ts       # Countdown 표시/취소
    ├── series-disconnect.spec.ts      # Disconnect/Abort (Pick, Ban, Game, Resting, Selecting)
    ├── series-forfeit.spec.ts         # Series Forfeit
    ├── series-finished.spec.ts        # Finished Page + Rematch
    ├── series-finished-mobile.spec.ts # Finished Page 모바일 스크롤
    ├── series-resting.spec.ts         # Resting Phase (confirm, timeout)
    ├── series-nostart.spec.ts         # NoStart (미착수 패배)
    ├── series-pool-exhaustion.spec.ts # Pool Exhaustion → Draw
    ├── series-reconnect-banner.spec.ts # Reconnection 배너
    ├── series-lobby.spec.ts           # Lobby 매칭
    ├── series-ai.spec.ts              # AI Opening Duel
    ├── series-color-mismatch.spec.ts  # Opening Color Mismatch 버그
    ├── opening-pool.spec.ts           # Opening Pool 페이지
    └── opening-pool-customize.spec.ts # Opening Pool 커스터마이즈
```

## 테스트 계정 생성

새 테스트 계정을 추가하려면 3개 파일 수정 후 DB 리셋 필요:

**1. `repos/lila-db-seed/spamdb/data/uids.txt`** - 사용자명 추가
```
elena
hans
newuser1
newuser2
```

**2. `tests/e2e/helpers/auth.ts`** - users 객체에 추가
```typescript
export const users = {
  // ... 기존 유저
  newuser1: { username: 'newuser1', password: 'password', storageState: '.auth/newuser1.json' },
  newuser2: { username: 'newuser2', password: 'password', storageState: '.auth/newuser2.json' },
} as const;
```

**3. `tests/e2e/global-setup.ts`** - users 배열에 추가
```typescript
const users = [
  // ... 기존 유저
  { username: 'newuser1', password: 'password', file: '.auth/newuser1.json' },
  { username: 'newuser2', password: 'password', file: '.auth/newuser2.json' },
];
```

**4. DB 리셋**
```bash
./lila-docker db
```

> **참고**: 모든 테스트 계정의 비밀번호는 `password`

## 테스트 시나리오 매트릭스

각 테스트는 고유한 계정 쌍을 사용하며, pick/ban 행동과 시리즈 결과를 정의함.

| Spec 파일 | P1 | P2 | pick | ban | series result | games | score | 시나리오 |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| scenarios | elena | hans | ✅/✅ | ✅/✅ | 0 - ½ - 1 - 1 | 4 | 2.5-1.5 | 역전승 |
| scenarios | yulia | luis | ✅/⏰ | ✅/🚫 | 1 - 1 - 1 | 3 | 3-0 | 3연승 |
| scenarios | ana | lola | ⏰/✅ | 🚫/✅ | 0 - 1 - 0 - 1 - ½ - 1 | 6 | 3.5-2.5 | 서든데스 |
| scenarios | carlos | nina | ⚠️/✅ | ✅/⚠️ | 0 - 0 - 1 - 1 - 1 | 5 | 3-2 | 0-2 역전 |
| scenarios | oscar | petra | ✅/⚠️ | ⚠️/✅ | 1 - ½ - 1 | 3 | 2.5-0.5 | 조기승리 |
| scenarios | boris | david | 🚫/✅ | ✅/⏰ | 1 - 0 - 1 - 0 - ½ - 1 | 6 | 3.5-2.5 | 서든데스 |
| scenarios | mei | ivan | ✅/🚫 | ⏰/✅ | 0 - 1 - 1 - 1 | 4 | 3-1 | 4경기 |
| disconnect | angel | bobby | ✅/🔌 | - | - | - | abort | Pick disconnect |
| disconnect | marcel | vera | ✅/✅ | ✅/🔌 | - | - | abort | Ban disconnect |
| forfeit | fatima | diego | ✅/✅ | ✅/✅ | forfeit(moves) | 1 | forfeit | P1 forfeit after moves |
| forfeit | salma | benjamin | ✅/✅ | ✅/✅ | forfeit(no moves) | 1 | forfeit | P1 forfeit before moves |
| finished | patricia | adriana | ✅/✅ | ✅/✅ | 1 - 1 - 1 | 3 | 3-0 | Finished page + rematch |
| countdown | mary | jose | ✅/✅ | ✅/✅ | - | 1 | - | Countdown 표시 + 감소 |
| countdown | iryna | pedro | ✅/✅ | ✅/✅ | - | 1 | - | Countdown cancel + 재시작 |
| disconnect | aaron | jacob | ✅/✅ | ✅/✅ | disconnect(game) | 1 | 1-0 | Game DC → game loss |
| disconnect | svetlana | qing | ✅/✅ | ✅/✅ | 0 - 0 + disconnect | 3 | 1-2 | Game 3 DC after 0-2 |
| pool-exhaustion | dmitry | milena | ✅/✅ | ✅/✅ | ½ - ½ - ½ - ½ - ½ - ½ | 6 | 3-3 draw | 풀 소진 → 시리즈 Draw |
| resting | yaroslava | ekaterina | ✅/✅ | ✅/✅ | P2 resign + resting | 2 | - | Resting: confirm→cancel→re-confirm→countdown |
| resting | margarita | yevgeny | ✅/✅ | ✅/✅ | P1 resign + resting | 2 | - | Resting: confirm→cancel→30s timeout |
| disconnect | kwame | sonia | ✅/✅ | ✅/✅ | 1 + selecting timeout | 2 | - | Selecting timeout → 랜덤 선택 |
| disconnect | tomoko | renata | ✅/✅ | ✅/✅ | 0 + resting both DC | 1 | abort | Resting 양측 DC → abort |
| disconnect | yarah | suresh | ✅/✅ | ✅/✅ | 0 + resting 1 DC | 1 | forfeit | Resting 1 DC → forfeit |
| nostart | yunel | idris | ✅/✅ | ✅/✅ | nostart | 1 | - | NoStart: 양측 미착수 |
| nostart | aleksandr | veer | ✅/✅ | ✅/✅ | nostart | 1 | - | NoStart: 후수 미착수 |
| nostart | aleksandr | veer | ✅/✅ | ✅/✅ | nostart | 1 | - | NoStart: 타이머 지연 |
| reconnect-banner | frances | emmanuel | ✅/✅ | - | - | - | - | Reconnection 배너 표시 |
| lobby | elizabeth | dae | ✅/✅ | ✅/✅ | 0 (1 game only) | 1 | active | Lobby hook 매칭 → 시리즈 생성 |
| ai | mateo | - | - | - | - | 1 | forfeit | AI vs Stockfish |
| pool | elena | - | - | - | - | - | - | Opening Pool 페이지 렌더링 |
| pool-customize | ramesh | nushi | ✅/✅ | ✅/✅ | - | 1 | - | 커스텀 pool → Pick Phase |
| color-mismatch | akeem | rudra | ✅/✅ | ✅/✅ | - | 1 | - | Opening color mismatch 버그 |
| finished-mobile | gabriela | guang | ✅/✅ | ✅/✅ | 1 - 1 - 1 | 3 | 3-0 | Finished 모바일 스크롤 |

## Pick/Ban 행동 타입

| | 타입 | pick (5개 필요) | ban (2개 필요) |
|:---:|:---:|:---|:---|
| ✅ | `confirm` | 5개 선택 + confirm 버튼 클릭 | 2개 선택 + confirm 버튼 클릭 |
| ⏰ | `full-timeout` | 5개 선택, confirm 안 함 → 타임아웃 | 2개 선택, confirm 안 함 → 타임아웃 |
| ⚠️ | `partial-timeout` | 1~4개 선택 → 타임아웃 (서버가 랜덤 채움) | 1개 선택 → 타임아웃 (서버가 랜덤 채움) |
| 🚫 | `none-timeout` | 0개 선택 → 타임아웃 (서버가 전부 랜덤) | 0개 선택 → 타임아웃 (서버가 전부 랜덤) |
| 🔌 | `disconnected` | WebSocket 연결 끊김 → 시리즈 abort | WebSocket 연결 끊김 → 시리즈 abort |

**커버리지 검증:**

| 행동 | pick-p1 | pick-p2 | ban-p1 | ban-p2 |
|:---:|:---:|:---:|:---:|:---:|
| confirm | elena,yulia,oscar,mei | elena,ana,carlos,boris | elena,yulia,carlos,boris | elena,ana,oscar,mei |
| full-timeout | ana | yulia | mei | boris |
| partial-timeout | carlos | oscar | oscar | carlos |
| none-timeout | boris | mei | ana | yulia |
| disconnected | - | angel | - | marcel |

→ 16개 조합 (4 행동 × 4 위치) 모두 커버됨 + disconnect 2개

## Series Result 표기법

P1 관점에서 각 게임 결과를 `-`로 구분:
- `1` = P1 승리 (1점)
- `0` = P1 패배 (0점)
- `1/2` = 무승부 (0.5점)

예시: `0 - 1/2 - 1 - 1` = P1이 G1 패배, G2 무승부, G3 승리, G4 승리 → 2.5점

## 테스트 작성 가이드

**1. 테스트 이름 형식:**
```typescript
// describe: "유저 vs 유저: 시나리오"
// test: 서술적 시나리오 설명
test.describe('elena vs hans: 역전승 4게임', () => {
  test('역전승 4게임', async ({ browser }) => {...});
});
```

**2. 테스트 구조:**
```typescript
test.describe('elena vs hans: 역전승 4게임', () => {
  test.describe.configure({ timeout: 120000 });
  const pairUsers = ['elena', 'hans'];

  test.beforeAll(() => cleanupPairData(pairUsers));

  test('역전승 4게임', async ({ browser }) => {
    // 1. 시리즈 생성 + 밴픽 완료
    await completeBanPickPhase(player1, player2, {
      pick: { p1: 'confirm', p2: 'confirm' },
      ban: { p1: 'confirm', p2: 'confirm' },
    });

    // 2. 게임 진행 (series result에 따라)
    // 0 - 1/2 - 1 - 1 = P1 패배, 무승부, 승리, 승리
    await playOneGame(..., 'p1-resign');  // G1: P1 패배
    await playOneGame(..., 'draw');        // G2: 무승부
    await playOneGame(..., 'p2-resign');  // G3: P1 승리
    await playOneGame(..., 'p2-resign');  // G4: P1 승리

    // 3. 시리즈 종료 확인
    expect(await isSeriesFinished(player1, seriesId)).toBe(true);
  });
});
```

**3. 새 테스트 추가 시:**
1. 매트릭스에 새 행 추가 (spec 파일명 + 시나리오 설명)
2. 새 계정 쌍 추가 (uids.txt, global-setup.ts, auth.ts)
3. 기존 테스트와 중복되지 않는 pick/ban 조합 선택
4. series result로 테스트할 시나리오 정의

**주의사항:**
- 독립적인 테스트 → 같은 계정 쌍은 하나의 테스트에서만 사용
- `beforeAll`로 해당 쌍의 데이터만 정리 (전체 DB 리셋 X)
- `globalTeardown`에서 전체 DB 리셋 (`./lila-docker db`)
- 비밀번호: 전부 `password`

## 실행 설정

**최적 설정 (권장):**
- `ENABLE_RATE_LIMITING=false` (settings.env)
- `workers: 3` (playwright.config.ts)

| Rate Limiting | Workers | 통과 | 시간 |
|:---:|:---:|:---:|:---:|
| ON | 7 | 4/7 | ~2m |
| OFF | 7 | 5/7 | 2.1m |
| ON | 1 | 7/7 | 5.6m |
| OFF | 3 | 7/7 | 3.0m |
| OFF | 6 | 10/12 | 4.9m |
| **OFF** | **3** | **12/12** | **6.4m** |

## 태그 기반 필터 실행

각 테스트에 `@phase:*`, `@feature:*`, `@scope:*` 태그가 부여되어 관심사별 실행 가능.

```bash
npx playwright test --grep @feature:disconnect   # disconnect 관련만
npx playwright test --grep @scope:quick          # 빠른 테스트만 (<2분)
npx playwright test --grep @phase:resting        # resting 페이즈 포함 테스트
npx playwright test --grep-invert @scope:slow    # 느린 테스트 제외
```

**Phase tags** (`@phase:*`): `pick`, `ban`, `game`, `resting`, `selecting` — 실제 거치는 페이즈
**Feature tags** (`@feature:*`): `disconnect`, `forfeit`, `ai`, `pool`, `countdown`, `rematch`, `mobile`, `lobby`, `reconnect`, `nostart`
**Scope tags** (`@scope:*`): `quick` (<2분), `slow` (>2분)

## Claude 가이드라인

- 테스트 실행 시 항상 HTML 리포트 사용 (`npm test` 후 `npm run report`)
- 테스트 실패 시 리포트 확인을 유저에게 안내
- 새 시나리오 추가 시 매트릭스 기반으로 설계
- 테스트 이름은 서술적으로 작성 (번호 사용 금지)

## 실전 팁

- **병렬 실행**: 12개 테스트가 독립적 → `workers: 3`으로 안정적 병렬 실행
- **API 기반 검증**: UI 대신 Series API로 상태 확인 (`isSeriesFinished`)
- **게임 상태 조회**: Game Export API로 정확한 FEN 조회 (`/game/export/{gameId}`)
- **스크린샷**: 주요 시점마다 `test.info().attach()`로 첨부
- **Disconnect 테스트**: `page.close()`로 WS 연결 끊김 시뮬레이션 → Pick/Ban: 30s timeout 후 abort 검증, Playing: claim victory 후 game loss 검증

## 테스트 계정 쌍 목록

| P1 | P2 | 시나리오 | Spec 파일 |
|:---:|:---:|:---|:---|
| elena | hans | 밴픽 역전승 | series-scenarios |
| boris | david | 밴픽 서든데스 P1 선행 | series-scenarios |
| yulia | luis | 밴픽 3연승 | series-scenarios |
| mei | ivan | 밴픽 4경기 | series-scenarios |
| ana | lola | 밴픽 서든데스 P2 선행 | series-scenarios |
| carlos | nina | 밴픽 0-2 역전 | series-scenarios |
| oscar | petra | 밴픽 조기승리 | series-scenarios |
| angel | bobby | Pick disconnect → abort | series-disconnect |
| marcel | vera | Ban disconnect → abort | series-disconnect |
| fatima | diego | Forfeit after moves | series-forfeit |
| salma | benjamin | Forfeit before moves | series-forfeit |
| patricia | adriana | Finished page + rematch | series-finished |
| mary | jose | Countdown 표시 + 감소 | series-countdown |
| iryna | pedro | Countdown cancel + 재시작 | series-countdown |
| aaron | jacob | Game DC → game loss | series-disconnect |
| svetlana | qing | Game 3 DC after 0-2 | series-disconnect |
| dmitry | milena | Pool exhaustion → Draw | series-pool-exhaustion |
| yaroslava | ekaterina | Resting confirm | series-resting |
| margarita | yevgeny | Resting timeout | series-resting |
| yunel | idris | NoStart neither moves | series-nostart |
| aleksandr | veer | NoStart second mover | series-nostart |
| monica | yun | NoStart timer delayed | series-nostart |
| ramesh | nushi | Pool customize → Pick Phase | opening-pool-customize |
| kwame | sonia | Selecting timeout → random | series-disconnect |
| tomoko | renata | Resting both DC → abort | series-disconnect |
| yarah | suresh | Resting 1 DC → forfeit | series-disconnect |
| frances | emmanuel | Reconnection banner | series-reconnect-banner |
| elizabeth | dae | Lobby hook matching | series-lobby |
| mateo | - | AI vs Stockfish | series-ai |
| akeem | rudra | Opening color mismatch | series-color-mismatch |
| gabriela | guang | Finished mobile scroll | series-finished-mobile |
| elena | - | Opening Pool 페이지 | opening-pool |

> **중요**: 각 쌍은 하나의 테스트에서만 사용 (병렬 충돌 방지)

## 핵심 헬퍼 함수 레퍼런스 (series.ts)

### 시리즈 생성 & 밴픽

| 함수 | 설명 |
|:---|:---|
| `createSeriesChallenge(p1, p2, p2Name)` | Friend Challenge로 시리즈 생성 → 픽 페이지까지. `seriesId` 반환 |
| `createSeriesViaLobby(p1, p2, p1Name, p2Name, screenshot?)` | "Opening Duel with Anyone" 로비 hook 매칭으로 시리즈 생성. localStorage로 rating range 확장 |
| `completeBanPickPhase(p1, p2, opts?, screenshot?)` | Pick→Ban→RandomSelecting→Game 자동 진행 |
| `selectOpenings(page, count)` | 비선택/비비활성 오프닝 N개 클릭 |
| `confirm(page)` | Pick/Ban 확인 버튼 클릭 |
| `waitForPhase(page, phaseName, timeout?)` | 특정 Phase까지 대기 (header text 기반) |
| `waitForSnabbdomReady(page)` | Snabbdom 초기화 대기 (서버 렌더 → 클라이언트 전환) |

### 게임 진행

| 함수 | 설명 |
|:---|:---|
| `playBothMoves(p1, p2, user1, user2)` | 양측 1수씩 UI 클릭으로 진행 (turn 자동 감지) |
| `playOneGame(p1, p2, user1, user2, result)` | 양측 1수 + result 실행. `result`: `'p1-resign'` / `'p2-resign'` / `'draw'` |
| `makeAnyMove(page)` | 아무 합법수 1수를 보드 클릭으로 진행 |
| `makeMoveViaUI(page, from, to)` | 특정 수를 보드 클릭으로 진행 (click-click 패턴) |
| `resignGame(page)` | UI 버튼으로 resign. **양측 1수 이상 필요** |
| `offerDrawViaUI(page)` | UI 버튼으로 draw 제안 (제안자) |
| `acceptDrawViaUI(page)` | UI 버튼으로 draw 수락 (수락자) |
| `waitForNextGame(p1, p2, null, prevGameId)` | 게임 종료 후 다음 게임 대기 (Selecting/RandomSelecting 자동 처리) |

### 시리즈 상태 확인

| 함수 | 설명 |
|:---|:---|
| `isSeriesFinished(page, seriesId?, retries?)` | Series API로 status=30(Finished) 확인. 재시도 지원 |
| `isSeriesAborted(page, seriesId, retries?)` | Series API로 status=40(Aborted) 확인 |
| `getSeriesWinner(page, seriesId)` | Series API로 winner index 조회 (0 또는 1 또는 null) |
| `getPlayerIndex(page, seriesId, username)` | 특정 유저의 시리즈 내 인덱스 조회 (0 또는 1) |
| `executeSeriesResult(p1, p2, user1, user2, result, seriesId)` | series result 문자열 기반 전체 시리즈 자동 실행 |

### Forfeit 관련

| 함수 | 설명 |
|:---|:---|
| `clickSeriesForfeitButton(page)` | 게임 페이지의 X(forfeit) 버튼 클릭 |
| `confirmSeriesForfeit(page)` | forfeit 확인 다이얼로그의 확인 버튼 클릭 |
| `forfeitSeriesViaApi(page, seriesId)` | `POST /series/{id}/forfeit` API 직접 호출 |

### Countdown 관련

| 함수 | 설명 |
|:---|:---|
| `waitForCountdownText(page, timeout?)` | 카운트다운 텍스트 표시 대기. 텍스트 반환 |
| `getCountdownText(page)` | 현재 카운트다운 텍스트 (없으면 null) |
| `parseCountdownSeconds(page)` | 카운트다운 텍스트에서 초 파싱 ("...starting in N...") |
| `waitForCountdownGone(page, timeout?)` | 카운트다운 텍스트 사라짐 대기 |
| `verifyCountdownDecrements(page, timeout?)` | 카운트다운 감소 검증. `{ initial, after }` 반환 |

### Resting Phase 관련

| 함수 | 설명 |
|:---|:---|
| `waitForRestingUI(page, timeout?)` | Resting UI (`.follow-up.series-rest`) 표시 대기 |
| `confirmNextInResting(page, timeout?)` | "Confirm"/"View result" 버튼 클릭 (다음 진행 확인) |
| `cancelNextInResting(page, timeout?)` | "Cancel" 버튼 클릭 (확인 취소) |
| `getRestingTimeLeft(page)` | 타이머에서 남은 초 파싱 |

### Finished Page 관련

| 함수 | 설명 |
|:---|:---|
| `waitForFinishedPage(page, seriesId, timeout?)` | `/series/{id}/finished` 리다이렉트 대기 |
| `verifyFinishedPageUI(page, expectedGameCount)` | Finished 페이지 UI 검증 (배너, 점수, 테이블) |
| `clickRematchButton(page)` | Rematch 버튼 클릭 |
| `isRematchOfferSent(page)` | "Rematch Offer Sent" 상태 확인 |
| `isRematchGlowing(page)` | 상대의 glowing Rematch 버튼 확인 |
| `waitForRematchRedirect(page, timeout?)` | 리매치 수락 후 새 시리즈 리다이렉트 대기 |

## UI 셀렉터 레퍼런스

### Pick/Ban 페이지 (`selectors`)

```
.series-pick                        # 픽/밴 페이지 컨테이너
.series-pick__header h1             # Phase 이름 ("Pick Phase", "Ban Phase" 등)
.series-pick__timer .timer-display  # 타이머
.series-pick__opening               # 오프닝 카드
.series-pick__opening.selected      # 선택된 오프닝
.series-pick__opening.disabled      # 비활성 오프닝
.series-pick__action-btn            # 확인/취소 버튼 (Snabbdom 렌더 후 존재)
.series-pick.random-selecting       # RandomSelecting 페이지
.series-pick.selecting-waiting      # Selecting에서 패자 대기 화면
.series-pick__opponent-status       # 상대 상태 (.ready / .waiting / .disconnected)
.series-pick__countdown-text       # 카운트다운 텍스트 ("Ban phase starting in 3..." / "Game N starting in 3...")
```

### Resting Phase - 게임 페이지 (`selectors`)

```
.follow-up.series-rest                          # Resting UI 컨테이너 (게임 종료 위젯 내)
button.button-green.series-rest__confirm        # "Confirm" 버튼 (비마지막: "Confirm", 마지막: "View result")
button.button-metal.series-rest__cancel         # "Cancel" 버튼 (확인 취소)
.series-rest__timer                             # 타이머 (비마지막: "Next game starts in 28", 마지막: "Results in 28")
.series-rest__opponent-status                   # 상대 상태 ("Waiting for opponent...")
.series-rest__opponent-status.ready             # 상대 Ready ("Opponent is Ready!")
.series-rest__timer:has-text("Game starting in") # 카운트다운 (비마지막: "Game starting in 3...", 마지막: "Showing results in 3...")
```

### 게임 페이지 (`gameSelectors`)

```
cg-board, .cg-board                 # 체스보드
button.fbt.resign                   # 일반 resign 버튼
button.fbt.draw-yes                 # 무승부 제안 버튼
button.fbt.series-forfeit           # 시리즈 forfeit 버튼 (시리즈 게임만)
.act-confirm button.fbt.yes         # 확인 다이얼로그 (resign/forfeit 공유)
.act-confirm button.fbt.yes.draw-yes # 무승부 확인 다이얼로그
.ricons                             # 게임 컨트롤 버튼 컨테이너
.result-wrap                        # 게임 종료 오버레이
```

### Finished 페이지 (`finishedSelectors`)

```
.series-finished                           # Finished 페이지 컨테이너
.series-finished__result-banner            # Victory!/Defeat 배너
.series-finished__result-banner.victory    # 승리 배너
.series-finished__result-banner.defeat     # 패배 배너
.series-finished__result-banner.draw       # 무승부 배너 (노란색)
.series-finished__players                  # 플레이어 영역
.series-finished__score                    # 플레이어 점수
.series-finished__vs                       # "vs" 구분자
.series-finished__score-table              # 점수 테이블
tr.series-score__row                       # 게임별 결과 행
.series-score__label                       # "Opening Duel" 라벨
.series-finished__actions                  # 액션 버튼 영역
button.series-finished__rematch            # Rematch 버튼
button.series-finished__rematch.glowing    # 상대 offer 시 글로잉 버튼
button.series-finished__rematch[disabled]  # Offer 전송 후 비활성 버튼
a.series-finished__home                    # Home 버튼
```

### 시리즈 vs 일반 게임 버튼 레이아웃

| 버튼 | 일반 게임 | 시리즈 게임 |
|:---|:---:|:---:|
| abort/forfeit | abort (< 2수) | X (forfeit series) |
| takeback | ✅ (≥ 2수) | ✅ (≥ 2수) |
| draw | ✅ | ✅ |
| resign | ✅ | ✅ (flag) |

> 시리즈 게임: `mandatory()` 포함 → `abortable()=false`, 항상 4개 버튼 표시

## Series API 응답 형식

`GET /series/{id}` (Accept: application/json)

```json
{
  "id": "abcd1234",
  "phase": 30,           // 10=Picking, 20=Banning, 25=RandomSelecting, 30=Playing, 40=Selecting, 50=Finished
  "phaseName": "Playing",
  "status": 20,          // 10=Created, 20=Started, 30=Finished, 40=Aborted
  "bestOf": 5,
  "round": 1,
  "players": [
    { "index": 0, "score": 0, "confirmedPicks": true, "confirmedBans": true, "isOnline": true, "user": {"id":"...", "name":"..."} },
    { "index": 1, "score": 0, "confirmedPicks": true, "confirmedBans": true, "isOnline": true, "user": {"id":"...", "name":"..."} }
  ],
  "openings": [...],
  "games": [{ "gameId": "...", "round": 1, "openingId": "...", "whitePlayer": 0, "result": "white" }],
  "finished": false,
  "winner": null,         // 0, 1, 또는 null
  "povIndex": 0,          // 요청자 기준 인덱스
  "currentGame": "gameId",
  "timeLeft": 25000       // Picking/Banning/Selecting에서만
}
```

> **참고**: `score`는 표시 점수 (승리=1, 무승부=0.5, 패배=0). API가 `displayScore`를 반환함 (내부 값 × 2가 아님)
>
> **주의**: `winner`와 `players[].index`는 **글로벌 인덱스** (POV 무관). 챌린저가 항상 player 0이 아님!
> 플레이어 순서는 **랜덤 색상 배정**에 따라 결정됨 (`ChallengeJoiner.scala`의 `c.finalColor`).
> 따라서 테스트에서 winner를 검증할 때 `getPlayerIndex()`로 실제 인덱스를 확인해야 함.

## Game Export API (게임 상태 조회)

게임 상태 조회에 Game Export API 사용 (인증 불필요).

| Method | Path | 설명 |
|:---|:---|:---|
| GET | `/game/export/{gameId}` | 게임 상태 JSON 조회 (Accept: application/json) |

### 응답 예시

```json
{
  "initialFen": "rnbqkb1r/...",
  "moves": "e4 e5 Nf3 ...",
  "players": {
    "white": { "user": { "id": "elena" } },
    "black": { "user": { "id": "hans" } }
  }
}
```

> **참고**: Board API (`/api/board/game/...`)는 Series 게임에 대해 **차단**되어 있음 (봇/엔진 방지).

## Cleanup 패턴

```typescript
// 특정 유저 쌍의 데이터만 정리 (beforeAll에서 호출)
function cleanupPairData(usernames: string[]) {
  const mongoCommand = `
    db.game5.deleteMany({ "players.user.id": { $in: ${JSON.stringify(usernames)} } });
    db.series.deleteMany({ "players.userId": { $in: ${JSON.stringify(usernames)} } });
    db.challenge.deleteMany({ $or: [
      { "challenger.user.id": { $in: ${JSON.stringify(usernames)} } },
      { "destUser.id": { $in: ${JSON.stringify(usernames)} } }
    ]});
  `.replace(/\n/g, ' ');
  execSync(`docker exec app-mongodb-1 mongosh lichess --quiet --eval '${mongoCommand}'`);
}
```

## 테스트 타임아웃 가이드

| 시나리오 | 기본 | 타임아웃 행동 포함 | 비고 |
|:---|:---:|:---:|:---|
| 밴픽 (confirm/confirm) | 60s | - | base 60s + 게임당 20s |
| 밴픽 (timeout 포함) | 60s | +35s/timeout | 서버 30s timeout 대기 |
| Disconnect/Abort | 120s | - | 30s phase timeout + margin |
| Forfeit | 120s | - | 밴픽 + 게임 시작 + forfeit 처리 |
