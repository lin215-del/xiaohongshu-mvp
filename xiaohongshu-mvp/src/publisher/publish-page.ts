import type { Page } from 'playwright';
import { URLS } from '../config/constants.js';
import { navigateSafely } from '../utils/navigation.js';

const isLoginRedirectUrl = (url: string): boolean => url.includes('/login') || url.includes('redirectReason=401');

export class PublishPage {
  async open(page: Page): Promise<void> {
    const navigation = await navigateSafely(page, URLS.publish, { label: 'publish-page-open' });
    if (!navigation.ok) {
      throw new Error(`publish page navigation failed: ${navigation.error ?? 'unknown navigation error'}`);
    }

    if (isLoginRedirectUrl(page.url())) {
      throw new Error(`publish page redirected to login: ${page.url()}`);
    }
  }

  async openImageMode(page: Page): Promise<void> {
    const navigation = await navigateSafely(page, URLS.publishImage, { label: 'publish-page-open-image' });
    if (!navigation.ok) {
      throw new Error(`publish image page navigation failed: ${navigation.error ?? 'unknown navigation error'}`);
    }

    if (isLoginRedirectUrl(page.url())) {
      throw new Error(`publish image page redirected to login: ${page.url()}`);
    }
  }
}
