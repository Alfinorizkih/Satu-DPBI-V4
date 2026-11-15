import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const ROOT_DIR = process.cwd();
const OUTPUT_FILENAME = 'satu-dpbi-paket-final.zip';
const OUTPUT_PATH = path.join(ROOT_DIR, OUTPUT_FILENAME);

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'data',
  'storage',
  '.playwright-cli',
  '.aistudio',
]);

const EXCLUDED_FILES = new Set([
  OUTPUT_FILENAME,
  'server.js',
  '.DS_Store',
]);

function isExcludedFile(relPath, name) {
  if (EXCLUDED_FILES.has(name)) return true;
  if (name.endsWith('.zip') || name.endsWith('.db') || name.endsWith('.db-wal') || name.endsWith('.db-shm') || name.endsWith('.log')) {
    return true;
  }
  if (name.startsWith('.env') && name !== '.env.example') {
    return true;
  }
  if (relPath.startsWith('data/') || relPath.startsWith('storage/')) {
    return true;
  }
  return false;
}

function collectFiles(dir, zip, prefix = '') {
  const added = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
      added.push(...collectFiles(path.join(dir, entry.name), zip, nextPrefix));
    } else if (entry.isFile()) {
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (isExcludedFile(relPath, entry.name)) continue;
      const content = fs.readFileSync(path.join(dir, entry.name));
      zip.file(relPath, content);
      added.push(relPath);
    }
  }
  return added;
}

async function main() {
  const zip = new JSZip();
  const files = collectFiles(ROOT_DIR, zip);

  // Safety verification before writing output archive
  const forbidden = files.filter(
    (f) =>
      f.includes('node_modules/') ||
      f.startsWith('.git/') ||
      f.endsWith('.db') ||
      (path.basename(f).startsWith('.env') && path.basename(f) !== '.env.example') ||
      f.endsWith('.zip')
  );
  if (forbidden.length > 0) {
    throw new Error(`Ditemukan berkas terlarang di arsip rilis: ${forbidden.join(', ')}`);
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  fs.writeFileSync(OUTPUT_PATH, buffer);
  const sizeKb = (buffer.length / 1024).toFixed(1);
  console.log(`[SATU DPBI] Paket rilis bersih dibuat: ${OUTPUT_FILENAME} (${files.length} berkas, ${sizeKb} KB).`);
}

main().catch((err) => {
  console.error('[SATU DPBI] Gagal membuat paket rilis ZIP:', err);
  process.exit(1);
});
