import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Page } from 'playwright';

export const captureScreenshot = async (page: Page, targetPath: string): Promise<string> => {
  await mkdir(dirname(targetPath), { recursive: true });
  await page.screenshot({ path: targetPath, fullPage: true });
  return targetPath;
};
