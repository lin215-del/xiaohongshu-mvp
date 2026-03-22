import type { Page } from 'playwright';
import { LIMITS } from '../config/constants.js';

export interface NavigateSafelyOptions {
  label?: string;
  timeoutMs?: number;
}

export interface NavigateSafelyResult {
  ok: boolean;
  url: string;
  strategy: 'domcontentloaded' | 'load' | 'commit' | 'noop';
  error?: string;
}

const normalizeUrl = (value: string): string => value.replace(/\/+$/, '');

const tryGoto = async (
  page: Page,
  url: string,
  waitUntil: 'domcontentloaded' | 'load' | 'commit',
  timeout: number
): Promise<NavigateSafelyResult> => {
  try {
    await page.goto(url, { waitUntil, timeout });
    return {
      ok: true,
      url: page.url(),
      strategy: waitUntil
    };
  } catch (error) {
    return {
      ok: false,
      url: page.url(),
      strategy: waitUntil,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

export const navigateSafely = async (
  page: Page,
  url: string,
  options: NavigateSafelyOptions = {}
): Promise<NavigateSafelyResult> => {
  const currentUrl = page.url();
  if (currentUrl && currentUrl !== 'about:blank' && normalizeUrl(currentUrl) === normalizeUrl(url)) {
    return {
      ok: true,
      url: currentUrl,
      strategy: 'noop'
    };
  }

  const primaryTimeout = options.timeoutMs ?? LIMITS.navigationTimeoutMs;

  const primary = await tryGoto(page, url, 'domcontentloaded', primaryTimeout);
  if (primary.ok) {
    return primary;
  }

  const postPrimaryUrl = page.url();
  if (postPrimaryUrl && postPrimaryUrl !== 'about:blank' && normalizeUrl(postPrimaryUrl) === normalizeUrl(url)) {
    return {
      ok: true,
      url: postPrimaryUrl,
      strategy: 'noop'
    };
  }

  await page.waitForTimeout(1_000).catch(() => undefined);

  const fallbackUrl = page.url();
  if (fallbackUrl && fallbackUrl !== 'about:blank' && normalizeUrl(fallbackUrl) === normalizeUrl(url)) {
    return {
      ok: true,
      url: fallbackUrl,
      strategy: 'noop'
    };
  }

  const fallback = await tryGoto(page, url, 'commit', LIMITS.fallbackNavigationTimeoutMs);
  if (fallback.ok) {
    return fallback;
  }

  return fallback.error?.includes('interrupted by another navigation')
    ? {
        ok: false,
        url: page.url(),
        strategy: fallback.strategy,
        error: `navigation was interrupted by a concurrent redirect${options.label ? ` during ${options.label}` : ''}`
      }
    : fallback;
};
