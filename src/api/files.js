const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const ROOT_DIR = process.env.ROOT_DIR || process.cwd();

// Security: Prevent path traversal attacks
function safePath(requestedPath) {
  const resolved = path.resolve(ROOT_DIR, requestedPath || '');
  if (!resolved.startsWith(ROOT_DIR)) {
    throw new Error('Access denied: Path traversal attempt');
  }
  return resolved;
}

// GET /api/files/list?path=some/dir
// Returns contents of a directory
router.get('/list', async (req, res) => {
  try {
    const dirPath = safePath(req.query.path || '');
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    const items = await Promise.all(entries.map(async (entry) => {
      // Skip hidden files
      if (entry.name.startsWith('.')) {
        return null;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(ROOT_DIR, fullPath);
      let stats = null;

      try {
        stats = await fs.stat(fullPath);
      } catch (e) {
        // Skip files we can't stat
        return null;
      }

      return {
        name: entry.name,
        path: relativePath,
        isDirectory: entry.isDirectory(),
        size: stats.size,
        modified: stats.mtime
      };
    }));

    // Filter nulls and sort: directories first, then alphabetically
    const filtered = items.filter(Boolean).sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    res.json({ items: filtered, path: req.query.path || '' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/files/tree?path=some/dir
// Returns directory tree structure (directories only)
router.get('/tree', async (req, res) => {
  try {
    const dirPath = safePath(req.query.path || '');
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    const directories = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => ({
        name: entry.name,
        path: path.relative(ROOT_DIR, path.join(dirPath, entry.name)),
        hasChildren: true  // Assume has children, lazy load
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({ directories, path: req.query.path || '' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/files/trash
// Moves a file to .trash folder at root
router.post('/trash', express.json(), async (req, res) => {
  try {
    const filePath = req.body.path;
    if (!filePath) {
      return res.status(400).json({ error: 'File path required' });
    }

    const sourceFullPath = safePath(filePath);

    // Verify it's a file, not a directory
    const stats = await fs.stat(sourceFullPath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Cannot trash directories' });
    }

    // Create .trash directory if it doesn't exist
    const trashDir = path.join(ROOT_DIR, '.trash');
    try {
      await fs.mkdir(trashDir, { recursive: true });
    } catch (e) {
      // Directory might already exist
    }

    // Get just the filename
    const fileName = path.basename(sourceFullPath);
    const destFullPath = path.join(trashDir, fileName);

    // Move file to trash (overwrite if exists)
    await fs.rename(sourceFullPath, destFullPath);

    res.json({ success: true, message: `Moved ${fileName} to trash` });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
