import type { Locator, Page } from 'playwright';
import { SELECTORS } from '../config/selectors.js';

const pickTagInput = async (page: Page): Promise<Locator | null> => {
  for (const candidate of SELECTORS.tagInputCandidates) {
    const locator = page.locator(candidate).first();
    if (await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }

  return null;
};

export class TagHandler {
  async apply(page: Page, tags: string[]): Promise<string[]> {
    if (tags.length === 0) {
      return [];
    }

    const input = await pickTagInput(page);
    if (!input) {
      return [];
    }

    for (const tag of tags) {
      const normalized = tag.startsWith('#') ? tag : `#${tag}`;
      await input.click().catch(() => undefined);
      await input.fill('');
      await input.fill(normalized);
      await input.press('Enter').catch(() => undefined);
    }

    return tags;
  }
}
