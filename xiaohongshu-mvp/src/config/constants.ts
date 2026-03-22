export const APP_NAME = 'xiaohongshu-mvp';

export const URLS = {
  home: 'https://creator.xiaohongshu.com/',
  publish: 'https://creator.xiaohongshu.com/publish/publish',
  publishImage: 'https://creator.xiaohongshu.com/publish/publish?from=tab_switch&target=image',
  login: 'https://creator.xiaohongshu.com/login'
} as const;

export const PATHS = {
  sessionDir: '.runtime/sessions',
  screenshotDir: '.runtime/screenshots',
  storageStateDir: '.runtime/storage'
} as const;

export const LIMITS = {
  titleMinLength: 1,
  titleMaxLength: 20,
  maxTags: 10,
  maxImages: 9,
  minImages: 1,
  qrWaitTimeoutMs: 300_000,
  loginCheckTimeoutMs: 10_000,
  defaultDelayMs: 500,
  pollIntervalMs: 1_500,
  qrPanelWaitMs: 5_000,
  publishPageWaitMs: 5_000,
  publishModeSwitchWaitMs: 4_000,
  manualImageModeWaitMs: 30_000,
  editorProbeTimeoutMs: 30_000,
  editorProbeIntervalMs: 1_000,
  navigationTimeoutMs: 90_000,
  fallbackNavigationTimeoutMs: 45_000
} as const;

export const RISKY_KEYWORDS = ['引流', '加微信', '返现', '私聊'];
