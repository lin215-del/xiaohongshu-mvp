import type { Page } from 'playwright';
import { LoginChecker } from '../auth/login-checker.js';
import { QrLoginWatcher } from '../auth/qr-login.js';
import { PopupHandler } from '../guard/popup-handler.js';
import { checkRisk } from '../guard/risk-control.js';
import { validatePublishContent } from '../guard/validator.js';
import { Editor } from '../publisher/editor.js';
import { ImageUploader } from '../publisher/image-uploader.js';
import { PublishPage } from '../publisher/publish-page.js';
import { Submitter } from '../publisher/submitter.js';
import { TagHandler } from '../publisher/tag-handler.js';
import type {
  PublishContent,
  PublishOptions,
  PublishWorkflowResult,
  WorkflowDependencies,
  WorkflowStage,
  WorkflowTransition
} from '../types/publish.js';
import { buildPreview } from './preview.js';

export interface WorkflowRunInput {
  page?: Page;
  content: PublishContent;
  options?: PublishOptions;
}

export class PublishWorkflow {
  private readonly loginChecker = new LoginChecker();
  private readonly qrLoginWatcher = new QrLoginWatcher();
  private readonly popupHandler = new PopupHandler();
  private readonly publishPage = new PublishPage();
  private readonly imageUploader = new ImageUploader();
  private readonly editor = new Editor();
  private readonly tagHandler = new TagHandler();
  private readonly submitter = new Submitter();
  private readonly now: () => Date;

  constructor(deps: WorkflowDependencies = {}) {
    this.now = deps.now ?? (() => new Date());
  }

  async run(input: WorkflowRunInput): Promise<PublishWorkflowResult> {
    const options = input.options ?? {};
    const transitions: WorkflowTransition[] = [];
    let stage: WorkflowStage = 'checking_login';

    const transition = (to: WorkflowStage, reason: string): void => {
      transitions.push({
        from: transitions.at(-1)?.to ?? 'init',
        to,
        reason,
        at: this.now().toISOString()
      });
      stage = to;
    };

    transition('checking_login', 'workflow started');

    const validation = validatePublishContent(input.content);
    if (!validation.valid) {
      transition('failed', 'validation failed');
      return {
        success: false,
        stage,
        validation,
        transitions,
        message: 'validation failed'
      };
    }

    const risk = checkRisk(input.content);
    const preview = buildPreview(input.content, risk);

    if (!input.page || options.dryRun) {
      transition('ready_for_preview', 'dry run preview ready');
      if (options.requireConfirmation !== false) {
        transition('waiting_confirmation', 'awaiting manual confirmation in dry run');
      }
      transition(risk.passed ? 'published' : 'failed', risk.passed ? 'dry run completed' : 'risk check failed');
      return {
        success: risk.passed,
        stage,
        preview,
        validation,
        risk,
        transitions,
        message: risk.passed ? 'dry run completed' : 'risk check failed'
      };
    }

    const login = await this.loginChecker.check(input.page);
    if (!login.loggedIn) {
      transition('waiting_scan', login.reason);
      const qr = await this.qrLoginWatcher.waitForScan(input.page);
      if (!qr.scanned) {
        transition('failed', qr.message);
        return {
          success: false,
          stage,
          preview,
          validation,
          risk,
          transitions,
          message: qr.message
        };
      }
    }

    transition('ready_for_preview', 'content validated and login ready');
    if (options.requireConfirmation !== false) {
      transition('waiting_confirmation', 'manual confirmation required before publish');
    }

    if (!risk.passed) {
      transition('failed', 'risk check failed');
      return {
        success: false,
        stage,
        preview,
        validation,
        risk,
        transitions,
        message: 'risk check failed'
      };
    }

    transition('publishing', 'running publish actions');
    await this.popupHandler.dismissCommonPopups(input.page);
    await this.publishPage.open(input.page);
    await this.imageUploader.upload(input.page, input.content.imagePaths);
    await this.editor.fill(input.page, input.content);
    await this.tagHandler.apply(input.page, input.content.tags);
    const submitResult = await this.submitter.submit(input.page);

    transition(submitResult.submitted ? 'published' : 'failed', submitResult.message);

    return {
      success: submitResult.submitted,
      stage,
      preview,
      validation,
      risk,
      transitions,
      message: submitResult.message
    };
  }
}
