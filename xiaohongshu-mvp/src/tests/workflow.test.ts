import test from 'node:test';
import assert from 'node:assert/strict';
import { PublishWorkflow } from '../workflow/publish-workflow.js';
import type { PublishContent } from '../types/publish.js';

const content: PublishContent = {
  title: '可发布标题',
  body: '正常正文内容',
  tags: ['mvp'],
  imagePaths: ['1.png']
};

test('workflow dry-run stops at waiting_confirmation when confirmation is required', async () => {
  const workflow = new PublishWorkflow({ now: () => new Date('2026-03-21T09:00:00.000Z') });
  const result = await workflow.run({
    content,
    options: { dryRun: true, requireConfirmation: true }
  });

  assert.equal(result.success, true);
  assert.equal(result.stage, 'published');
  assert.deepEqual(
    result.transitions.map((item) => item.to),
    ['checking_login', 'ready_for_preview', 'waiting_confirmation', 'published']
  );
});


test('workflow pauses for manual confirmation before non-dry-run publish', async () => {
  const workflow = new PublishWorkflow({ now: () => new Date('2026-03-21T09:00:00.000Z') }) as unknown as {
    run: PublishWorkflow['run'];
    loginChecker: { check: () => Promise<{ loggedIn: boolean; reason: string }> };
  };

  workflow.loginChecker = {
    check: async () => ({ loggedIn: true, reason: 'stubbed login' })
  };

  const result = await workflow.run({
    page: {} as never,
    content,
    options: { requireConfirmation: true }
  });

  assert.equal(result.success, false);
  assert.equal(result.stage, 'waiting_confirmation');
  assert.equal(result.message, 'manual confirmation required before publish');
  assert.deepEqual(
    result.transitions.map((item) => item.to),
    ['checking_login', 'ready_for_preview', 'waiting_confirmation']
  );
});

test('workflow fails on validation before publish stage', async () => {
  const workflow = new PublishWorkflow();
  const result = await workflow.run({
    content: {
      ...content,
      body: ' ',
      imagePaths: []
    },
    options: { dryRun: true }
  });

  assert.equal(result.success, false);
  assert.equal(result.stage, 'failed');
  assert.equal(result.message, 'validation failed');
});

test('workflow fails on risk check in dry-run', async () => {
  const workflow = new PublishWorkflow();
  const result = await workflow.run({
    content: {
      ...content,
      body: '欢迎私聊，加微信领取返现'
    },
    options: { dryRun: true }
  });

  assert.equal(result.success, false);
  assert.equal(result.stage, 'failed');
  assert.equal(result.message, 'risk check failed');
  assert.ok(result.risk?.reasons.length);
});
