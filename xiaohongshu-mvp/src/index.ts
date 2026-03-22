import { resolve } from 'node:path';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { LoginChecker } from './auth/login-checker.js';
import { QrLoginWatcher } from './auth/qr-login.js';
import { SessionManager } from './auth/session-manager.js';
import { LIMITS, PATHS } from './config/constants.js';
import { PopupHandler } from './guard/popup-handler.js';
import { Editor } from './publisher/editor.js';
import { ImageUploader } from './publisher/image-uploader.js';
import { PublishPage } from './publisher/publish-page.js';
import { TagHandler } from './publisher/tag-handler.js';
import type { PublishContent } from './types/publish.js';
import { logger } from './utils/logger.js';
import {
  buildRuntimeReport,
  classifyFailure,
  collectRuntimeSnapshot,
  createRuntimeSnapshotFromText,
  shouldRetryRuntimeFailure,
  writeRuntimeReport
} from './utils/runtime-report.js';
import { captureScreenshot } from './utils/screenshot.js';
import { PublishWorkflow } from './workflow/publish-workflow.js';

const demoContent: PublishContent = {
  title: 'MVP 骨架演示',
  body: '这是一个用于本地开发的占位发布内容，不会触发真实平台发布。',
  tags: ['Playwright', 'TypeScript', 'MVP'],
  imagePaths: ['mock-image-1.png']
};

const runWorkflowDemo = async (): Promise<void> => {
  const workflow = new PublishWorkflow();
  const result = await workflow.run({
    content: demoContent,
    options: { dryRun: true, requireConfirmation: true }
  });
  logger.info('workflow finished', result as unknown as Record<string, unknown>);
};

const createContext = async (accountId: string): Promise<{ browser: Browser; context: BrowserContext; sessionManager: SessionManager }> => {
  const sessionManager = new SessionManager(resolve(PATHS.sessionDir));
  const browser = await chromium.launch({ headless: process.env.HEADLESS === 'true' });
  const storageStatePath = await sessionManager.loadStorageState(accountId);
  const context = await browser.newContext(storageStatePath ? { storageState: storageStatePath } : {});
  return { browser, context, sessionManager };
};

const fileExists = async (targetPath: string): Promise<boolean> => {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const buildDebugScreenshotPath = (accountId: string, label: string): string => {
  const safeLabel = label.replace(/[^a-zA-Z0-9-_]/g, '-');
  return resolve(PATHS.screenshotDir, `${accountId}-${safeLabel}.png`);
};

const logPageDiagnostics = async (page: Page, accountId: string, label: string): Promise<string> => {
  const screenshotPath = buildDebugScreenshotPath(accountId, label);
  await captureScreenshot(page, screenshotPath);
  const pageTitle = await page.title().catch(() => 'unknown');
  logger.error('page diagnostics', { label, currentUrl: page.url(), pageTitle, screenshotPath });
  return screenshotPath;
};

const waitForever = async (): Promise<never> => new Promise<never>(() => undefined);

const getPublishContentFromEnv = async (): Promise<PublishContent> => {
  const imagePath = process.env.XHS_IMAGE_PATH;
  return {
    title: process.env.XHS_TITLE ?? demoContent.title,
    body: process.env.XHS_BODY ?? demoContent.body,
    tags: (process.env.XHS_TAGS ?? demoContent.tags.join(',')).split(',').map((item) => item.trim()).filter(Boolean),
    imagePaths: imagePath && (await fileExists(imagePath)) ? [imagePath] : []
  };
};

const fillCurrentPageOnly = async (page: Page, content: PublishContent, accountId: string): Promise<void> => {
  const editor = new Editor();
  const imageUploader = new ImageUploader();
  const tagHandler = new TagHandler();
  const popupHandler = new PopupHandler();
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  await page.waitForTimeout(LIMITS.publishPageWaitMs);
  await popupHandler.dismissCommonPopups(page).catch(() => 0);
  logger.info('fill current page', { currentUrl: page.url(), mode: await editor.detectMode(page) });

  const mode = await editor.detectMode(page);
  if (mode === 'image' && content.imagePaths.length > 0) {
    await imageUploader.upload(page, content.imagePaths).catch(async (error: unknown) => {
      logger.warn('image upload skipped', { error: error instanceof Error ? error.message : String(error) });
      await logPageDiagnostics(page, accountId, 'publish-fill-image-warning');
      return 0;
    });
    await page.waitForTimeout(3_000).catch(() => undefined);
  }

  try {
    await editor.fill(page, { title: content.title, body: content.body });
  } catch (error) {
    await logPageDiagnostics(page, accountId, 'publish-fill-error');
    throw error;
  }

  await tagHandler.apply(page, content.tags);
  const screenshotPath = await logPageDiagnostics(page, accountId, 'publish-fill-finished');
  const snapshot = await collectRuntimeSnapshot(page, content);
  const report = buildRuntimeReport({
    command: 'publish-fill',
    accountId,
    screenshotPath,
    content,
    mode,
    switched: true,
    ok: true,
    message: 'publish-fill completed',
    snapshot
  });
  const persistedReport = await writeRuntimeReport(report);
  logger.info('publish fill report', persistedReport as unknown as Record<string, unknown>);
  logger.warn('publish-fill completed; browser kept open for manual continuation');
};

const ensureLoginForPublish = async (page: Page, accountId: string, sessionManager: SessionManager, context: BrowserContext): Promise<void> => {
  const loginChecker = new LoginChecker();
  const qrLoginWatcher = new QrLoginWatcher();
  const login = await loginChecker.check(page);
  logger.info('initial login status', login as unknown as Record<string, unknown>);
  if (!login.loggedIn) {
    const qrResult = await qrLoginWatcher.waitForScan(page, undefined, accountId);
    logger.info('qr login result', qrResult as unknown as Record<string, unknown>);
    if (!qrResult.scanned) throw new Error(qrResult.message);
  }

  const publishAccess = await loginChecker.verifyPublishAccess(page);
  logger.info('publish access verification', publishAccess as unknown as Record<string, unknown>);
  if (!publishAccess.loggedIn) {
    await logPageDiagnostics(page, accountId, 'auth-publish-access-failed');
    throw new Error(`login not usable for publish page: ${publishAccess.reason}`);
  }

  const savedStorageStatePath = await sessionManager.saveContextState(accountId, context);
  const metadataPath = await sessionManager.save({
    accountId,
    sessionFile: savedStorageStatePath,
    storageStatePath: savedStorageStatePath,
    updatedAt: new Date().toISOString(),
    isLoggedIn: true,
    lastLoginUrl: page.url()
  });
  logger.info('session saved', { metadataPath, storageStatePath: savedStorageStatePath, accountId });
};

const exportVisibleDom = async (page: Page, accountId: string): Promise<string> => {
  const outDir = resolve(PATHS.screenshotDir, '..', 'inspect');
  await mkdir(outDir, { recursive: true });
  const data = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"], [contenteditable=""], .ql-editor, button, [role="tab"], [class*="tab"], div, span, p'))
      .map((element) => {
        const html = element as HTMLElement;
        const style = window.getComputedStyle(html);
        const rect = html.getBoundingClientRect();
        const visible = style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;

        return {
          visible,
          tag: element.tagName.toLowerCase(),
          text: (element.textContent || '').trim().slice(0, 120),
          placeholder: (element as HTMLInputElement).placeholder || '',
          className: html.className || '',
          role: element.getAttribute('role') || '',
          contenteditable: element.getAttribute('contenteditable') || '',
          type: (element as HTMLInputElement).type || ''
        };
      })
      .filter((item) => item.visible)
      .reduce(
        (acc, item) => {
          if (item.tag === 'input' || item.tag === 'textarea') acc.inputs.push(item);
          if (item.contenteditable || item.className.includes('ql-editor')) acc.editables.push(item);
          if (item.tag === 'button' || item.role === 'tab' || item.className.includes('tab')) acc.buttons.push(item);
          if (item.text) acc.texts.push(item);
          return acc;
        },
        {
          url: location.href,
          title: document.title,
          inputs: [] as Array<Record<string, string | boolean>>,
          editables: [] as Array<Record<string, string | boolean>>,
          buttons: [] as Array<Record<string, string | boolean>>,
          texts: [] as Array<Record<string, string | boolean>>
        }
      );
  });
  const outPath = resolve(outDir, `${accountId}-publish-inspect.json`);
  await writeFile(outPath, JSON.stringify(data, null, 2), 'utf8');
  return outPath;
};

const runPublishInspect = async (): Promise<void> => {
  const accountId = process.env.XHS_ACCOUNT_ID ?? 'default';
  const { browser, context, sessionManager } = await createContext(accountId);
  try {
    const page = await context.newPage();
    await ensureLoginForPublish(page, accountId, sessionManager, context);
    const publishPage = new PublishPage();
    await publishPage.open(page);
    logger.warn('if needed, manually switch page/tab now; inspector will capture current visible DOM in 15 seconds');
    await page.waitForTimeout(15_000);
    const inspectPath = await exportVisibleDom(page, accountId);
    const screenshotPath = await logPageDiagnostics(page, accountId, 'publish-inspect');
    logger.info('publish inspect exported', { inspectPath, screenshotPath, currentUrl: page.url() });
    await waitForever();
  } finally {
    await browser.close();
  }
};

const runAuthCheck = async (): Promise<void> => {
  const accountId = process.env.XHS_ACCOUNT_ID ?? 'default';
  const keepOpen = process.env.XHS_KEEP_OPEN_AFTER_AUTH === 'true';
  const { browser, context, sessionManager } = await createContext(accountId);
  try {
    const page = await context.newPage();
    await ensureLoginForPublish(page, accountId, sessionManager, context);
    const screenshotPath = await logPageDiagnostics(page, accountId, 'auth-check');
    const snapshot = await collectRuntimeSnapshot(page);
    const report = buildRuntimeReport({
      command: 'auth-check',
      accountId,
      screenshotPath,
      mode: 'unknown',
      ok: true,
      message: 'auth-check completed',
      snapshot
    });
    const persistedReport = await writeRuntimeReport(report);
    logger.info('auth-check report', persistedReport as unknown as Record<string, unknown>);
    if (keepOpen) await waitForever();
  } finally {
    if (!keepOpen) await browser.close();
  }
};

const runPublishCheck = async (): Promise<void> => {
  const accountId = process.env.XHS_ACCOUNT_ID ?? 'default';
  const keepOpen = process.env.XHS_KEEP_OPEN_AFTER_CHECK !== 'false';
  const { browser, context, sessionManager } = await createContext(accountId);

  try {
    const page = await context.newPage();
    await ensureLoginForPublish(page, accountId, sessionManager, context);
    const publishPage = new PublishPage();
    const editor = new Editor();
    await publishPage.open(page);
    const switched = await editor.switchToImagePostMode(page).catch(() => false);
    const probe = await editor.waitForEditableFields(page);
    const screenshotPath = await logPageDiagnostics(page, accountId, 'publish-check');
    const snapshot = await collectRuntimeSnapshot(page);
    const report = buildRuntimeReport({
      command: 'publish-check',
      accountId,
      screenshotPath,
      mode: probe.mode,
      switched,
      ok: true,
      message: 'publish-check completed',
      snapshot
    });

    logger.info('publish-check diagnostics', {
      switched,
      mode: probe.mode,
      titleInputFound: Boolean(probe.titleInput),
      bodyEditorFound: Boolean(probe.bodyEditor),
      currentUrl: page.url(),
      screenshotPath
    });
    const persistedReport = await writeRuntimeReport(report);
    logger.info('publish-check report', persistedReport as unknown as Record<string, unknown>);

    if (!keepOpen) return;

    logger.warn('publish-check completed; browser kept open for manual inspection and no real submit was executed');
    await waitForever();
  } finally {
    if (!keepOpen) await browser.close();
  }
};

const runPublishOpen = async (): Promise<void> => {
  const accountId = process.env.XHS_ACCOUNT_ID ?? 'default';
  const { browser, context, sessionManager } = await createContext(accountId);

  try {
    const page = await context.newPage();
    await ensureLoginForPublish(page, accountId, sessionManager, context);
    const publishPage = new PublishPage();
    await publishPage.open(page);
    const screenshotPath = await logPageDiagnostics(page, accountId, 'publish-open');
    const snapshot = await collectRuntimeSnapshot(page);
    const report = buildRuntimeReport({
      command: 'publish-open',
      accountId,
      screenshotPath,
      mode: 'unknown',
      ok: true,
      message: 'publish-open completed',
      snapshot
    });
    const persistedReport = await writeRuntimeReport(report);
    logger.info('publish-open report', persistedReport as unknown as Record<string, unknown>);
    logger.warn('publish-open completed; browser will stay open for manual continuation and no real submit was executed');
    await waitForever();
  } finally {
    await browser.close();
  }
};

const runPublishFill = async (): Promise<void> => {
  const accountId = process.env.XHS_ACCOUNT_ID ?? 'default';
  const content = await getPublishContentFromEnv();
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { browser, context, sessionManager } = await createContext(accountId);
    try {
      const page = await context.newPage();
      await ensureLoginForPublish(page, accountId, sessionManager, context);
      const publishPage = new PublishPage();
      await publishPage.openImageMode(page);
      logger.warn('image publish route opened; script will upload images first, then wait for editable fields to appear', { attempt, maxAttempts });
      await fillCurrentPageOnly(page, content, accountId);
      await waitForever();
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const failureCode = classifyFailure(message);
      logger.error('publish-fill failed', { error: message, failureCode, attempt, maxAttempts });

      if (!shouldRetryRuntimeFailure(failureCode) || attempt >= maxAttempts) {
        throw error;
      }

      logger.warn('publish-fill retry scheduled', { attempt, nextAttempt: attempt + 1, failureCode });
    } finally {
      await browser.close();
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'publish-fill failed'));
};

const runSmoke = async (): Promise<void> => {
  const accountId = process.env.XHS_ACCOUNT_ID ?? 'smoke';
  const envContent = await getPublishContentFromEnv();
  const content: PublishContent = {
    ...envContent,
    imagePaths: envContent.imagePaths.length > 0 ? envContent.imagePaths : ['smoke-placeholder.png']
  };
  const workflow = new PublishWorkflow();
  const workflowResult = await workflow.run({
    content,
    options: { dryRun: true, requireConfirmation: false }
  });

  const syntheticText = [
    '图片编辑',
    '1/18',
    '填写标题会有更多赞哦',
    content.title,
    '输入正文描述，真诚有价值的分享予人温暖',
    content.body,
    '发布',
    '暂存离开',
    '笔记预览'
  ].join('\n');

  const report = buildRuntimeReport({
    command: 'smoke',
    accountId,
    mode: 'image',
    switched: true,
    ok: workflowResult.success,
    message: workflowResult.message,
    snapshot: {
      currentUrl: 'https://creator.xiaohongshu.com/publish/publish?from=tab_switch&target=image',
      ...createRuntimeSnapshotFromText(syntheticText, content)
    }
  });
  const persistedReport = await writeRuntimeReport(report);

  logger.info('smoke completed', {
    workflowSuccess: workflowResult.success,
    stage: workflowResult.stage,
    reportPath: persistedReport.reportPath,
    failureCode: persistedReport.failureCode
  });
};

const main = async (): Promise<void> => {
  const command = process.argv[2] ?? 'demo';
  if (command === 'auth-check') return runAuthCheck();
  if (command === 'publish-check') return runPublishCheck();
  if (command === 'publish-open') return runPublishOpen();
  if (command === 'publish-fill') return runPublishFill();
  if (command === 'publish-inspect') return runPublishInspect();
  if (command === 'smoke') return runSmoke();
  return runWorkflowDemo();
};

main().catch((error) => {
  logger.error('workflow crashed', { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
