# 小红书自动发布 MVP 骨架

一个 **Node.js + TypeScript + Playwright** 的可继续开发工程骨架。

> 目标：先把“小红书登录联调 + 发布流程骨架”搭起来。当前版本已经接入 **真实小红书创作者站 URL**、基础登录检测、二维码截图和 session 持久化；发布动作仍是骨架实现，不会自动完成真实线上发布。

## 当前已覆盖能力

- 发布数据结构定义
- 内容校验（标题 / 正文 / 标签 / 图片数量）
- 本地 session 元数据保存/读取
- Playwright `storageState` 持久化
- 真实 URL 级别的小红书登录联调骨架
- 登录检测与二维码等待流程
- 发布页导航、图片上传、正文填写、标签处理、提交流程占位实现
- 发布状态机（`checking_login / waiting_scan / ready_for_preview / waiting_confirmation / publishing / published / failed`）
- 预览结果生成
- `node:test` 测试样例

## 当前不包含

- 真实小红书页面所有选择器的最终校准
- 真实发布按钮点击验证
- 外部 API 调用
- 风控绕过
- 多账号调度
- 人工确认消息回传 UI

## 项目结构

```text
xiaohongshu-mvp/
├─ package.json
├─ tsconfig.json
├─ README.md
├─ .gitignore
└─ src/
   ├─ index.ts
   ├─ types/publish.ts
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
   │  ├─ retry.ts
   │  ├─ delay.ts
   │  └─ screenshot.ts
   └─ tests/
      ├─ validator.test.ts
      └─ workflow.test.ts
```

## 安装

```bash
cd xiaohongshu-mvp
npm install
```

如需真实浏览器联调：

```bash
npx playwright install
```

## 运行

### 1) dry-run 工作流演示

```bash
npm run dev
```

### 2) 登录联调 / 二维码截图 / session 保存

```bash
npm run auth:check
```

可选环境变量：

```bash
XHS_ACCOUNT_ID=main
HEADLESS=false
```

说明：
- 首次运行如果未登录，会打开小红书创作者站登录页
- 导航已加入更长超时和 fallback 策略（`domcontentloaded -> load -> commit`），用于降低真实站点打开超时概率
- 如果页面上能识别到二维码区域，会截图保存到：
  - `.runtime/screenshots/<accountId>-login-qr.png`
- 登录成功后会保存：
  - session 元数据到 `.runtime/sessions/<accountId>.session.json`
  - Playwright storageState 到 `.runtime/sessions/<accountId>.storage-state.json`

### 3) 一键打开发布页（推荐）

```bash
npm run publish:open
```

说明：
- 已登录：直接打开真实发布页
- 未登录：先进入登录页，等你扫码/手机号登录，登录成功后自动进入发布页
- 成功后**浏览器保持打开**，方便你继续人工检查
- 该命令**不会自动填充内容**
- **不会点击真实发布按钮**

### 4) 手动切到“上传图文”后自动填充（最稳）

```bash
npm run publish:fill
```

说明：
- 你先手动进入发布页，并点击顶部 **上传图文**
- 然后运行这个命令，脚本只负责填充标题/正文/标签/图片
- 不再自动切 tab，避免继续卡在视频/图文切换上
- **不会点击真实发布按钮**

### 5) 发布页联调检查（不执行真实提交）

```bash
npm run publish:check
```

可选环境变量：

```bash
XHS_ACCOUNT_ID=main
HEADLESS=false
XHS_KEEP_OPEN_AFTER_CHECK=false
```

说明：
- 该命令要求你已经先完成 `npm run auth:check`，并建议使用 `HEADLESS=false`
- 会打开真实发布页，并尝试：
  - 切换到“上传图文”
  - 探测标题输入框 / 正文编辑器是否出现
  - 输出诊断日志和截图路径
- 默认会保留浏览器窗口，方便你人工检查
- 如果设置 `XHS_KEEP_OPEN_AFTER_CHECK=false`，检查完成后会自动退出
- **不会填写内容，不会点击真实发布按钮**

## 构建

```bash
npm run build
```

## 测试

```bash
npm test
```

## 占位实现说明

以下模块仍然是 **联调优先 / 可继续补强** 的实现：

- `src/config/selectors.ts`
  - 已替换成更接近真实页面的候选选择器
  - 但小红书页面可能频繁调整，仍需要你在真实页面上校准
- `src/auth/login-checker.ts`
  - 当前结合“可见登录态元素 + 创作者域 cookies”做基础判断
  - 后续建议补更稳定的账号信息接口或头像区域校验
- `src/auth/qr-login.ts`
  - 当前会打开真实登录页、寻找二维码候选区域、截图并轮询登录状态
  - 后续建议改成更精准的二维码区域裁剪与更稳的登录成功判断
- `src/publisher/*.ts`
  - 仍是结构化占位实现，真实发布前要继续补 URL 跳转保护、编辑器适配、图片上传和提交结果解析
- `src/workflow/publish-workflow.ts`
  - 现在仍以 dry-run / skeleton orchestration 为主
  - 后续接真实人工确认与真实发布前预览

## Session 存储说明

`session-manager` 当前使用本地 JSON + Playwright storageState 文件保存会话信息，适合本地开发验证。

**生产环境必须改成加密存储**，不要把 cookies、token、账户信息以明文形式长期落盘。

## 本地验证建议

1. `npm install`
2. `npm test`
3. `npm run build`
4. `npm run auth:check`
5. 完成扫码后检查：
   - `.runtime/screenshots/`
   - `.runtime/sessions/`
6. 再继续接真实发布页逻辑

## 下一步建议

如果要继续做成真正可用的小红书自动发布模块，推荐按这个顺序推进：

1. 校准真实登录态选择器
2. 校准发布页 URL 与发布入口跳转
3. 接通标题/正文编辑器
4. 接通图片上传
5. 加发布前截图确认
6. 最后再接真实提交发布
