import type { Locator, Page } from 'playwright';
import type { PublishContent } from '../types/publish.js';
import { LIMITS } from '../config/constants.js';
import { SELECTORS } from '../config/selectors.js';

const pickFirstVisible = async (page: Page, candidates: string[]): Promise<Locator | null> => {
  for (const candidate of candidates) {
    const locator = page.locator(candidate).first();
    if (await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }

  return null;
};

const getTagName = async (locator: Locator): Promise<string> =>
  locator.evaluate((element) => element.tagName.toLowerCase()).catch(() => 'div');

export class Editor {
  async detectMode(page: Page): Promise<'video' | 'image' | 'unknown'> {
    const videoAnchor = await pickFirstVisible(page, SELECTORS.videoModeAnchors);
    if (videoAnchor) return 'video';

    const imageAnchor = await pickFirstVisible(page, SELECTORS.imageModeAnchors);
    if (imageAnchor) return 'image';

    return 'unknown';
  }

  async switchToImagePostMode(page: Page): Promise<boolean> {
    const beforeMode = await this.detectMode(page);
    if (beforeMode === 'image') return true;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const exactTextTab = page.getByText('上传图文', { exact: true }).first();
      const exactVisible = await exactTextTab.isVisible().catch(() => false);

      if (exactVisible) {
        await exactTextTab.scrollIntoViewIfNeeded().catch(() => undefined);
        await exactTextTab.click({ force: true }).catch(() => undefined);
      } else {
        const tab = await pickFirstVisible(page, SELECTORS.publishTypeTabCandidates);
        if (!tab) {
          await page.waitForTimeout(1_500).catch(() => undefined);
          continue;
        }
        await tab.scrollIntoViewIfNeeded().catch(() => undefined);
        await tab.click({ force: true }).catch(() => undefined);
      }

      await page.waitForTimeout(LIMITS.publishModeSwitchWaitMs).catch(() => undefined);
      const afterMode = await this.detectMode(page);
      if (afterMode === 'image') return true;
    }

    return false;
  }

  async waitForEditableFields(page: Page): Promise<{ titleInput: Locator | null; bodyEditor: Locator | null; mode: 'video' | 'image' | 'unknown' }> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < LIMITS.editorProbeTimeoutMs) {
      const titleInput = await pickFirstVisible(page, SELECTORS.titleInputCandidates);
      const bodyEditor = await pickFirstVisible(page, SELECTORS.bodyEditorCandidates);
      const mode = await this.detectMode(page);

      if (titleInput || bodyEditor) {
        return { titleInput, bodyEditor, mode };
      }

      await page.waitForTimeout(LIMITS.editorProbeIntervalMs).catch(() => undefined);
    }

    return {
      titleInput: await pickFirstVisible(page, SELECTORS.titleInputCandidates),
      bodyEditor: await pickFirstVisible(page, SELECTORS.bodyEditorCandidates),
      mode: await this.detectMode(page)
    };
  }

  async fill(page: Page, content: Pick<PublishContent, 'title' | 'body'>): Promise<void> {
    const beforeMode = await this.detectMode(page);
    await this.switchToImagePostMode(page).catch(() => false);
    await page.waitForTimeout(2_000).catch(() => undefined);

    const probed = await this.waitForEditableFields(page);
    const currentMode = probed.mode;
    const titleInput = probed.titleInput;
    const bodyEditor = probed.bodyEditor;

    if (!titleInput && !bodyEditor && currentMode === 'video') {
      throw new Error(
        `publish page is still in video mode, and no editable fields were found (before=${beforeMode}, after=${currentMode})`
      );
    }

    if (!titleInput) {
      throw new Error(`title input not found on publish page (mode=${currentMode})`);
    }

    await titleInput.scrollIntoViewIfNeeded().catch(() => undefined);
    await titleInput.click().catch(() => undefined);

    const titleTag = await getTagName(titleInput);
    if (titleTag === 'textarea' || titleTag === 'input') {
      await titleInput.fill('').catch(() => undefined);
      await titleInput.fill(content.title);
    } else {
      await titleInput.evaluate((element, value) => {
        if (element instanceof HTMLElement) {
          element.focus();
          element.textContent = value;
          element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
        }
      }, content.title);
    }

    if (!bodyEditor) {
      throw new Error(`body editor not found on publish page (mode=${currentMode})`);
    }

    await bodyEditor.scrollIntoViewIfNeeded().catch(() => undefined);
    await bodyEditor.click().catch(() => undefined);

    const bodyTag = await getTagName(bodyEditor);
    if (bodyTag === 'textarea' || bodyTag === 'input') {
      await bodyEditor.fill('').catch(() => undefined);
      await bodyEditor.fill(content.body);
      return;
    }

    await bodyEditor.evaluate((element, value) => {
      if (element instanceof HTMLElement) {
        element.focus();
        element.textContent = value;
        element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
      }
    }, content.body);
  }
}
