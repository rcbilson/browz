# Browz - File Browser Web Application

A simple, clean web-based file browser built with Node.js and Express. Browse directories on your server through an intuitive two-panel interface with tree navigation and file listings.

## Overview

Browz is a lightweight file browser that allows you to navigate and view files from a configured directory through a web interface. It features a hierarchical directory tree on the left for navigation and a detailed file listing on the right.

## Features

- **Two-Panel Interface**: Directory tree navigation on the left, file listing on the right
- **Lazy-Loading Tree**: Directories load children only when expanded for performance
- **Breadcrumb Navigation**: Quick navigation to parent directories
- **File Viewing**: Click files to open them in a new browser tab
- **Media Player Preview**: Dedicated preview page with Video.js for playing video and audio files
- **Security**: Path traversal protection and hidden file exclusion
- **Responsive Design**: Clean, modern UI that works across screen sizes

## Technology Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla HTML/CSS/JavaScript (no framework dependencies)
- **Media Player**: Video.js 8.10.0 (CDN)
- **Configuration**: dotenv for environment variables

## Project Structure

```
browz/
├── package.json              # Project dependencies and scripts
├── .env                      # Configuration (not in git)
├── .env.example              # Configuration template
├── .gitignore                # Git ignore rules
├── server.js                 # Main Express server
├── src/
│   └── api/
│       └── files.js          # File system API routes
└── public/
    ├── index.html            # Main application page
    ├── preview.html          # Media player preview page
    ├── css/
    │   └── styles.css        # Application styles
    └── js/
        ├── app.js            # Main application logic
        ├── tree.js           # Tree view component
        └── fileList.js       # File list component
```

## Configuration

Configuration is managed through a `.env` file in the project root:

```bash
# Root directory to browse (absolute path)
ROOT_DIR=/path/to/your/directory

# Server port
PORT=3000
```

**Important**: Copy `.env.example` to `.env` and configure your desired root directory.

## API Endpoints

### `GET /api/files/list`
Lists the contents of a directory.

**Query Parameters**:
- `path` - Relative path from ROOT_DIR (optional, defaults to root)

**Response**:
```json
{
  "items": [
    {
      "name": "example.txt",
      "path": "relative/path/example.txt",
      "isDirectory": false,
      "size": 1024,
      "modified": "2025-01-15T10:30:00Z"
    }
  ],
  "path": "relative/path"
}
```

### `GET /api/files/tree`
Returns subdirectories for the tree view (directories only).

**Query Parameters**:
- `path` - Relative path from ROOT_DIR (optional, defaults to root)

**Response**:
```json
{
  "directories": [
    {
      "name": "subdir",
      "path": "relative/path/subdir",
      "hasChildren": true
    }
  ],
  "path": "relative/path"
}
```

### `GET /browse/*`
Serves files directly from the ROOT_DIR for viewing/download.

**Example**: `/browse/documents/file.pdf`

### `GET /preview.html`
Media player page for video and audio playback.

**Query Parameters**:
- `path` - Relative path to media file

**Example**: `/preview.html?path=videos/movie.mp4`

## Installation & Usage

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env and set your ROOT_DIR
```

### 3. Start the Server
```bash
npm start
```

For development with auto-restart on file changes:
```bash
npm run dev
```

### 4. Open in Browser
Navigate to `http://localhost:3000`

## Components

### Tree View (`public/js/tree.js`)
- Renders hierarchical directory structure
- Lazy loads subdirectories on expand
- Handles selection and navigation
- Visual indicators (▶/▼) for expand/collapse state

### File List (`public/js/fileList.js`)
- Displays files and directories in selected folder
- Shows file size and icons
- Handles click events for navigation and file opening
- Sorts directories first, then alphabetically

### Main App (`public/js/app.js`)
- Coordinates tree and file list components
- Manages breadcrumb navigation
- Synchronizes state between panels

### Media Preview (`public/preview.html`)
- Video.js-based media player
- Supports video formats: MP4, WebM, OGV, MOV, AVI, MKV, M4V, WMV
- Supports audio formats: MP3, OGG, WAV, M4A, AAC, FLAC
- Includes download button and navigation controls
- Browser codec support may vary by format

## Security Features

1. **Path Traversal Prevention**: The `safePath()` function in `src/api/files.js` ensures all requested paths resolve within ROOT_DIR
2. **Hidden File Exclusion**: Files starting with `.` are excluded from tree and list views
3. **Isolated File Serving**: The `/browse` route only serves files from ROOT_DIR
4. **Input Validation**: All path parameters are validated before file system operations

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- JavaScript required
- Media playback depends on browser codec support:
  - MP4: Universal support
  - WebM: Wide support
  - MOV: Best in Safari/Chrome
  - WMV: Limited (best in Edge)
  - AVI/MKV: May require transcoding

## Development Notes

### Adding New File Types
To add support for new media file types:

1. Add extension to `videoExts` or `audioExts` array in `public/preview.html` (line ~152)
2. Add MIME type mapping in `getMimeType()` function in `public/preview.html` (line ~200)

### Customizing Appearance
- Modify `public/css/styles.css` for styling changes
- Color scheme uses Material Design inspired colors
- Dark theme in preview page for optimal video viewing

### API Extensions
Add new routes in `src/api/files.js` for additional functionality like:
- File search
- File upload
- Thumbnail generation
- File metadata

## Limitations

- Read-only browsing (no file operations like upload, delete, rename)
- Single ROOT_DIR per instance
- No user authentication/authorization
- Media playback limited by browser codec support
- Large directories may be slow to load

## Future Enhancements

Potential features for future development:
- File search functionality
- File upload support
- Thumbnail previews for images/videos
- Keyboard navigation shortcuts
- Server-side media transcoding for broader format support
- Multiple user support with permissions
- File operations (copy, move, delete, rename)
- Bookmarking favorite paths

## License

ISC

## Contributing

This is a simple personal project. Feel free to fork and modify for your needs.
