const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const ROOT_DIR = process.env.ROOT_DIR || process.cwd();

// Security: Prevent path traversal attacks
function safePath(requestedPath) {
  const resolved = path.resolve(ROOT_DIR, requestedPath || '');
  if (!resolved.startsWith(ROOT_DIR)) {
    throw new Error('Access denied: Path traversal attempt');
  }
  return resolved;
}

// Helper: Generate unique filename to avoid conflicts
async function getUniqueFileName(dirPath, fileName) {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  let counter = 1;
  let newName = fileName;

  while (true) {
    const fullPath = path.join(dirPath, newName);
    try {
      await fs.access(fullPath);
      // File exists, try next name
      newName = `${base}(${counter})${ext}`;
      counter++;
    } catch {
      // File doesn't exist, this name is available
      return newName;
    }
  }
}

// Helper: Check if a thumbnail exists for a file
async function getThumbnailPath(filePath) {
  const thumbDir = path.join(ROOT_DIR, '.thumb');
  const relativePath = path.relative(ROOT_DIR, filePath);
  const dirName = path.dirname(relativePath);
  const fileName = path.basename(filePath);
  const fileNameWithoutExt = path.parse(fileName).name;

  // Common thumbnail extensions
  const thumbExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

  for (const ext of thumbExtensions) {
    const thumbPath = path.join(thumbDir, dirName, fileNameWithoutExt + ext);
    try {
      await fs.access(thumbPath);
      // Thumbnail exists, return relative path from ROOT_DIR
      return path.relative(ROOT_DIR, thumbPath);
    } catch (e) {
      // Thumbnail doesn't exist with this extension
    }
  }

  return null;
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
      let isSymlink = false;
      let linkTarget = null;
      let thumbnailPath = null;

      try {
        // Use lstat to detect symlinks
        const lStats = await fs.lstat(fullPath);
        isSymlink = lStats.isSymbolicLink();

        // Get actual stats (follows symlinks)
        stats = await fs.stat(fullPath);

        // If it's a symlink, resolve the target
        if (isSymlink) {
          linkTarget = await fs.readlink(fullPath);
          // If target is relative, resolve it relative to the symlink's directory
          if (!path.isAbsolute(linkTarget)) {
            linkTarget = path.resolve(path.dirname(fullPath), linkTarget);
          }
        }
      } catch (e) {
        // Skip files we can't stat
        return null;
      }

      // Check for thumbnail
      if (!entry.isDirectory()) {
        if (isSymlink && linkTarget) {
          // For symlinks, check thumbnail for the link target
          thumbnailPath = await getThumbnailPath(linkTarget);
        } else {
          // For regular files, check thumbnail for the file itself
          thumbnailPath = await getThumbnailPath(fullPath);
        }
      }

      return {
        name: entry.name,
        path: relativePath,
        isDirectory: entry.isDirectory(),
        size: stats.size,
        modified: stats.mtime,
        isSymlink,
        thumbnailPath
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

// Helper: Get all tags for a file
async function getTagsForFile(filePath) {
  const tagsDir = path.join(ROOT_DIR, 'tags');
  const fileName = path.basename(filePath);
  const tags = [];

  try {
    const tagDirs = await fs.readdir(tagsDir, { withFileTypes: true });

    for (const tagDir of tagDirs) {
      if (!tagDir.isDirectory() || tagDir.name.startsWith('.')) continue;

      const linkPath = path.join(tagsDir, tagDir.name, fileName);
      try {
        const linkStats = await fs.lstat(linkPath);
        if (linkStats.isSymbolicLink()) {
          tags.push(tagDir.name);
        }
      } catch (e) {
        // Link doesn't exist, skip
      }
    }
  } catch (e) {
    // Tags directory doesn't exist or can't be read
  }

  return tags;
}

// Helper: Remove all symlinks to a file
async function removeAllSymlinks(fileName) {
  const tagsDir = path.join(ROOT_DIR, 'tags');

  try {
    const tagDirs = await fs.readdir(tagsDir, { withFileTypes: true });

    for (const tagDir of tagDirs) {
      if (!tagDir.isDirectory() || tagDir.name.startsWith('.')) continue;

      const linkPath = path.join(tagsDir, tagDir.name, fileName);
      try {
        await fs.unlink(linkPath);
      } catch (e) {
        // Link doesn't exist or can't be removed
      }
    }
  } catch (e) {
    // Tags directory doesn't exist
  }
}

// GET /api/files/tags?path=some/file
// Returns tags for a file
router.get('/tags', async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'File path required' });
    }

    const fullPath = safePath(filePath);
    const tags = await getTagsForFile(fullPath);

    res.json({ tags });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/files/tags
// Updates tags for a file
router.post('/tags', async (req, res) => {
  try {
    const { path: filePath, tags } = req.body;
    if (!filePath || !Array.isArray(tags)) {
      return res.status(400).json({ error: 'File path and tags array required' });
    }

    const fullPath = safePath(filePath);
    const fileName = path.basename(fullPath);

    // Verify file exists and is not a directory
    const stats = await fs.stat(fullPath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Cannot tag directories' });
    }

    // Get current tags
    const currentTags = await getTagsForFile(fullPath);

    // Determine tags to add and remove
    const tagsToAdd = tags.filter(tag => !currentTags.includes(tag));
    const tagsToRemove = currentTags.filter(tag => !tags.includes(tag));

    const tagsDir = path.join(ROOT_DIR, 'tags');

    // Remove tags
    for (const tag of tagsToRemove) {
      const linkPath = path.join(tagsDir, tag, fileName);
      try {
        await fs.unlink(linkPath);
      } catch (e) {
        // Link doesn't exist
      }
    }

    // Add tags
    const errors = [];
    for (const tag of tagsToAdd) {
      const tagDir = path.join(tagsDir, tag);

      // Create tag directory if it doesn't exist
      await fs.mkdir(tagDir, { recursive: true });

      const linkPath = path.join(tagDir, fileName);

      // Check if link already exists
      try {
        await fs.lstat(linkPath);
        // Link exists, skip
        continue;
      } catch (e) {
        // Link doesn't exist, create it
      }

      // Create relative path from tag directory to file
      const relativePath = path.relative(tagDir, fullPath);

      try {
        await fs.symlink(relativePath, linkPath);
      } catch (e) {
        errors.push({ tag, error: e.message });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Some symlinks failed to create',
        errors,
        tags
      });
    }

    res.json({ success: true, tags });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/files/trash
// Moves a file to .trash folder at root
router.post('/trash', async (req, res) => {
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

    const fileName = path.basename(sourceFullPath);

    // Remove all symlinks to this file
    await removeAllSymlinks(fileName);

    // Create .trash directory if it doesn't exist
    const trashDir = path.join(ROOT_DIR, '.trash');
    try {
      await fs.mkdir(trashDir, { recursive: true });
    } catch (e) {
      // Directory might already exist
    }

    const destFullPath = path.join(trashDir, fileName);

    // Move file to trash (overwrite if exists)
    await fs.rename(sourceFullPath, destFullPath);

    res.json({ success: true, message: `Moved ${fileName} to trash` });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/files/upload
router.post('/upload', upload.array('files'), async (req, res) => {
  try {
    const targetPath = req.body.path || '';
    const dirPath = safePath(targetPath);

    // Verify directory exists
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Target must be a directory' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const results = [];

    for (const file of req.files) {
      // Write to temporary file first
      const tempFileName = `.upload-temp-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      const tempPath = path.join(dirPath, tempFileName);

      try {
        // Write data to temp file
        await fs.writeFile(tempPath, file.buffer);

        // Get unique final filename (handles conflicts)
        const fileName = await getUniqueFileName(dirPath, file.originalname);
        const fullPath = path.join(dirPath, fileName);

        // Atomically rename temp file to final name
        await fs.rename(tempPath, fullPath);

        results.push({
          originalName: file.originalname,
          savedName: fileName,
          size: file.size
        });
      } catch (err) {
        // Clean up temp file if it exists
        try {
          await fs.unlink(tempPath);
        } catch (e) {
          // Temp file may not exist, ignore
        }
        throw err;
      }
    }

    res.json({ success: true, files: results });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
