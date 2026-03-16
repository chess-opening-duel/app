import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { users, createTwoPlayerContexts, loginBothPlayers } from '../helpers/auth';
import { cleanupPairData } from '../helpers/cleanup';
import {
  createSeriesChallenge,
  waitForPhase,
  waitForSnabbdomReady,
  selectors,
  confirm,
  selectOpenings,
  getGameState,
} from '../helpers/series';

/**
 * Test 30: Opening Color Mismatch Bug (GitHub Issue #101)
 *
 * 재현 시나리오:
 * 1. P1(akeem)의 풀에 Najdorf 서브변형 5종을 white/black 양쪽으로 등록 (총 10칸)
 *    → 같은 이름의 오프닝이 white/black 두 가지로 존재
 * 2. P1이 Pick Phase에서 black 오프닝만 5개 선택
 * 3. Ban Phase 진행
 * 4. 게임 시작 시 P1이 올바르게 black으로 플레이하는지 검증
 *
 * 버그: 같은 이름의 오프닝이 white/black으로 있을 때 backend에서
 *       find(_.name == name)으로 첫 번째 매칭(white)을 반환하여
 *       black을 픽했는데 white로 게임이 시작되는 문제
 */

const p1User = users.akeem;
const p2User = users.rudra;
const p1Username = p1User.username;
const p2Username = p2User.username;
const pairUsers = [p1Username, p2Username];

// Najdorf 서브변형 5종 × white/black = 10칸
// c: true = white (Play as White), c: false = black (Play as Black)
const poolOpenings = [
  {
    i: 'sicilian-defense-najdorf-variation-english-attack',
    n: 'Sicilian Defense: Najdorf Variation, English Attack',
    f: 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N1B3/PPP2PPP/R2QKB1R b KQkq -',
    u: '/opening/Sicilian_Defense_Najdorf_Variation_English_Attack',
    c: true,
  },
  {
    i: 'sicilian-defense-najdorf-variation-english-attack',
    n: 'Sicilian Defense: Najdorf Variation, English Attack',
    f: 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N1B3/PPP2PPP/R2QKB1R b KQkq -',
    u: '/opening/Sicilian_Defense_Najdorf_Variation_English_Attack',
    c: false,
  },
  {
    i: 'sicilian-defense-najdorf-variation-lipnitsky-attack',
    n: 'Sicilian Defense: Najdorf Variation, Lipnitsky Attack',
    f: 'rnbqkb1r/1p2pppp/p2p1n2/8/2BNP3/2N5/PPP2PPP/R1BQK2R b KQkq -',
    u: '/opening/Sicilian_Defense_Najdorf_Variation_Lipnitsky_Attack',
    c: true,
  },
  {
    i: 'sicilian-defense-najdorf-variation-lipnitsky-attack',
    n: 'Sicilian Defense: Najdorf Variation, Lipnitsky Attack',
    f: 'rnbqkb1r/1p2pppp/p2p1n2/8/2BNP3/2N5/PPP2PPP/R1BQK2R b KQkq -',
    u: '/opening/Sicilian_Defense_Najdorf_Variation_Lipnitsky_Attack',
    c: false,
  },
  {
    i: 'sicilian-defense-najdorf-variation-opocensky-variation',
    n: 'Sicilian Defense: Najdorf Variation, Opocensky Variation',
    f: 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP1BPPP/R1BQK2R b KQkq -',
    u: '/opening/Sicilian_Defense_Najdorf_Variation_Opocensky_Variation',
    c: true,
  },
  {
    i: 'sicilian-defense-najdorf-variation-opocensky-variation',
    n: 'Sicilian Defense: Najdorf Variation, Opocensky Variation',
    f: 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP1BPPP/R1BQK2R b KQkq -',
    u: '/opening/Sicilian_Defense_Najdorf_Variation_Opocensky_Variation',
    c: false,
  },
  {
    i: 'sicilian-defense-najdorf-variation-adams-attack',
    n: 'Sicilian Defense: Najdorf Variation, Adams Attack',
    f: 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N4P/PPP2PP1/R1BQKB1R b KQkq -',
    u: '/opening/Sicilian_Defense_Najdorf_Variation_Adams_Attack',
    c: true,
  },
  {
    i: 'sicilian-defense-najdorf-variation-adams-attack',
    n: 'Sicilian Defense: Najdorf Variation, Adams Attack',
    f: 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N4P/PPP2PP1/R1BQKB1R b KQkq -',
    u: '/opening/Sicilian_Defense_Najdorf_Variation_Adams_Attack',
    c: false,
  },
  {
    i: 'sicilian-defense-najdorf-variation-traditional-line',
    n: 'Sicilian Defense: Najdorf Variation, Traditional Line',
    f: 'rnb1k2r/1pq1bppp/p2ppn2/6B1/3NPP2/2N2Q2/PPP3PP/R3KB1R w KQkq -',
    u: '/opening/Sicilian_Defense_Najdorf_Variation_Traditional_Line',
    c: true,
  },
  {
    i: 'sicilian-defense-najdorf-variation-traditional-line',
    n: 'Sicilian Defense: Najdorf Variation, Traditional Line',
    f: 'rnb1k2r/1pq1bppp/p2ppn2/6B1/3NPP2/2N2Q2/PPP3PP/R3KB1R w KQkq -',
    u: '/opening/Sicilian_Defense_Najdorf_Variation_Traditional_Line',
    c: false,
  },
];

let screenshotCounter = 0;
function makeScreenshot(testInfo: typeof test) {
  return async (name: string, page: import('@playwright/test').Page) => {
    screenshotCounter++;
    const label = `${String(screenshotCounter).padStart(2, '0')}-${name}`;
    await testInfo.info().attach(label, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  };
}

test.describe('Test 30: Opening Color Mismatch Bug (#101)', () => {
  test.beforeAll(() => {
    cleanupPairData(pairUsers);
  });

  test('[Test 30] 같은 오프닝 white/black 혼재 시 올바른 색상 배정', async ({ browser }) => {
    test.setTimeout(180_000);
    const screenshot = makeScreenshot(test);
    const { player1Context, player2Context, player1, player2 } =
      await createTwoPlayerContexts(browser, p1User, p2User);

    try {
      // ===== Step 1: MongoDB로 P1 풀 세팅 =====
      // Najdorf 5종 × white/black = 10칸
      await test.step('P1: MongoDB로 풀 세팅 (Najdorf 5종 × white/black)', async () => {
        const openingsJson = JSON.stringify(poolOpenings.map(o => ({
          i: o.i, n: o.n, f: o.f, u: o.u, c: o.c,
        })));
        const fs = require('fs');
        const tmpFile = '/tmp/test30-mongo.js';
        fs.writeFileSync(
          tmpFile,
          `db.opening_pool.updateOne(` +
            `{ _id: "${p1Username}" },` +
            `{ $set: { op: ${openingsJson}, ua: new Date() }},` +
            `{ upsert: true })`,
        );

        try {
          execSync(`docker cp ${tmpFile} app-mongodb-1:/tmp/test30-mongo.js`, {
            encoding: 'utf-8',
            timeout: 10000,
          });
          execSync(
            `docker exec app-mongodb-1 mongosh lichess --quiet --file /tmp/test30-mongo.js`,
            { encoding: 'utf-8', timeout: 10000 },
          );
          console.log('[Test 30] Pool set via MongoDB (Najdorf 5종 × white/black = 10)');
        } catch (e) {
          console.error('[Test 30] MongoDB pool setup failed:', e);
          throw e;
        }

        // 풀 확인
        await player1.goto('/opening');
        await player1.waitForLoadState('networkidle');
        const rows = player1.locator('.opening__pool__row');
        await expect(rows).toHaveCount(10);
        await screenshot('pool-najdorf-dual-color', player1);
      });

      // ===== Step 2: 시리즈 생성 =====
      let seriesId: string;
      await test.step('시리즈 생성', async () => {
        await loginBothPlayers(player1, player2, p1User, p2User);
        seriesId = await createSeriesChallenge(player1, player2, p2Username);
        console.log(`[Test 30] Series created: ${seriesId}`);
      });

      // ===== Step 3: P1이 black 오프닝만 5개 선택 =====
      // 핵심: 같은 이름의 white가 있는데도 black만 골라야 함
      await test.step('P1: Pick Phase에서 black 오프닝만 5개 선택', async () => {
        await waitForPhase(player1, 'Pick Phase');
        await waitForSnabbdomReady(player1);

        const blackOpenings = player1.locator(
          `${selectors.opening}.owner-black:not(.selected):not(.disabled)`,
        );
        const blackCount = await blackOpenings.count();
        console.log(`[Test 30] Available black openings: ${blackCount}`);
        expect(blackCount).toBe(5);

        for (let i = 0; i < 5; i++) {
          const unselected = player1.locator(
            `${selectors.opening}.owner-black:not(.selected):not(.disabled)`,
          );
          await unselected.first().click();
          await player1.waitForTimeout(150);
        }

        // 5개 선택 확인, 모두 owner-black인지 확인
        const selectedCount = await player1.locator(selectors.openingSelected).count();
        expect(selectedCount).toBe(5);
        const selectedBlack = await player1
          .locator(`${selectors.openingSelected}.owner-black`)
          .count();
        expect(selectedBlack).toBe(5);
        console.log('[Test 30] Selected 5 black openings (white counterparts exist in pool)');

        await screenshot('p1-picked-black-only', player1);
        await confirm(player1);
      });

      // ===== Step 4: P2도 5개 선택 + 확정 =====
      await test.step('P2: Pick Phase에서 5개 선택 + 확정', async () => {
        await waitForPhase(player2, 'Pick Phase');
        await waitForSnabbdomReady(player2);
        await selectOpenings(player2, 5);
        await confirm(player2);
      });

      // ===== Step 5: Ban Phase =====
      await test.step('P1: Ban Phase에서 2개 밴 + 확정', async () => {
        await waitForPhase(player1, 'Ban Phase');
        await waitForSnabbdomReady(player1);
        await selectOpenings(player1, 2);
        await confirm(player1);
      });

      await test.step('P2: Ban Phase에서 2개 밴 + 확정 → RandomSelecting 스크린샷', async () => {
        await waitForPhase(player2, 'Ban Phase');
        await waitForSnabbdomReady(player2);
        await selectOpenings(player2, 2);
        await screenshot('p2-ban-phase', player2);

        await confirm(player2);

        // Ban 양측 확정 후 bothConfirmedDelay(3s) → JS가 /random-selecting URL로 리다이렉트
        await player1.waitForURL(/\/random-selecting/, { timeout: 30_000 });
        await player1.waitForLoadState('networkidle');
        await screenshot('random-selecting-p1', player1);

        await player2.waitForURL(/\/random-selecting/, { timeout: 30_000 });
        await player2.waitForLoadState('networkidle');
        await screenshot('random-selecting-p2', player2);
      });

      // ===== Step 7: 게임 시작 후 색상 검증 =====
      await test.step('게임 시작 후 P1의 오프닝이 black으로 배정됐는지 검증', async () => {
        // 게임 페이지 대기
        await player1.waitForURL(/\/[a-zA-Z0-9]{8}(\/|$)/, { timeout: 30_000 });

        // Series API에서 gameId 추출
        let gameId: string | null = null;
        for (let i = 0; i < 30; i++) {
          const resp = await player1.request.get(
            `http://localhost:8080/series/${seriesId!}`,
            { headers: { Accept: 'application/json' } },
          );
          const data = await resp.json();
          if (data.games?.length > 0) {
            gameId = data.games[data.games.length - 1].gameId;
            break;
          }
          await player1.waitForTimeout(1000);
        }
        expect(gameId).toBeTruthy();
        console.log(`[Test 30] Game started: ${gameId}`);

        // Series API에서 사용된 오프닝의 ownerColor 확인
        const seriesResponse = await player1.request.get(
          `http://localhost:8080/series/${seriesId!}`,
          { headers: { Accept: 'application/json' } },
        );
        const seriesData = await seriesResponse.json();
        const usedOpening = seriesData.openings?.find(
          (o: { usedInRound: number | null }) => o.usedInRound !== null,
        );

        const p1Index = seriesData.players.findIndex(
          (p: { user?: { id: string } }) =>
            p.user?.id?.toLowerCase() === p1Username.toLowerCase(),
        );

        console.log(
          `[Test 30] Used opening: "${usedOpening?.name}", ownerColor: ${usedOpening?.ownerColor}, owner: ${usedOpening?.owner}, p1Index: ${p1Index}`,
        );

        // 핵심 검증: P1이 픽한 오프닝이면 ownerColor가 반드시 black이어야 함
        // (버그 상태: find(_.name == name)이 같은 이름의 white를 먼저 반환 → ownerColor가 white)
        if (usedOpening?.owner === p1Index) {
          expect(usedOpening.ownerColor).toBe('black');
          console.log('[Test 30] ✓ P1 opening ownerColor is correctly "black" (not "white")');
        }

        // Game Export API로 실제 게임 색상 확인
        await player1.goto(`http://localhost:8080/${gameId}`);
        await player1.waitForLoadState('networkidle');

        const gameState = await getGameState(player1, gameId!);
        console.log(
          `[Test 30] Game colors — White: ${gameState.whitePlayer}, Black: ${gameState.blackPlayer}`,
        );

        // P1의 오프닝이 사용됐으면, P1은 black을 맡아야 함
        if (usedOpening?.owner === p1Index) {
          expect(gameState.blackPlayer).toBe(p1Username.toLowerCase());
          console.log(`[Test 30] ✓ P1(${p1Username}) is correctly playing BLACK`);
        }

        // chessground orientation 확인
        const cgWrap = player1.locator('.cg-wrap');
        await expect(cgWrap).toBeVisible({ timeout: 10_000 });
        const isWhiteOrientation = await cgWrap.evaluate(el =>
          el.classList.contains('orientation-white'),
        );
        const p1Color = isWhiteOrientation ? 'white' : 'black';
        console.log(`[Test 30] P1 board orientation: ${p1Color}`);

        if (gameState.whitePlayer === p1Username.toLowerCase()) {
          expect(isWhiteOrientation).toBe(true);
        } else {
          expect(isWhiteOrientation).toBe(false);
        }

        await screenshot('game-color-verified', player1);
      });
    } finally {
      await player1Context.close();
      await player2Context.close();
    }
  });
});
