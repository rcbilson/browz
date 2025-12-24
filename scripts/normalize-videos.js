const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
require('dotenv').config();

const execAsync = promisify(exec);

// Configuration
const ROOT_DIR = process.env.ROOT_DIR || process.cwd();
const THUMB_DIR = path.join(ROOT_DIR, '.thumb');
const EXCLUDED_DIRS = ['tags', '.trash', '.thumb'];
const SOURCE_EXTS = ['.mov', '.wmv', '.flv'];
const MP4_EXT = '.mp4';
const THUMB_EXT = '.jpg';

// Processing tracking
const results = {
  transcoded: [],
  thumbnails: [],
  errors: []
};

// Security: Prevent path traversal attacks (pattern from src/api/files.js)
function safePath(requestedPath) {
  const resolved = path.resolve(ROOT_DIR, requestedPath || '');
  if (!resolved.startsWith(ROOT_DIR)) {
    throw new Error('Access denied: Path traversal attempt');
  }
  return resolved;
}

// Check if ffmpeg and ffprobe are installed
async function checkFFmpegInstalled() {
  try {
    await execAsync('ffmpeg -version');
    await execAsync('ffprobe -version');
    console.log('✓ ffmpeg found');
    console.log('✓ ffprobe found');
    return true;
  } catch (error) {
    console.error('\n✗ ERROR: ffmpeg and ffprobe must be installed');
    console.error('Install with: sudo apt-get install ffmpeg (Linux)');
    console.error('           or: brew install ffmpeg (macOS)');
    process.exit(1);
  }
}

// Get video duration using ffprobe
async function getVideoDuration(videoPath) {
  const escapedPath = videoPath.replace(/'/g, "'\\''");
  const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 '${escapedPath}'`;

  try {
    const { stdout } = await execAsync(cmd);
    return parseFloat(stdout.trim());
  } catch (error) {
    throw new Error(`Failed to get video duration: ${error.message}`);
  }
}

// Transcode video to MP4 format
async function transcodeToMp4(inputPath) {
  const parsed = path.parse(inputPath);
  const outputPath = path.join(parsed.dir, parsed.name + MP4_EXT);
  const tempPath = outputPath + '.tmp';

  // Check if output already exists
  try {
    await fs.access(outputPath);
    return null; // Skip - already exists
  } catch {
    // File doesn't exist, proceed with transcoding
  }

  // Check if temp file already exists
  try {
    await fs.access(tempPath);
    return null; // Skip - some other instance running
  } catch {
    // File doesn't exist, proceed with transcoding
  }

  // Clean up any leftover temp file from previous interrupted run
  try {
    await fs.unlink(tempPath);
  } catch {
    // Temp file doesn't exist, that's fine
  }

  const escapedInput = inputPath.replace(/'/g, "'\\''");
  const escapedTemp = tempPath.replace(/'/g, "'\\''");

  const cmd = `ffmpeg -i '${escapedInput}' -c:v libx264 -preset medium -crf 23 -c:a aac -movflags +faststart -f mp4 '${escapedTemp}'`;

  try {
    // Transcode to temporary file
    console.log(`running ${cmd}`);
    await execAsync(cmd);

    // Rename temp file to final output on success
    await fs.rename(tempPath, outputPath);

    return outputPath;
  } catch (error) {
    // Clean up temp file on failure
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw new Error(`Transcode failed: ${error.message}`);
  }
}

// Generate thumbnail from video
async function generateThumbnail(videoPath) {
  try {
    // Get video duration
    const duration = await getVideoDuration(videoPath);
    const middleTime = duration / 2; // 50% of video

    // Determine thumbnail path
    const relPath = path.relative(ROOT_DIR, videoPath);
    const parsed = path.parse(relPath);
    const thumbRelPath = path.join(parsed.dir, parsed.name + THUMB_EXT);
    const thumbPath = path.join(THUMB_DIR, thumbRelPath);

    // Check if thumbnail already exists
    try {
      await fs.access(thumbPath);
      return null; // Skip - already exists
    } catch {
      // File doesn't exist, proceed
    }

    // Ensure directory structure exists
    await fs.mkdir(path.dirname(thumbPath), { recursive: true });

    // Generate thumbnail
    const escapedInput = videoPath.replace(/'/g, "'\\''");
    const escapedOutput = thumbPath.replace(/'/g, "'\\''");

    const cmd = `ffmpeg -ss ${middleTime} -i '${escapedInput}' -vf scale=160:-1 -vframes 1 -q:v 2 '${escapedOutput}'`;

    await execAsync(cmd);
    return thumbPath;
  } catch (error) {
    throw new Error(`Failed to generate thumbnail: ${error.message}`);
  }
}

// Recursively walk directory tree
async function walkDirectory(dir, callback) {
  // Check if this is an excluded top-level directory
  const relPath = path.relative(ROOT_DIR, dir);
  if (relPath) {
    const topLevelDir = relPath.split(path.sep)[0];
    if (EXCLUDED_DIRS.includes(topLevelDir)) {
      return; // Skip this entire branch
    }
  }

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden files
      if (entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walkDirectory(fullPath, callback);
      } else if (entry.isFile()) {
        await callback(fullPath);
      }
    }
  } catch (error) {
    results.errors.push({
      path: dir,
      error: error.message
    });
  }
}

// Main execution
async function main() {
  const startTime = Date.now();

  console.log('Starting video normalization...');
  console.log(`ROOT_DIR: ${ROOT_DIR}\n`);

  // Validate ROOT_DIR exists
  if (!fsSync.existsSync(ROOT_DIR)) {
    console.error(`✗ ERROR: ROOT_DIR does not exist: ${ROOT_DIR}`);
    process.exit(1);
  }

  // Check dependencies
  console.log('Checking dependencies...');
  await checkFFmpegInstalled();
  console.log();

  // Ensure .thumb directory exists
  await fs.mkdir(THUMB_DIR, { recursive: true });

  console.log('Scanning for videos...\n');

  // Step 1: Find and transcode videos
  const mp4Files = [];

  console.log('Transcoding videos...');
  await walkDirectory(ROOT_DIR, async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();

    if (SOURCE_EXTS.includes(ext)) {
      // This is a source file that needs transcoding
      try {
        const outputPath = await transcodeToMp4(filePath);
        if (outputPath) {
          const relInput = path.relative(ROOT_DIR, filePath);
          const relOutput = path.relative(ROOT_DIR, outputPath);
          console.log(`✓ Transcoded: ${relInput} → ${relOutput}`);
          results.transcoded.push({ input: relInput, output: relOutput });
          mp4Files.push(outputPath);
        }
      } catch (error) {
        const relPath = path.relative(ROOT_DIR, filePath);
        results.errors.push({
          path: relPath,
          error: `Transcode failed: ${error.message}`
        });
      }
    } else if (ext === MP4_EXT) {
      // This is already an MP4 file
      mp4Files.push(filePath);
    }
  });

  // Step 2: Generate thumbnails for all MP4 files
  console.log('\nGenerating thumbnails...');
  for (const mp4Path of mp4Files) {
    try {
      const thumbPath = await generateThumbnail(mp4Path);
      if (thumbPath) {
        const relThumb = path.relative(ROOT_DIR, thumbPath);
        console.log(`✓ Thumbnail: ${relThumb}`);
        results.thumbnails.push(relThumb);
      }
    } catch (error) {
      const relPath = path.relative(ROOT_DIR, mp4Path);
      results.errors.push({
        path: relPath,
        error: `Thumbnail failed: ${error.message}`
      });
    }
  }

  // Print summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\nSummary:');
  console.log('========');
  console.log(`Transcoded: ${results.transcoded.length}`);
  if (results.transcoded.length > 0) {
    results.transcoded.forEach(item => {
      console.log(`  - ${item.input} → ${item.output}`);
    });
  }

  console.log(`\nThumbnails: ${results.thumbnails.length}`);
  if (results.thumbnails.length > 0) {
    results.thumbnails.forEach(thumb => {
      console.log(`  - ${thumb}`);
    });
  }

  if (results.errors.length > 0) {
    console.log(`\nErrors: ${results.errors.length}`);
    results.errors.forEach(err => {
      console.log(`  - ${err.path}: ${err.error}`);
    });
  }

  console.log(`\nCompleted in ${elapsed}s`);
}

// Run main function
main().catch(error => {
  console.error('\n✗ Fatal error:', error.message);
  process.exit(1);
});
