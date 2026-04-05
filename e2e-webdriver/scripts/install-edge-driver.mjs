import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { download } from 'edgedriver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.platform !== 'win32') {
  process.exit(0);
}

const driversDirectory = path.join(__dirname, '..', '.drivers');
const driverPath = await download(undefined, driversDirectory);
process.stdout.write(`${driverPath}\n`);
