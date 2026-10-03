import { expect, test, type Page } from '@playwright/test';

/**
 * 收集瀏覽器端的錯誤，供「不得有 runtime／CSP 錯誤」斷言使用。
 * 只鎖定真正的錯誤（pageerror 與 console error），不把 warning 當失敗。
 */
function collectErrors(page: Page): { pageErrors: string[]; consoleErrors: string[] } {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  return { pageErrors, consoleErrors };
}

function assertNoCspOrEvalErrors(pageErrors: string[], consoleErrors: string[]) {
  const all = [...pageErrors, ...consoleErrors];
  const bad = all.filter((e) =>
    /content security policy|evalerror|unsafe-eval|refused to evaluate|refused to execute inline/i.test(
      e
    )
  );
  expect(bad, `CSP/runtime 錯誤:\n${bad.join('\n')}`).toEqual([]);
  expect(pageErrors, `未捕捉例外:\n${pageErrors.join('\n')}`).toEqual([]);
}

test.describe('冒煙：公開頁面與認證閘門', () => {
  test('登入頁可載入，且無 runtime／CSP 錯誤', async ({ page }) => {
    const errors = collectErrors(page);

    await page.route('**/api/auth/check-init', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ initialized: true }),
      })
    );

    await page.goto('/login');
    await expect(page.getByText('玄覺空間').first()).toBeVisible();

    assertNoCspOrEvalErrors(errors.pageErrors, errors.consoleErrors);
  });

  test('未登入造訪保護頁會導向登入頁，且無 runtime／CSP 錯誤', async ({ page }) => {
    const errors = collectErrors(page);

    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: '未認證' }),
      })
    );

    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);

    assertNoCspOrEvalErrors(errors.pageErrors, errors.consoleErrors);
  });
});
