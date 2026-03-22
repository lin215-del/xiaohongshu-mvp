export interface SelectorConfig {
  loginIndicatorCandidates: string[];
  qrLoginTabCandidates: string[];
  qrPanelCandidates: string[];
  publishTypeTabCandidates: string[];
  videoModeAnchors: string[];
  imageModeAnchors: string[];
  titleInputCandidates: string[];
  bodyEditorCandidates: string[];
  imageInputCandidates: string[];
  tagInputCandidates: string[];
  submitButtonCandidates: string[];
  confirmDialogCandidates: string[];
  modalCloseButtonCandidates: string[];
}

export const SELECTORS: SelectorConfig = {
  loginIndicatorCandidates: [
    '[class*="user"] img',
    '[class*="avatar"] img',
    'img[class*="avatar"]',
    '[class*="creator"] [class*="avatar"]',
    'text=/创作服务|发布笔记|创作中心/'
  ],
  qrLoginTabCandidates: [
    'text=/扫码登录|二维码登录/',
    'button:has-text("扫码登录")',
    'button:has-text("二维码登录")',
    '[role="tab"]:has-text("扫码")',
    '[class*="tab"]:has-text("扫码")'
  ],
  qrPanelCandidates: [
    'canvas',
    'img[alt*="二维码"]',
    'img[src*="qr"]',
    '[class*="qrcode"]',
    '[class*="qr"]',
    '[class*="login"] canvas',
    '[class*="scan"] canvas',
    '[class*="code"] canvas',
    '[class*="login"] img',
    '[role="img"]'
  ],
  publishTypeTabCandidates: [
    '.creator-tab:has-text("上传图文")',
    '.header-tabs .creator-tab:has-text("上传图文")',
    'div.creator-tab:has-text("上传图文")',
    'text=上传图文',
    'button:has-text("上传图文")',
    '[role="tab"]:has-text("上传图文")',
    '[class*="tab"]:has-text("上传图文")',
    'text=图文'
  ],
  videoModeAnchors: [
    '.creator-tab.active:has-text("上传视频")',
    'div.creator-tab.active:has-text("上传视频")',
    'text=上传视频',
    'button:has-text("上传视频")',
    'text=/拖拽视频到此处|点击上传视频|上传视频/'
  ],
  imageModeAnchors: [
    '.creator-tab.active:has-text("上传图文")',
    'div.creator-tab.active:has-text("上传图文")',
    'text=上传图文',
    'text=/上传图片|添加图片|拖拽图片到此处|上传封面图/'
  ],
  titleInputCandidates: [
    'input[placeholder*="标题"]',
    'textarea[placeholder*="标题"]',
    '[contenteditable="true"][data-placeholder*="标题"]',
    'text=填写标题会有更多赞哦',
    'input[maxlength]',
    'input[type="text"]',
    '[class*="title"] input',
    '[class*="header"] input'
  ],
  bodyEditorCandidates: [
    'textarea[placeholder*="正文"]',
    '[contenteditable="true"]',
    '.ql-editor',
    'text=输入正文描述，真诚有价值的分享予人温暖',
    '[class*="editor"] [contenteditable="true"]'
  ],
  imageInputCandidates: [
    'input.upload-input[type="file"]',
    '.drag-over input.upload-input[type="file"]',
    '.upload-content input.upload-input[type="file"]',
    'input[type="file"][accept*="image"]',
    'input[type="file"][accept*=".jpg"]',
    'input[type="file"]',
    '.image-upload-buttons input[type="file"]',
    '.upload-content input[type="file"]'
  ],
  tagInputCandidates: [
    'input[placeholder*="话题"]',
    'input[placeholder*="标签"]',
    'input[placeholder*="添加标签"]',
    'text=# 话题'
  ],
  submitButtonCandidates: [
    'button:has-text("发布")',
    'button:has-text("立即发布")',
    'button:has-text("发布笔记")'
  ],
  confirmDialogCandidates: ['[role="dialog"]', '.ant-modal', '.semi-modal'],
  modalCloseButtonCandidates: [
    'button[aria-label="Close"]',
    '.ant-modal-close',
    '.semi-modal-close',
    'button:has-text("知道了")',
    'button:has-text("关闭")'
  ]
};
