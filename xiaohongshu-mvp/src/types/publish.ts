export type WorkflowStage =
  | 'checking_login'
  | 'waiting_scan'
  | 'ready_for_preview'
  | 'waiting_confirmation'
  | 'publishing'
  | 'published'
  | 'failed';

export interface PublishContent {
  title: string;
  body: string;
  tags: string[];
  imagePaths: string[];
}

export interface SessionMetadata {
  accountId: string;
  sessionFile: string;
  updatedAt: string;
  isLoggedIn: boolean;
  storageStatePath?: string;
  lastLoginUrl?: string;
  qrScreenshotPath?: string;
  notes?: string;
}

export interface ValidationIssue {
  field: 'title' | 'body' | 'tags' | 'images' | 'general';
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface RiskCheckResult {
  passed: boolean;
  reasons: string[];
}

export interface PublishPreview {
  title: string;
  bodyExcerpt: string;
  tags: string[];
  imageCount: number;
  warnings: string[];
  screenshotPath?: string;
  currentUrl?: string;
}

export type RuntimeFailureCode =
  | 'login_required'
  | 'publish_route_unavailable'
  | 'image_upload_not_ready'
  | 'image_upload_failed'
  | 'editor_not_ready'
  | 'unknown';

export interface PublishRuntimeReport {
  command: 'publish-check' | 'publish-fill' | 'publish-open' | 'auth-check';
  accountId: string;
  ok?: boolean;
  failureCode?: RuntimeFailureCode;
  message?: string;
  attempt?: number;
  maxAttempts?: number;
  currentUrl?: string;
  mode?: 'video' | 'image' | 'unknown';
  switched?: boolean;
  imageCountHint?: number | null;
  imageEditorReady?: boolean;
  previewReady?: boolean;
  titlePresent?: boolean;
  bodyPresent?: boolean;
  hasPublishButton?: boolean;
  hasDraftButton?: boolean;
  screenshotPath?: string;
}

export interface PublishOptions {
  headless?: boolean;
  requireConfirmation?: boolean;
  dryRun?: boolean;
  sessionDataDir?: string;
  screenshotsDir?: string;
}

export interface WorkflowTransition {
  from: WorkflowStage | 'init';
  to: WorkflowStage;
  reason: string;
  at: string;
}

export interface PublishWorkflowResult {
  success: boolean;
  stage: WorkflowStage;
  preview?: PublishPreview;
  validation?: ValidationResult;
  risk?: RiskCheckResult;
  transitions: WorkflowTransition[];
  message: string;
}

export interface WorkflowDependencies {
  now?: () => Date;
}
