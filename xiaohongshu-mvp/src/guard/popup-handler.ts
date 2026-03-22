import type { Locator, Page } from 'playwright';
import { SELECTORS } from '../config/selectors.js';

const pickCloseButtons = async (page: Page): Promise<Locator[]> => {
  const matches: Locator[] = [];

  for (const candidate of SELECTORS.modalCloseButtonCandidates) {
    const locator = page.locator(candidate);
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      matches.push(locator.nth(index));
    }
  }

  return matches;
};

export class PopupHandler {
  async dismissCommonPopups(page: Page): Promise<number> {
    const buttons = await pickCloseButtons(page);
    let closed = 0;

    for (const button of buttons) {
      const visible = await button.isVisible().catch(() => false);
      if (!visible) {
        continue;
      }

      await button.click().catch(() => undefined);
      closed += 1;
    }

    return closed;
  }
}
