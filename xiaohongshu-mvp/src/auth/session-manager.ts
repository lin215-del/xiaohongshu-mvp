import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { BrowserContext } from 'playwright';
import type { SessionMetadata } from '../types/publish.js';

export class SessionManager {
  constructor(private readonly baseDir: string) {}

  private resolvePath(accountId: string): string {
    return resolve(this.baseDir, `${accountId}.session.json`);
  }

  private resolveStorageStatePath(accountId: string): string {
    return resolve(this.baseDir, `${accountId}.storage-state.json`);
  }

  async save(metadata: SessionMetadata): Promise<string> {
    const targetPath = this.resolvePath(metadata.accountId);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, JSON.stringify(metadata, null, 2), 'utf8');
    return targetPath;
  }

  async saveContextState(accountId: string, context: BrowserContext): Promise<string> {
    const targetPath = this.resolveStorageStatePath(accountId);
    await mkdir(dirname(targetPath), { recursive: true });
    await context.storageState({ path: targetPath });
    return targetPath;
  }

  async load(accountId: string): Promise<SessionMetadata | null> {
    const targetPath = this.resolvePath(accountId);
    try {
      const raw = await readFile(targetPath, 'utf8');
      return JSON.parse(raw) as SessionMetadata;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async loadStorageState(accountId: string): Promise<string | null> {
    const targetPath = this.resolveStorageStatePath(accountId);
    try {
      await readFile(targetPath, 'utf8');
      return targetPath;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
}
