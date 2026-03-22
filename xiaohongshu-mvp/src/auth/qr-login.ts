import { resolve } from 'node:path';
import type { Locator, Page } from 'playwright';
import { LIMITS, PATHS, URLS } from '../config/constants.js';
import { SELECTORS } from '../config/selectors.js';
import { delay } from '../utils/delay.js';
import { navigateSafely } from '../utils/navigation.js';
import { captureScreenshot } from '../utils/screenshot.js';
import { LoginChecker } from './login-checker.js';

export interface QrLoginResult {
  scanned: boolean;
  message: string;
  screenshotPath?: string;
}

const pickVisible = async (page: Page, candidates: string[]): Promise<Locator | null> => {
  for (const candidate of candidates) {
    const locator = page.locator(candidate).first();
    if (await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }

  return null;
};

export class QrLoginWatcher {
  private readonly loginChecker = new LoginChecker();

  async openLoginPage(page: Page): Promise<void> {
    const navigation = await navigateSafely(page, URLS.login, { label: 'qr-login-page' });
    if (!navigation.ok) {
      throw new Error(`failed to open QR login page: ${navigation.error ?? 'unknown navigation error'}`);
    }
  }

  async switchToQrLogin(page: Page): Promise<boolean> {
    const tab = await pickVisible(page, SELECTORS.qrLoginTabCandidates);
    if (!tab) {
      return false;
    }

    await tab.click().catch(() => undefined);
    await page.waitForTimeout(1_500).catch(() => undefined);
    return true;
  }

  async captureQrScreenshot(page: Page, accountId: string = 'default'): Promise<string | undefined> {
    const qrLocator = await pickVisible(page, SELECTORS.qrPanelCandidates);
    const screenshotPath = resolve(PATHS.screenshotDir, `${accountId}-login-qr.png`);

    if (qrLocator) {
      await qrLocator.scrollIntoViewIfNeeded().catch(() => undefined);
    }

    await captureScreenshot(page, screenshotPath).catch(() => undefined);
    return screenshotPath;
  }

  async waitForQrPanel(page: Page): Promise<boolean> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < LIMITS.qrPanelWaitMs) {
      const qrLocator = await pickVisible(page, SELECTORS.qrPanelCandidates);
      if (qrLocator) {
        return true;
      }
      await delay(500);
    }

    return false;
  }

  async waitForScan(page: Page, timeoutMs: number = LIMITS.qrWaitTimeoutMs, accountId: string = 'default'): Promise<QrLoginResult> {
    await this.openLoginPage(page);
    await page.waitForLoadState('domcontentloaded').catch(() => undefined);
    await this.switchToQrLogin(page).catch(() => false);

    const qrVisible = await this.waitForQrPanel(page);
    const screenshotPath = await this.captureQrScreenshot(page, accountId);

    const initialMessage = qrVisible
      ? 'QR panel detected; waiting for user login'
      : 'QR panel not detected; waiting for manual login on current page';

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (page.isClosed()) {
        return {
          scanned: false,
          message: 'login page was closed before login completed',
          screenshotPath
        };
      }

      const login = await this.loginChecker.check(page).catch(() => ({ loggedIn: false, reason: 'login check failed' }));
      if (login.loggedIn) {
        return {
          scanned: true,
          message: 'login detected after manual interaction',
          screenshotPath
        };
      }

      await delay(LIMITS.pollIntervalMs);
    }

    return {
      scanned: false,
      message: `${initialMessage}; login timed out after ${timeoutMs}ms`,
      screenshotPath
    };
  }
}
