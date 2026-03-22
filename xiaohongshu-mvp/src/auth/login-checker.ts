import type { BrowserContext, Page } from 'playwright';
import { LIMITS, URLS } from '../config/constants.js';
import { SELECTORS } from '../config/selectors.js';
import { navigateSafely } from '../utils/navigation.js';

export interface LoginCheckResult {
  loggedIn: boolean;
  reason: string;
  matchedSelector?: string;
  currentUrl?: string;
}

const hasVisibleCandidate = async (page: Page, candidates: string[]): Promise<string | undefined> => {
  for (const candidate of candidates) {
    try {
      const locator = page.locator(candidate).first();
      if (await locator.isVisible({ timeout: 1_000 }).catch(() => false)) {
        return candidate;
      }
    } catch {
      // ignore selector mismatch and continue
    }
  }

  return undefined;
};

const hasLoginCookies = async (context: BrowserContext): Promise<boolean> => {
  const cookies = await context.cookies();
  return cookies.some((cookie) => /xiaohongshu|xhscdn|xiaohongshu\.com/i.test(cookie.domain));
};

const isLoginRedirectUrl = (url: string): boolean => url.includes('/login') || url.includes('redirectReason=401');

export class LoginChecker {
  async prepare(page: Page): Promise<void> {
    if (!page.url() || page.url() === 'about:blank') {
      const navigation = await navigateSafely(page, URLS.login, { label: 'login-prepare' });
      if (!navigation.ok) {
        throw new Error(`failed to open login page: ${navigation.error ?? 'unknown navigation error'}`);
      }
    }
  }

  async check(page: Page): Promise<LoginCheckResult> {
    await this.prepare(page);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(Math.min(LIMITS.defaultDelayMs, 500));

    const currentUrl = page.url();
    if (isLoginRedirectUrl(currentUrl)) {
      return {
        loggedIn: false,
        reason: 'current page is login or 401 redirect',
        currentUrl
      };
    }

    const matchedSelector = await hasVisibleCandidate(page, SELECTORS.loginIndicatorCandidates);
    if (matchedSelector) {
      return {
        loggedIn: true,
        reason: 'login indicator is visible',
        matchedSelector,
        currentUrl
      };
    }

    const hasCookies = await hasLoginCookies(page.context());
    if (hasCookies && currentUrl.includes('creator.xiaohongshu.com')) {
      return {
        loggedIn: true,
        reason: 'creator domain cookies detected on non-login page',
        currentUrl
      };
    }

    return {
      loggedIn: false,
      reason: 'login indicator not found and no valid creator cookies detected',
      currentUrl
    };
  }

  async verifyPublishAccess(page: Page): Promise<LoginCheckResult> {
    const navigation = await navigateSafely(page, URLS.publish, { label: 'publish-access-check' });
    if (!navigation.ok) {
      return {
        loggedIn: false,
        reason: `publish page navigation failed: ${navigation.error ?? 'unknown error'}`,
        currentUrl: page.url()
      };
    }

    await page.waitForTimeout(LIMITS.defaultDelayMs);

    const currentUrl = page.url();
    if (isLoginRedirectUrl(currentUrl)) {
      return {
        loggedIn: false,
        reason: 'publish page redirected to login (401)',
        currentUrl
      };
    }

    return {
      loggedIn: true,
      reason: 'publish page is accessible',
      currentUrl
    };
  }
}
