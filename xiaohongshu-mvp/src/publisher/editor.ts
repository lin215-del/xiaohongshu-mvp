import type { Locator, Page } from 'playwright';
import type { PublishContent } from '../types/publish.js';
import { LIMITS } from '../config/constants.js';
import { SELECTORS } from '../config/selectors.js';

const isActuallyVisible = async (locator: Locator): Promise<boolean> => {
  const visible = await locator.isVisible().catch(() => false);
  if (!visible) return false;

  const box = await locator.boundingBox().catch(() => null);
  if (!box) return false;
  if (box.width <= 0 || box.height <= 0) return false;
  if (box.x + box.width <= 0 || box.y + box.height <= 0) return false;

  const metrics = await locator.evaluate((element) => {
    const html = element as HTMLElement;
    const style = window.getComputedStyle(html);
    return {
      left: style.left || '',
      top: style.top || '',
      position: style.position || ''
    };
  }).catch(() => ({ left: '', top: '', position: '' }));

  if (metrics.position === 'absolute' && (metrics.left === '-9999px' || metrics.top === '-9999px')) {
    return false;
  }

  return true;
};

const pickFirstVisible = async (page: Page, candidates: string[]): Promise<Locator | null> => {
  for (const candidate of candidates) {
    const matches = page.locator(candidate);
    const count = await matches.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const locator = matches.nth(index);
      if (await isActuallyVisible(locator)) {
        return locator;
      }
    }
  }

  return null;
};

const getTagName = async (locator: Locator): Promise<string> =>
  locator.evaluate((element) => element.tagName.toLowerCase()).catch(() => 'div');

const isImageLoadingState = async (page: Page): Promise<boolean> => {
  return page.evaluate(() => {
    const bodyText = document.body?.innerText || '';
    const hasVideoMarkers = /上传视频|拖拽视频到此|点击上传视频|视频大小支持/.test(bodyText);
    const hasImageMarkers = /上传图片|拖拽图片|添加图片|图文/.test(bodyText);
    const hasSkeleton = Array.from(document.querySelectorAll('*')).some((element) => {
      const html = element as HTMLElement;
      const className = html.className || '';
      return typeof className === 'string' && /skeleton|loading|placeholder/i.test(className);
    });
    return !hasVideoMarkers && (hasImageMarkers || hasSkeleton);
  }).catch(() => false);
};

export class Editor {
  async detectMode(page: Page): Promise<'video' | 'image' | 'unknown'> {
    const currentUrl = page.url();
    if (currentUrl.includes('target=image')) return 'image';

    const videoAnchor = await pickFirstVisible(page, SELECTORS.videoModeAnchors);
    if (videoAnchor) return 'video';

    const imageAnchor = await pickFirstVisible(page, SELECTORS.imageModeAnchors);
    if (imageAnchor) return 'image';

    return 'unknown';
  }

  async switchToImagePostMode(page: Page): Promise<boolean> {
    const beforeMode = await this.detectMode(page);
    if (beforeMode === 'image') return true;

    await page.waitForLoadState('domcontentloaded').catch(() => undefined);
    await page.waitForTimeout(2_500).catch(() => undefined);

    if (!page.url().includes('target=image')) {
      await page.goto('https://creator.xiaohongshu.com/publish/publish?from=tab_switch&target=image', { waitUntil: 'domcontentloaded', timeout: 90_000 }).catch(() => undefined);
      await page.waitForTimeout(2_000).catch(() => undefined);
      const directMode = await this.detectMode(page);
      if (directMode === 'image') return true;
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const classTabs = page.locator('.creator-tab').filter({ hasText: '上传图文' });
      const classTabCount = await classTabs.count().catch(() => 0);

      let clicked = false;
      for (let index = 0; index < classTabCount; index += 1) {
        const tab = classTabs.nth(index);
        const visible = await isActuallyVisible(tab);
        if (!visible) continue;

        await tab.scrollIntoViewIfNeeded().catch(() => undefined);
        await tab.click({ force: true }).catch(() => undefined);
        clicked = true;
        await page.waitForTimeout(800).catch(() => undefined);

        const afterDirectClick = await this.detectMode(page);
        if (afterDirectClick === 'image') return true;
        if (afterDirectClick === 'unknown' && await isImageLoadingState(page)) return true;

        const box = await tab.boundingBox().catch(() => null);
        if (box) {
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => undefined);
          await page.waitForTimeout(800).catch(() => undefined);
          const afterMouseClick = await this.detectMode(page);
          if (afterMouseClick === 'image') return true;
          if (afterMouseClick === 'unknown' && await isImageLoadingState(page)) return true;
        }
      }

      const ancestorClicked = await page.evaluate(() => {
        const isActuallyVisibleElement = (element: HTMLElement) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          if (rect.width <= 0 || rect.height <= 0) return false;
          if (rect.right <= 0 || rect.bottom <= 0) return false;
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          if (style.position === 'absolute' && (style.left === '-9999px' || style.top === '-9999px')) return false;
          return true;
        };

        const textTargets = Array.from(document.querySelectorAll('*')).filter((element) => {
          const html = element as HTMLElement;
          const text = (html.textContent || '').trim();
          return text === '上传图文' && isActuallyVisibleElement(html);
        }) as HTMLElement[];

        let clicks = 0;
        for (const element of textTargets) {
          const clickable = element.closest('.creator-tab, [role="tab"], button, a, [class*="tab"]') as HTMLElement | null;
          const target = clickable ?? element;
          if (!isActuallyVisibleElement(target)) continue;
          target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          target.click();
          target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          clicks += 1;
        }
        return clicks;
      }).catch(() => 0);

      if (ancestorClicked > 0) {
        clicked = true;
        await page.waitForTimeout(1_200).catch(() => undefined);
        const afterAncestorClick = await this.detectMode(page);
        if (afterAncestorClick === 'image') return true;
        if (afterAncestorClick === 'unknown' && await isImageLoadingState(page)) return true;
      }

      const domClicked = await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('.creator-tab')) as HTMLElement[];
        const targets = tabs.filter((tab) => {
          const rect = tab.getBoundingClientRect();
          const style = window.getComputedStyle(tab);
          return (tab.textContent || '').includes('上传图文')
            && rect.width > 0
            && rect.height > 0
            && rect.right > 0
            && rect.bottom > 0
            && style.display !== 'none'
            && style.visibility !== 'hidden'
            && !(style.position === 'absolute' && (style.left === '-9999px' || style.top === '-9999px'));
        });
        for (const tab of targets) {
          tab.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          tab.click();
          tab.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        }
        return targets.length;
      }).catch(() => 0);

      if (domClicked > 0) {
        clicked = true;
        await page.waitForTimeout(1_200).catch(() => undefined);
        const afterDomClick = await this.detectMode(page);
        if (afterDomClick === 'image') return true;
        if (afterDomClick === 'unknown' && await isImageLoadingState(page)) return true;
      }

      if (!clicked) {
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
      if (afterMode === 'unknown' && await isImageLoadingState(page)) return true;
    }

    return false;
  }

  async waitForEditableFields(page: Page): Promise<{ titleInput: Locator | null; bodyEditor: Locator | null; mode: 'video' | 'image' | 'unknown' }> {
    const startedAt = Date.now();
    let seenImageLoading = false;

    while (Date.now() - startedAt < LIMITS.editorProbeTimeoutMs) {
      const titleInput = await pickFirstVisible(page, SELECTORS.titleInputCandidates);
      const bodyEditor = await pickFirstVisible(page, SELECTORS.bodyEditorCandidates);
      const mode = await this.detectMode(page);
      const imageLoading = await isImageLoadingState(page);
      if (imageLoading) seenImageLoading = true;

      if (titleInput || bodyEditor) {
        return { titleInput, bodyEditor, mode: mode === 'unknown' && imageLoading ? 'image' : mode };
      }

      await page.waitForTimeout(LIMITS.editorProbeIntervalMs).catch(() => undefined);
    }

    const finalMode = await this.detectMode(page);
    const finalImageLoading = await isImageLoadingState(page);
    return {
      titleInput: await pickFirstVisible(page, SELECTORS.titleInputCandidates),
      bodyEditor: await pickFirstVisible(page, SELECTORS.bodyEditorCandidates),
      mode: finalMode === 'unknown' && (finalImageLoading || seenImageLoading) ? 'image' : finalMode
    };
  }

  async fill(page: Page, content: Pick<PublishContent, 'title' | 'body'>): Promise<void> {
    const beforeMode = await this.detectMode(page);
    await this.switchToImagePostMode(page).catch(() => false);
    await page.waitForTimeout(2_000).catch(() => undefined);

    const probed = await this.waitForEditableFields(page);
    const currentMode = probed.mode;
    let titleInput = probed.titleInput;
    let bodyEditor = probed.bodyEditor;

    if (!titleInput && !bodyEditor && currentMode === 'video') {
      throw new Error(
        `publish page is still in video mode, and no editable fields were found (before=${beforeMode}, after=${currentMode})`
      );
    }

    if ((!titleInput || !bodyEditor) && currentMode === 'image') {
      const sharedEditable = await pickFirstVisible(page, ['[contenteditable="true"]', 'textarea', '.ql-editor']);
      if (!titleInput) titleInput = sharedEditable;
      if (!bodyEditor) bodyEditor = sharedEditable;
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
          if (element.isContentEditable) {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(element);
            range.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(range);
            document.execCommand('insertText', false, value);
          } else {
            element.textContent = value;
            element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
          }
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
        if (element.isContentEditable) {
          document.execCommand('insertText', false, `\n${value}`);
        } else {
          element.textContent = `${element.textContent || ''}\n${value}`;
          element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
        }
      }
    }, content.body);
  }
}
