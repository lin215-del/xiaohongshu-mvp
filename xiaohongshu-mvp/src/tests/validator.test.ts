import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePublishContent } from '../guard/validator.js';
import type { PublishContent } from '../types/publish.js';

const validContent: PublishContent = {
  title: '有效标题',
  body: '这里是有效正文',
  tags: ['a', 'b'],
  imagePaths: ['1.png', '2.png']
};

test('validator accepts valid content', () => {
  const result = validatePublishContent(validContent);
  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
});

test('validator rejects empty body and too many tags', () => {
  const result = validatePublishContent({
    ...validContent,
    body: '   ',
    tags: new Array(11).fill('tag')
  });

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.field === 'body'));
  assert.ok(result.issues.some((issue) => issue.field === 'tags'));
});

test('validator rejects invalid title length and image count', () => {
  const result = validatePublishContent({
    ...validContent,
    title: '这是一条超过二十个字的标题内容用于自动测试场景',
    imagePaths: []
  });

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.field === 'title'));
  assert.ok(result.issues.some((issue) => issue.field === 'images'));
});
