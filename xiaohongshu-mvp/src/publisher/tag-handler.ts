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

const appendTagsToEditor = async (page: Page, tags: string[]): Promise<boolean> => {
  const normalizedText = tags.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)).join(' ');
  const editor = page.locator('[contenteditable="true"], textarea, .ql-editor').first();
  const visible = await editor.isVisible().catch(() => false);
  if (!visible) return false;

  await editor.click().catch(() => undefined);
  const tagName = await editor.evaluate((element) => element.tagName.toLowerCase()).catch(() => 'div');

  if (tagName === 'textarea' || tagName === 'input') {
    const currentValue = await editor.inputValue().catch(() => '');
    await editor.fill(`${currentValue}${currentValue ? '\n' : ''}${normalizedText}`.trim()).catch(() => undefined);
    return true;
  }

  await editor.evaluate((element, value) => {
    if (element instanceof HTMLElement) {
      element.focus();
      document.execCommand('insertText', false, ` ${value}`);
    }
  }, normalizedText).catch(() => undefined);
  return true;
};

export class TagHandler {
  async apply(page: Page, tags: string[]): Promise<string[]> {
    if (tags.length === 0) {
      return [];
    }

    const input = await pickTagInput(page);
    if (!input) {
      const appended = await appendTagsToEditor(page, tags);
      return appended ? tags : [];
    }

    for (const tag of tags) {
      const normalized = tag.startsWith('#') ? tag : `#${tag}`;
      const role = await input.getAttribute('role').catch(() => null);
      const tagName = await input.evaluate((element) => element.tagName.toLowerCase()).catch(() => 'div');
      await input.click().catch(() => undefined);

      if (tagName === 'input' || tagName === 'textarea') {
        await input.fill('').catch(() => undefined);
        await input.fill(normalized);
        await input.press('Enter').catch(() => undefined);
      } else if (role === 'button' || normalized.includes('#')) {
        const appended = await appendTagsToEditor(page, [normalized]);
        if (!appended) {
          await input.press('Enter').catch(() => undefined);
        }
      }
    }

    return tags;
  }
}
