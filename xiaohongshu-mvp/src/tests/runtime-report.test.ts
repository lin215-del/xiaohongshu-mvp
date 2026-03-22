import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildRuntimeReport, classifyFailure, createRuntimeSnapshotFromText, shouldRetryRuntimeFailure, writeRuntimeReport } from '../utils/runtime-report.js';

test('classifyFailure maps known messages to failure codes', () => {
  assert.equal(classifyFailure('login not usable for publish page: 401'), 'login_required');
  assert.equal(classifyFailure('publish image page navigation failed'), 'publish_route_unavailable');
  assert.equal(classifyFailure('image upload input not found on publish page'), 'image_upload_failed');
  assert.equal(classifyFailure('image upload did not reach a stable post-upload editor state within timeout'), 'image_upload_not_ready');
  assert.equal(classifyFailure('title input not found on publish page'), 'editor_not_ready');
  assert.equal(classifyFailure('totally different error'), 'unknown');
});

test('shouldRetryRuntimeFailure only retries recoverable failures', () => {
  assert.equal(shouldRetryRuntimeFailure('image_upload_failed'), true);
  assert.equal(shouldRetryRuntimeFailure('image_upload_not_ready'), true);
  assert.equal(shouldRetryRuntimeFailure('editor_not_ready'), true);
  assert.equal(shouldRetryRuntimeFailure('login_required'), false);
});

test('createRuntimeSnapshotFromText extracts publish markers', () => {
  const snapshot = createRuntimeSnapshotFromText(
    '图片编辑\n1/18\n填写标题会有更多赞哦\n输入正文描述，真诚有价值的分享予人温暖\n发布\n暂存离开\n笔记预览',
    { title: '不存在的标题', body: '不存在的正文' }
  );

  assert.equal(snapshot.imageCountHint, 1);
  assert.equal(snapshot.imageEditorReady, true);
  assert.equal(snapshot.previewReady, true);
  assert.equal(snapshot.hasPublishButton, true);
  assert.equal(snapshot.hasDraftButton, true);
  assert.equal(snapshot.titlePresent, false);
  assert.equal(snapshot.bodyPresent, false);
});

test('writeRuntimeReport persists standardized report json', async () => {
  const report = buildRuntimeReport({
    command: 'publish-fill',
    accountId: 'smoke',
    ok: false,
    message: 'image upload input not found on publish page',
    mode: 'image',
    switched: true,
    attempt: 1,
    maxAttempts: 3,
    snapshot: { currentUrl: 'https://creator.xiaohongshu.com/publish/publish?target=image', hasPublishButton: true }
  });

  const persisted = await writeRuntimeReport(report);
  assert.ok(persisted.reportPath);
  assert.equal(persisted.failureCode, 'image_upload_failed');

  const raw = await readFile(persisted.reportPath!, 'utf8');
  const parsed = JSON.parse(raw) as { command: string; accountId: string; failureCode: string };
  assert.equal(parsed.command, 'publish-fill');
  assert.equal(parsed.accountId, 'smoke');
  assert.equal(parsed.failureCode, 'image_upload_failed');
});
