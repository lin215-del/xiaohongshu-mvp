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

    // 当前版本明确不执行真实发布。即便检测到按钮，也只返回“可提交但未提交”的诊断结果。
    return {
      submitted: false,
      message: 'submit button detected but no real submit was executed'
    };
  }
}
