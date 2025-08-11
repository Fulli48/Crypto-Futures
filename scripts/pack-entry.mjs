import path from 'path';
import { fileURLToPath } from 'url';

// Ensure a dirname-like value is available for bundled code
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Expose a stable importMetaDir used by server files
globalThis.importMetaDir = __dirname;

// Start the server. The server/index.ts file will compute dist path relative to importMetaDir.
import('../server/index.ts');

