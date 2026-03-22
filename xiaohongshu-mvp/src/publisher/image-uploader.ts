import type { Locator, Page } from 'playwright';
import { SELECTORS } from '../config/selectors.js';

const waitForUploadReady = async (page: Page, timeoutMs: number = 20_000): Promise<void> => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const settled = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      const hasImageEditor = /图片编辑/.test(text);
      const hasImageCount = /\d+\/18/.test(text);
      const hasUploadPrompt = /上传图片，或写文字生成图片/.test(text);
      const hasSpinner = Array.from(document.querySelectorAll('*')).some((element) => {
        const html = element as HTMLElement;
        const className = typeof html.className === 'string' ? html.className : '';
        return /loading|spinner|progress/i.test(className);
      });
      return (hasImageEditor || hasImageCount) && !hasSpinner && !hasUploadPrompt;
    }).catch(() => false);

    if (settled) return;
    await page.waitForTimeout(1_000).catch(() => undefined);
  }
};

const pickUploadInput = async (page: Page, timeoutMs: number = 20_000): Promise<Locator | null> => {
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

    const bodyText = await page.locator('body').innerText().catch(() => '');
    const uploadUiReady = /上传图片，或写文字生成图片|上传图片|文字配图/.test(bodyText);
    if (!uploadUiReady) {
      await page.waitForTimeout(1_000).catch(() => undefined);
      continue;
    }

    await page.waitForTimeout(1_000).catch(() => undefined);
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

  let chooserPromise = page.waitForEvent('filechooser', { timeout: 10_000 }).catch(() => null);
  await uploadButton.click({ force: true }).catch(() => undefined);
  let chooser = await chooserPromise;

  if (!chooser) {
    const panelBox = await panel.boundingBox().catch(() => null);
    if (panelBox) {
      chooserPromise = page.waitForEvent('filechooser', { timeout: 10_000 }).catch(() => null);
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
      return 0;
    }

    const locator = await pickUploadInput(page);
    if (locator) {
      await locator.setInputFiles(imagePaths);
      await waitForUploadReady(page).catch(() => undefined);
      return imagePaths.length;
    }

    const chooserUploaded = await triggerFileChooserUpload(page, imagePaths).catch(() => false);
    if (chooserUploaded) {
      await waitForUploadReady(page).catch(() => undefined);
      return imagePaths.length;
    }

    throw new Error('image upload input not found on publish page');
  }
}
