import { LIMITS } from '../config/constants.js';
import type { PublishContent, ValidationIssue, ValidationResult } from '../types/publish.js';

export const validatePublishContent = (content: PublishContent): ValidationResult => {
  const issues: ValidationIssue[] = [];
  const titleLength = content.title.trim().length;
  const bodyLength = content.body.trim().length;

  if (titleLength < LIMITS.titleMinLength || titleLength > LIMITS.titleMaxLength) {
    issues.push({ field: 'title', message: `title length must be ${LIMITS.titleMinLength}-${LIMITS.titleMaxLength}` });
  }

  if (bodyLength === 0) {
    issues.push({ field: 'body', message: 'body must not be empty' });
  }

  if (content.tags.length > LIMITS.maxTags) {
    issues.push({ field: 'tags', message: `tags must not exceed ${LIMITS.maxTags}` });
  }

  if (content.imagePaths.length < LIMITS.minImages || content.imagePaths.length > LIMITS.maxImages) {
    issues.push({ field: 'images', message: `image count must be ${LIMITS.minImages}-${LIMITS.maxImages}` });
  }

  return {
    valid: issues.length === 0,
    issues
  };
};
