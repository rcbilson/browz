require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const filesRouter = require('./src/api/files');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = process.env.ROOT_DIR || process.cwd();

// Validate ROOT_DIR exists
if (!fs.existsSync(ROOT_DIR)) {
  console.error(`ERROR: ROOT_DIR does not exist: ${ROOT_DIR}`);
  process.exit(1);
}

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// API routes for file browsing
app.use('/api/files', filesRouter);

// Serve actual files from ROOT_DIR (for download/viewing)
app.use('/browse', express.static(ROOT_DIR));

app.listen(PORT, () => {
  console.log(`File browser running at http://localhost:${PORT}`);
  console.log(`Browsing directory: ${ROOT_DIR}`);
});
