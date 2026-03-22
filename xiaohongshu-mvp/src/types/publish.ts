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
