import type { Locator, Page } from 'playwright';
import { SELECTORS } from '../config/selectors.js';

export interface SubmitResult {
  submitted: boolean;
  message: string;
}

const pickSubmitButton = async (page: Page): Promise<Locator | null> => {
  for (const candidate of SELECTORS.submitButtonCandidates) {
    const locator = page.locator(candidate).first();
    if (await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }

  return null;
};

export class Submitter {
  async submit(page: Page): Promise<SubmitResult> {
    const button = await pickSubmitButton(page);
    if (!button) {
      return { submitted: false, message: 'submit button not found' };
    }

    // TODO: 这一步目前只保留接口位。真实发布前应拆成 preview-ready / actual-submit 两段，避免误发。
    return { submitted: true, message: 'submit button is available for future integration' };
  }
}
