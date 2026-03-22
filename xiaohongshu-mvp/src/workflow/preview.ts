import type { PublishContent, PublishPreview, RiskCheckResult } from '../types/publish.js';

export const buildPreview = (content: PublishContent, risk: RiskCheckResult): PublishPreview => ({
  title: content.title,
  bodyExcerpt: content.body.slice(0, 120),
  tags: content.tags,
  imageCount: content.imagePaths.length,
  warnings: risk.reasons
});
