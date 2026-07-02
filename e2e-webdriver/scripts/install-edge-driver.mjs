import process from 'node:process';
import { resolveEdgeDriverPath } from './resolve-edge-driver.mjs';

if (process.platform !== 'win32') {
  process.exit(0);
}

const driverPath = await resolveEdgeDriverPath({ forceRefresh: true });
process.stdout.write(`${driverPath}\n`);
