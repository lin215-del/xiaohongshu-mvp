import type { Locator, Page } from 'playwright';
import { SELECTORS } from '../config/selectors.js';
import { logger } from '../utils/logger.js';

const summarizeUploadState = async (page: Page): Promise<Record<string, unknown>> => {
  return page.evaluate(() => {
    const text = document.body?.innerText || '';
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')).map((input) => {
      const el = input as HTMLInputElement;
      const rect = el.getBoundingClientRect();
      return {
        className: el.className || '',
        accept: el.accept || '',
        multiple: el.multiple,
        width: rect.width,
        height: rect.height
      };
    });

    return {
      currentUrl: location.href,
      hasUploadPrompt: /上传图片，或写文字生成图片|上传图片|文字配图/.test(text),
      hasImageEditor: /图片编辑/.test(text),
      hasTitleAnchor: /填写标题会有更多赞哦|智能标题|0\/20/.test(text),
      hasBodyAnchor: /输入正文描述，真诚有价值的分享予人温暖|# 话题|@ 用户|表情/.test(text),
      hasPreview: /笔记预览|封面预览/.test(text),
      hasDraftButton: /暂存离开/.test(text),
      imageCountHint: text.match(/(\d+)\/18/)?.[1] ?? null,
      fileInputs
    };
  }).catch(() => ({ currentUrl: page.url() }));
};

const waitForUploadReady = async (page: Page, timeoutMs: number = 30_000): Promise<void> => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const settled = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      const hasImageEditor = /图片编辑/.test(text);
      const imageCountMatch = text.match(/(\d+)\/18/);
      const imageCount = imageCountMatch ? Number(imageCountMatch[1]) : 0;
      const hasUploadPrompt = /上传图片，或写文字生成图片/.test(text);
      const hasCoverSuggestion = /获取封面建议/.test(text);
      const hasPreviewTabs = /笔记预览|封面预览/.test(text);
      const hasDeleteControl = /删除|移除/.test(text);
      const hasTitleAnchor = /填写标题会有更多赞哦|智能标题|0\/20/.test(text);
      const hasBodyAnchor = /输入正文描述，真诚有价值的分享予人温暖|# 话题|@ 用户|表情/.test(text);
      const hasSpinner = Array.from(document.querySelectorAll('*')).some((element) => {
        const html = element as HTMLElement;
        const className = typeof html.className === 'string' ? html.className : '';
        return /loading|spinner|progress/i.test(className);
      });

      const strongReady = hasImageEditor && imageCount >= 1 && (hasCoverSuggestion || hasPreviewTabs || hasDeleteControl);
      const editorReady = hasTitleAnchor || hasBodyAnchor;
      return (strongReady || editorReady) && !hasSpinner && !hasUploadPrompt;
    }).catch(() => false);

    if (settled) return;
    await page.waitForTimeout(1_000).catch(() => undefined);
  }

  logger.warn('upload readiness timeout', await summarizeUploadState(page));
  throw new Error('image upload did not reach a stable post-upload editor state within timeout');
};

const pickUploadInput = async (page: Page, timeoutMs: number = 10_000): Promise<Locator | null> => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const exact = page.locator('.upload-content .drag-over input.upload-input[type="file"]').first();
    if ((await exact.count().catch(() => 0)) > 0) {
      return exact;
    }

    for (const candidate of SELECTORS.imageInputCandidates) {
      const matches = page.locator(candidate);
      const count = await matches.count().catch(() => 0);
      for (let index = 0; index < count; index += 1) {
        const locator = matches.nth(index);
        if ((await locator.count().catch(() => 0)) > 0) {
          return locator;
        }
      }
    }

    await page.waitForTimeout(500).catch(() => undefined);
  }

  return null;
};

const triggerFileChooserUpload = async (page: Page, imagePaths: string[]): Promise<boolean> => {
  const panel = page.getByText('上传图片，或写文字生成图片', { exact: false }).first();
  const scopedButton = panel.getByRole('button', { name: '上传图片' }).first();
  const fallbackButton = page.locator('button:has-text("上传图片")').first();
  const uploadButton = await scopedButton.isVisible().catch(() => false) ? scopedButton : fallbackButton;
  const visible = await uploadButton.isVisible().catch(() => false);
  if (!visible) return false;

  logger.info('upload via filechooser button');
  let chooserPromise = page.waitForEvent('filechooser', { timeout: 8_000 }).catch(() => null);
  await uploadButton.click({ force: true }).catch(() => undefined);
  let chooser = await chooserPromise;

  if (!chooser) {
    const panelBox = await panel.boundingBox().catch(() => null);
    if (panelBox) {
      chooserPromise = page.waitForEvent('filechooser', { timeout: 8_000 }).catch(() => null);
      await page.mouse.click(panelBox.x + panelBox.width / 2, panelBox.y + panelBox.height / 2).catch(() => undefined);
      chooser = await chooserPromise;
    }
  }

  if (!chooser) return false;

  await chooser.setFiles(imagePaths);
  return true;
};

export class ImageUploader {
  async upload(page: Page, imagePaths: string[]): Promise<number> {
    if (imagePaths.length === 0) {
      logger.warn('upload skipped because imagePaths is empty');
      return 0;
    }

    logger.info('upload start', { imagePaths });

    const chooserUploaded = await triggerFileChooserUpload(page, imagePaths).catch(() => false);
    if (chooserUploaded) {
      logger.info('upload triggered by filechooser', await summarizeUploadState(page));
      await waitForUploadReady(page).catch(async (error: unknown) => {
        logger.warn('upload readiness soft timeout after filechooser', { error: error instanceof Error ? error.message : String(error) });
      });
      logger.info('upload ready after filechooser', await summarizeUploadState(page));
      return imagePaths.length;
    }

    const locator = await pickUploadInput(page);
    if (locator) {
      await locator.setInputFiles(imagePaths);
      logger.info('upload triggered by input[type=file]', await summarizeUploadState(page));
      await waitForUploadReady(page).catch(async (error: unknown) => {
        logger.warn('upload readiness soft timeout after input[type=file]', { error: error instanceof Error ? error.message : String(error) });
      });
      logger.info('upload ready after input[type=file]', await summarizeUploadState(page));
      return imagePaths.length;
    }

    logger.warn('upload input/button not found', await summarizeUploadState(page));
    throw new Error('image upload input not found on publish page');
  }
}
