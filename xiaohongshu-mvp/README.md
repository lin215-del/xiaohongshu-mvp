# Xiaohongshu Auto Publish MVP

> A **Node.js + TypeScript + Playwright** MVP for automating **Xiaohongshu image-post publishing**.

这个项目的目标很直接：

- 自动登录小红书创作者平台
- 自动进入图文发布页
- 自动上传图片
- 自动填写标题 / 正文
- 输出截图与结构化运行报告
- 默认 **不执行真实发布**

---

## What this project does

当前这版已经具备一个可演示、可继续工程化的 MVP 主链：

- ✅ 登录检测
- ✅ 二维码登录
- ✅ session 持久化
- ✅ 打开发布页
- ✅ 切换到图文发布路由
- ✅ 上传图片
- ✅ 自动填写标题 / 正文
- ✅ 标签 fallback（追加到正文末尾）
- ✅ 预发布截图
- ✅ runtime report 落盘
- ✅ failureCode 分类
- ✅ recoverable failure 自动重试
- ✅ 真实发布安全闸门
- ✅ CLI smoke test

---

## Why it matters

如果你是非技术同学，可以把它理解成：

> 这是一个“能自动帮你把图文内容填进小红书发布页面里”的原型系统。

它不是一个“PPT 概念项目”，而是已经可以在真实浏览器里跑起来、看到动作的 MVP。

---

## Safety first

默认情况下，项目 **不会真实点击发布按钮**。

只有显式设置：

```bash
XHS_ENABLE_REAL_PUBLISH=true
```

才会尝试真实点击发布。

这意味着你可以放心做演示、联调、录屏，而不会误发内容。

---

## Quick Start

### 1) Install

```bash
npm install
npx playwright install
```

### 2) Build

```bash
npm run build
```

### 3) Run the minimal smoke test

```bash
npm run smoke
```

这个命令：
- 不依赖真实登录态
- 不打开浏览器
- 不真实发布
- 会生成标准化 runtime report

适合快速证明项目结构和命令入口都正常。

### 4) Login once

```bash
npm run auth:check
```

首次运行时会打开小红书创作者平台登录页，扫码登录后会保存 session。

### 5) Run the real browser demo

```bash
npm run publish:fill
```

这个命令会：
- 打开图文发布页
- 自动上传图片
- 自动填写标题 / 正文
- 生成截图与报告
- 默认不真实发布

---

## Main commands

### `npm run smoke`
最小回归检查。

### `npm run auth:check`
检查登录态，必要时触发二维码登录，并保存 session。

### `npm run publish:open`
打开发布页，但不填写内容。

### `npm run publish:check`
只做发布页状态诊断，不执行真实提交流程。

### `npm run publish:fill`
当前最核心的主链演示命令：
- 自动进入图文页
- 自动传图
- 自动填标题正文
- 输出截图与 runtime report

### `npm test`
运行单元测试。

### `npm run build`
TypeScript 构建。

---

## Environment variables

常用环境变量：

```bash
XHS_ACCOUNT_ID=default
HEADLESS=false
XHS_TITLE=MVP 骨架演示
XHS_BODY=这是一个用于本地开发的占位发布内容，不会触发真实平台发布。
XHS_TAGS=Playwright,TypeScript,MVP
XHS_IMAGE_PATH=assets/demo-upload.png
XHS_ENABLE_REAL_PUBLISH=false
```

说明：
- 如果不传 `XHS_IMAGE_PATH`，项目会默认使用内置演示图：`assets/demo-upload.png`
- `HEADLESS=false` 时更适合演示
- `XHS_ENABLE_REAL_PUBLISH` 默认不要开

---

## Runtime output

运行过程中会输出两类关键产物：

### Screenshots
目录：

```text
.runtime/screenshots/
```

### Runtime reports
目录：

```text
.runtime/reports/
```

报告字段包括：

- `command`
- `accountId`
- `ok`
- `failureCode`
- `message`
- `currentUrl`
- `mode`
- `switched`
- `imageCountHint`
- `imageEditorReady`
- `previewReady`
- `titlePresent`
- `bodyPresent`
- `hasPublishButton`
- `hasDraftButton`
- `screenshotPath`
- `reportPath`

---

## Current status

这不是一个“完全从零开始的骨架”了，而是一个已经具备真实浏览器主链能力的 MVP：

- 能在真实浏览器中看到上传图片、填写标题正文的动作
- 默认安全，不会误发
- 已具备 smoke/test/build 基础回归能力

当前剩余工作主要集中在：
- 进一步提升真实站点联调稳定性
- 继续优化结果检测准确率
- 补强官方 `#话题` 链路

换句话说：

> **主链已经做出来了，现在主要是在做稳定性和工程收口。**

---

## Project structure

```text
xiaohongshu-mvp/
├─ assets/
│  └─ demo-upload.png
├─ package.json
├─ tsconfig.json
├─ README.md
├─ .gitignore
└─ src/
   ├─ index.ts
   ├─ types/
   │  └─ publish.ts
   ├─ config/
   │  ├─ selectors.ts
   │  └─ constants.ts
   ├─ auth/
   │  ├─ session-manager.ts
   │  ├─ login-checker.ts
   │  └─ qr-login.ts
   ├─ publisher/
   │  ├─ publish-page.ts
   │  ├─ image-uploader.ts
   │  ├─ editor.ts
   │  ├─ tag-handler.ts
   │  └─ submitter.ts
   ├─ guard/
   │  ├─ validator.ts
   │  ├─ risk-control.ts
   │  └─ popup-handler.ts
   ├─ workflow/
   │  ├─ preview.ts
   │  └─ publish-workflow.ts
   ├─ utils/
   │  ├─ logger.ts
   │  ├─ navigation.ts
   │  ├─ runtime-report.ts
   │  ├─ retry.ts
   │  ├─ delay.ts
   │  └─ screenshot.ts
   └─ tests/
      ├─ runtime-report.test.ts
      ├─ validator.test.ts
      └─ workflow.test.ts
```

---

## Known limitations

当前版本仍有这些限制：

- 小红书页面 DOM 可能会变动，需要持续校准 selector
- 登录页偶发超时会影响单轮执行稳定性
- 真实发布链路默认关闭，避免误发
- 官方 `#话题` 弹层链路还未完全稳定

这些问题不影响它作为 MVP 演示与交付原型，但如果要长期稳定商用，还需要继续工程化。

---

## Recommended demo flow for teammates / bosses

最推荐的演示顺序：

### Step 1
```bash
npm run smoke
```

### Step 2
```bash
npm run auth:check
```

### Step 3
```bash
npm run publish:fill
```

这样既能展示：
- 项目结构完整
- 基础回归可跑
- 真实浏览器效果可见
- 安全闸门存在

---

## Roadmap

下一步优先方向：

1. 稳定登录与发布页导航
2. 继续增强上传后编辑态识别
3. 补官方 `#话题` 插入链路
4. 提升 runtime report 准确率
5. 增加更适合展示的截图 / GIF

---

## License

当前仓库未附加 license；如需团队或商业使用，建议补充明确的许可证与交付说明。
