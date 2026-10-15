// -----------------------------------------------------------------------------
// Small persistence under /data (the only writable path of the container):
// - the zones seen in each country feed, with their codes, for the "List the
//   zones" action (a feed only lists the zones that have a warning today);
// - the warnings each device knew, so a restart does not announce again, in
//   a scene, the warnings already announced;
// - whether a country feed outlines its areas (house tracking).
// Losing the file is harmless: the zones come back with the next warnings,
// and the first reading after a loss sets the known warnings silently.
// -----------------------------------------------------------------------------

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';
import { createIssueLog } from './issues.js';

const logger = createLogger({ name: 'store' });
const FILE_NAME = 'meteoalarm.json';

export class Store {
  constructor(directory = process.env.METEOALARM_DATA_DIR || '/data') {
    this.path = join(directory, FILE_NAME);
    this.directory = directory;
    this.writing = null;
    this.dirty = false;
    this.latest = null;
    // A read-only or full /data fails every write: said once.
    this.issues = createIssueLog(logger);
  }

  /** @returns {Promise<object>} the saved data, {} when there is none */
  async load() {
    try {
      const data = JSON.parse(await readFile(this.path, 'utf8'));
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.warn(`Cannot read ${this.path}: ${err.message}`);
      }
      return {};
    }
  }

  /**
   * Writes are coalesced (one writer, the last data wins) and atomic
   * (temporary file + rename): a crash never leaves half a JSON file behind.
   * @param {object} data
   */
  save(data) {
    this.latest = data;
    this.dirty = true;
    if (!this.writing) {
      this.writing = this.writeLoop();
    }
    return this.writing;
  }

  async writeLoop() {
    while (this.dirty) {
      this.dirty = false;
      const snapshot = this.latest;
      try {
        await mkdir(this.directory, { recursive: true });
        const temporary = `${this.path}.tmp`;
        await writeFile(temporary, JSON.stringify(snapshot));
        await rename(temporary, this.path);
        this.issues.ok('write', `${this.path} written again`);
      } catch (err) {
        this.issues.fail('write', `Cannot write ${this.path}: ${err.message}`);
      }
    }
    this.writing = null;
  }

  /** Resolves once the last requested write is on disk (or failed). */
  flush() {
    return this.writing ?? Promise.resolve();
  }
}
