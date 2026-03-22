import { RISKY_KEYWORDS } from '../config/constants.js';
import type { PublishContent, RiskCheckResult } from '../types/publish.js';

export const checkRisk = (content: PublishContent): RiskCheckResult => {
  const reasons: string[] = [];
  const text = `${content.title} ${content.body}`;

  for (const keyword of RISKY_KEYWORDS) {
    if (text.includes(keyword)) {
      reasons.push(`contains risky keyword: ${keyword}`);
    }
  }

  if (content.body.length > 1000) {
    reasons.push('body is unusually long for MVP rule');
  }

  return {
    passed: reasons.length === 0,
    reasons
  };
};
