import type { Locator, Page } from 'playwright';
import { SELECTORS } from '../config/selectors.js';

export interface SubmitResult {
  submitted: boolean;
  message: string;
  submitButtonFound?: boolean;
  realPublishEnabled?: boolean;
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
      return { submitted: false, message: 'submit button not found', submitButtonFound: false, realPublishEnabled: false };
    }

    const realPublishEnabled = process.env.XHS_ENABLE_REAL_PUBLISH === 'true';
    if (!realPublishEnabled) {
      return {
        submitted: false,
        message: 'submit button detected but no real submit was executed (set XHS_ENABLE_REAL_PUBLISH=true to enable)',
        submitButtonFound: true,
        realPublishEnabled: false
      };
    }

    await button.click({ force: true }).catch(() => undefined);
    return {
      submitted: true,
      message: 'real publish click executed',
      submitButtonFound: true,
      realPublishEnabled: true
    };
  }
}
