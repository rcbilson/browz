# Browz

A simple web-based file browser with tagging support, built with Node.js and Express.

## Features

- **Two-panel interface**: Directory tree on the left, file listing on the right
- **File tagging**: Tag files using symbolic links for organization
- **Sortable columns**: Sort by name, date, or size
- **Media preview**: Built-in video/audio player for common formats
- **Trash functionality**: Move files to a `.trash` folder
- **Clean UI**: Modern, responsive design

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file:

```bash
# Root directory to browse
ROOT_DIR=/path/to/your/directory

# Server port (default: 3000)
PORT=3000
```

## Usage

### Running locally

```bash
npm start
```

### Running with Docker

```bash
# Build the image
docker build -t browz .

# Run the container
docker run -p 3000:3000 -v /path/to/browse:/data browz

# Or with environment variables
docker run -p 3000:3000 \
  -v /path/to/browse:/data \
  -e ROOT_DIR=/data \
  browz
```

Then open `http://localhost:3000` in your browser.

## How It Works

### Browsing
- Click folders in the tree to navigate
- Click files to select them
- Double-click files to open them

### Tagging
- Select a file and click the **tag** button
- Enter tags separated by spaces
- Tags are stored as symbolic links in `ROOT_DIR/tags/`

### Sorting
- Click column headers (Name, Date, Size) to sort
- Click again to reverse order
- Directories always stay at the top

### Actions
- **open** - Open file in new tab
- **tag** - Manage file tags
- **trash** - Move file to `.trash` folder

## License

MIT
