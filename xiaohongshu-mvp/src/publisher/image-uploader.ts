import type { Locator, Page } from 'playwright';
import { SELECTORS } from '../config/selectors.js';

const pickUploadInput = async (page: Page): Promise<Locator | null> => {
  for (const candidate of SELECTORS.imageInputCandidates) {
    const locator = page.locator(candidate).first();
    if ((await locator.count().catch(() => 0)) > 0) {
      return locator;
    }
  }

  return null;
};

export class ImageUploader {
  async upload(page: Page, imagePaths: string[]): Promise<number> {
    if (imagePaths.length === 0) {
      return 0;
    }

    const locator = await pickUploadInput(page);
    if (!locator) {
      throw new Error('image upload input not found on publish page');
    }

    // TODO: 真实联调时增加上传完成态检测，例如缩略图出现、进度条消失、错误提示捕获。
    await locator.setInputFiles(imagePaths);
    return imagePaths.length;
  }
}
