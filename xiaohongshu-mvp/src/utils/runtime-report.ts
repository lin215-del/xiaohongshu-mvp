import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Page } from 'playwright';
import type { PublishContent, PublishRuntimeReport, RuntimeFailureCode } from '../types/publish.js';

export interface RuntimeSnapshot {
  currentUrl?: string;
  titlePresent?: boolean;
  bodyPresent?: boolean;
  imageCountHint?: number | null;
  imageEditorReady?: boolean;
  previewReady?: boolean;
  hasPublishButton?: boolean;
  hasDraftButton?: boolean;
}

export const classifyFailure = (message: string): RuntimeFailureCode => {
  if (/login|扫码|401/.test(message)) return 'login_required';
  if (/publish route|publish page navigation|image page/.test(message)) return 'publish_route_unavailable';
  if (/image upload input not found|filechooser|upload input/.test(message)) return 'image_upload_failed';
  if (/stable post-upload editor state/.test(message)) return 'image_upload_not_ready';
  if (/title input not found|body editor not found|editor/.test(message)) return 'editor_not_ready';
  return 'unknown';
};

export const shouldRetryRuntimeFailure = (failureCode: RuntimeFailureCode): boolean => {
  return failureCode === 'login_required'
    || failureCode === 'image_upload_failed'
    || failureCode === 'image_upload_not_ready'
    || failureCode === 'editor_not_ready';
};

export const createRuntimeSnapshotFromText = (text: string, expected?: Pick<PublishContent, 'title' | 'body'>): RuntimeSnapshot => {
  const imageCountMatch = text.match(/(\d+)\/18/);
  const imageCountHint = imageCountMatch ? Number(imageCountMatch[1]) : null;

  return {
    titlePresent: expected?.title ? text.includes(expected.title) : undefined,
    bodyPresent: expected?.body ? text.includes(expected.body) : undefined,
    imageCountHint,
    imageEditorReady: /图片编辑/.test(text) && (imageCountHint ?? 0) >= 1,
    previewReady: /笔记预览|封面预览/.test(text),
    hasPublishButton: /发布/.test(text),
    hasDraftButton: /暂存离开/.test(text)
  };
};

export const collectRuntimeSnapshot = async (page: Page, expected?: Pick<PublishContent, 'title' | 'body'>): Promise<RuntimeSnapshot> => {
  const fallbackText = await page.locator('body').innerText().catch(() => '');
  const fallbackSnapshot = createRuntimeSnapshotFromText(fallbackText, expected);

  return page.evaluate(({ expectedTitle, expectedBody }) => {
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
    const text = document.body?.innerText || '';
    const imageCountMatch = text.match(/(\d+)\/18/);
    const imageCountHint = imageCountMatch ? Number(imageCountMatch[1]) : null;

    const readNodes = (selectors: string[]): string[] => {
      const values: string[] = [];
      for (const selector of selectors) {
        for (const node of Array.from(document.querySelectorAll(selector))) {
          if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
            values.push(node.value || node.placeholder || '');
            continue;
          }
          values.push((node.textContent || '').trim());
        }
      }
      return values.map(normalize).filter(Boolean);
    };

    const titleValues = readNodes([
      'input[placeholder*="标题"]',
      'textarea[placeholder*="标题"]',
      '[contenteditable="true"][data-placeholder*="标题"]',
      '[class*="title"] input',
      '[class*="header"] input',
      'input[maxlength]',
      'input[type="text"]'
    ]);

    const bodyValues = readNodes([
      'textarea[placeholder*="正文"]',
      '[contenteditable="true"]',
      '.ql-editor',
      '[class*="editor"] [contenteditable="true"]'
    ]);

    const normalizedText = normalize(text);
    const normalizedExpectedTitle = expectedTitle ? normalize(expectedTitle) : '';
    const normalizedExpectedBody = expectedBody ? normalize(expectedBody) : '';

    return {
      currentUrl: location.href,
      titlePresent: expectedTitle
        ? normalizedText.includes(normalizedExpectedTitle) || titleValues.some((value) => value.includes(normalizedExpectedTitle))
        : undefined,
      bodyPresent: expectedBody
        ? normalizedText.includes(normalizedExpectedBody) || bodyValues.some((value) => value.includes(normalizedExpectedBody))
        : undefined,
      imageCountHint,
      imageEditorReady: /图片编辑/.test(text) && (imageCountHint ?? 0) >= 1,
      previewReady: /笔记预览|封面预览/.test(text),
      hasPublishButton: /发布/.test(text),
      hasDraftButton: /暂存离开/.test(text)
    } satisfies RuntimeSnapshot;
  }, { expectedTitle: expected?.title, expectedBody: expected?.body }).catch(() => ({
    currentUrl: page.url(),
    ...fallbackSnapshot
  } satisfies RuntimeSnapshot));
};

export const buildRuntimeReport = (input: {
  command: PublishRuntimeReport['command'];
  accountId: string;
  screenshotPath?: string;
  content?: PublishContent;
  mode?: 'video' | 'image' | 'unknown';
  switched?: boolean;
  ok?: boolean;
  message?: string;
  attempt?: number;
  maxAttempts?: number;
  snapshot?: RuntimeSnapshot;
}): PublishRuntimeReport => {
  const ok = input.ok ?? true;
  return {
    command: input.command,
    accountId: input.accountId,
    ok,
    failureCode: ok ? undefined : classifyFailure(input.message ?? ''),
    message: input.message,
    attempt: input.attempt,
    maxAttempts: input.maxAttempts,
    mode: input.mode,
    switched: input.switched,
    screenshotPath: input.screenshotPath,
    ...input.snapshot
  };
};

export const writeRuntimeReport = async (report: PublishRuntimeReport): Promise<PublishRuntimeReport> => {
  const outDir = resolve('.runtime', 'reports');
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = resolve(outDir, `${report.command}-${report.accountId}-${stamp}.json`);
  const nextReport = { ...report, reportPath: outPath };
  await writeFile(outPath, JSON.stringify(nextReport, null, 2), 'utf8');
  return nextReport;
};
