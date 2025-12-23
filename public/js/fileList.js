class FileList {
  constructor(container, onNavigate) {
    this.container = container;
    this.onNavigate = onNavigate;
    this.selectedItem = null;
    this.currentPath = '';
    this.sortField = 'name'; // name, date, size
    this.sortDirection = 'asc'; // asc, desc

    // Click outside to deselect
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.deselectAll();
      }
    });

    this.setupDragAndDrop();
  }

  async load(path = '') {
    this.currentPath = path;
    const response = await fetch(`/api/files/list?path=${encodeURIComponent(path)}`);
    const data = await response.json();

    // Fetch tags for all files
    const itemsWithTags = await Promise.all(data.items.map(async (item) => {
      if (!item.isDirectory) {
        try {
          const tagsResponse = await fetch(`/api/files/tags?path=${encodeURIComponent(item.path)}`);
          const tagsData = await tagsResponse.json();
          item.tags = tagsData.tags || [];
        } catch (e) {
          item.tags = [];
        }
      } else {
        item.tags = [];
      }
      return item;
    }));

    this.currentItems = itemsWithTags;
    this.render();
  }

  deselectAll() {
    if (this.selectedItem) {
      this.selectedItem.element.classList.remove('selected');

      // Show date and size, hide actions
      const sizeOrActions = this.selectedItem.element.querySelector('.file-size-or-actions');
      if (sizeOrActions) {
        const dateSpan = sizeOrActions.querySelector('.file-date');
        const sizeSpan = sizeOrActions.querySelector('.file-size');
        const actionsSpan = sizeOrActions.querySelector('.file-actions');
        if (dateSpan) dateSpan.style.display = 'inline';
        if (sizeSpan) sizeSpan.style.display = 'inline';
        if (actionsSpan) actionsSpan.style.display = 'none';
      }

      this.selectedItem = null;
    }
  }

  setSortField(field) {
    if (this.sortField === field) {
      // Toggle direction if clicking same field
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New field, default to ascending
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.render();
  }

  sortItems(items) {
    // Separate directories and files
    const dirs = items.filter(item => item.isDirectory);
    const files = items.filter(item => !item.isDirectory);

    // Sort files based on current sort field
    files.sort((a, b) => {
      let comparison = 0;

      if (this.sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (this.sortField === 'date') {
        comparison = new Date(a.modified) - new Date(b.modified);
      } else if (this.sortField === 'size') {
        comparison = a.size - b.size;
      }

      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    // Sort directories by name only (always ascending)
    dirs.sort((a, b) => a.name.localeCompare(b.name));

    // Directories always first
    return [...dirs, ...files];
  }

  encodeFilePath(path) {
    // Encode each path segment to handle special characters like # and spaces
    return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
  }

  async trashFile(item, itemElement) {
    try {
      const response = await fetch('/api/files/trash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ path: item.path })
      });

      const result = await response.json();

      if (response.ok) {
        // Remove from DOM
        itemElement.remove();
        this.selectedItem = null;
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert(`Failed to trash file: ${error.message}`);
    }
  }

  render() {
    this.container.innerHTML = '';
    this.selectedItem = null;

    if (!this.currentItems || this.currentItems.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'empty-message';
      emptyMsg.textContent = 'Empty directory';
      this.container.appendChild(emptyMsg);
      return;
    }

    // Add header row
    const header = document.createElement('div');
    header.className = 'file-list-header';

    const iconSpacer = document.createElement('span');
    iconSpacer.className = 'header-icon';
    header.appendChild(iconSpacer);

    const nameHeader = document.createElement('span');
    nameHeader.className = 'header-name';
    nameHeader.textContent = 'Name';
    if (this.sortField === 'name') {
      nameHeader.textContent += this.sortDirection === 'asc' ? ' ▲' : ' ▼';
    }
    nameHeader.addEventListener('click', () => this.setSortField('name'));
    header.appendChild(nameHeader);

    const dateHeader = document.createElement('span');
    dateHeader.className = 'header-date';
    dateHeader.textContent = 'Date';
    if (this.sortField === 'date') {
      dateHeader.textContent += this.sortDirection === 'asc' ? ' ▲' : ' ▼';
    }
    dateHeader.addEventListener('click', () => this.setSortField('date'));
    header.appendChild(dateHeader);

    const sizeHeader = document.createElement('span');
    sizeHeader.className = 'header-size';
    sizeHeader.textContent = 'Size';
    if (this.sortField === 'size') {
      sizeHeader.textContent += this.sortDirection === 'asc' ? ' ▲' : ' ▼';
    }
    sizeHeader.addEventListener('click', () => this.setSortField('size'));
    header.appendChild(sizeHeader);

    this.container.appendChild(header);

    // Sort items
    const items = this.sortItems(this.currentItems);

    for (const item of items) {
      const div = document.createElement('div');
      div.className = 'file-item';
      div.dataset.path = item.path;

      const icon = document.createElement('span');
      icon.className = 'file-icon';
      icon.textContent = item.isDirectory ? '📁' : '📄';

      const nameContainer = document.createElement('span');
      nameContainer.className = 'file-name';

      const name = document.createElement('span');
      name.textContent = item.name;
      nameContainer.appendChild(name);

      // Add tags if file has any
      if (!item.isDirectory && item.tags && item.tags.length > 0) {
        const tagsSpan = document.createElement('span');
        tagsSpan.className = 'file-tags';
        tagsSpan.textContent = ' ' + item.tags.join(' ');
        nameContainer.appendChild(tagsSpan);
      }

      const sizeOrActions = document.createElement('span');
      sizeOrActions.className = 'file-size-or-actions';

      if (item.isDirectory) {
        // Directories show nothing in the right column
        sizeOrActions.textContent = '';
      } else {
        // Files show date and size by default
        const dateSpan = document.createElement('span');
        dateSpan.className = 'file-date';
        dateSpan.textContent = this.formatDate(item.modified);
        sizeOrActions.appendChild(dateSpan);

        const sizeSpan = document.createElement('span');
        sizeSpan.className = 'file-size';
        sizeSpan.textContent = this.formatSize(item.size);
        sizeOrActions.appendChild(sizeSpan);

        // Create action buttons (hidden by default)
        const actionsSpan = document.createElement('span');
        actionsSpan.className = 'file-actions';
        actionsSpan.style.display = 'none';

        const openBtn = document.createElement('button');
        openBtn.className = 'action-btn open-btn';
        openBtn.textContent = 'open';
        openBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.open(`/browse/${this.encodeFilePath(item.path)}`, '_blank');
        });

        const tagBtn = document.createElement('button');
        tagBtn.className = 'action-btn tag-btn';
        tagBtn.textContent = 'tag';
        tagBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openTagModal(item);
        });

        const trashBtn = document.createElement('button');
        trashBtn.className = 'action-btn trash-btn';
        trashBtn.textContent = 'trash';
        trashBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.trashFile(item, div);
        });

        actionsSpan.appendChild(openBtn);
        actionsSpan.appendChild(tagBtn);
        actionsSpan.appendChild(trashBtn);
        sizeOrActions.appendChild(actionsSpan);
      }

      div.appendChild(icon);
      div.appendChild(nameContainer);
      div.appendChild(sizeOrActions);

      // Click handler
      div.addEventListener('click', (e) => {
        if (item.isDirectory) {
          // Directories navigate on single click
          this.onNavigate(item.path);
        } else {
          // Files: toggle selection
          if (this.selectedItem && this.selectedItem.element === div) {
            // Clicking selected item deselects it
            this.deselectAll();
          } else {
            // Select this item
            this.deselectAll();
            div.classList.add('selected');
            this.selectedItem = { item, element: div };

            // Show actions, hide date and size
            const dateSpan = sizeOrActions.querySelector('.file-date');
            const sizeSpan = sizeOrActions.querySelector('.file-size');
            const actionsSpan = sizeOrActions.querySelector('.file-actions');
            if (dateSpan) dateSpan.style.display = 'none';
            if (sizeSpan) sizeSpan.style.display = 'none';
            if (actionsSpan) actionsSpan.style.display = 'inline-flex';
          }
        }
      });

      // Double-click handler for files
      if (!item.isDirectory) {
        div.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          window.open(`/browse/${this.encodeFilePath(item.path)}`, '_blank');
        });
      }

      this.container.appendChild(div);
    }
  }

  openTagModal(item) {
    // Create modal backdrop
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    const title = document.createElement('h2');
    title.textContent = `Tags for ${item.name}`;
    modalContent.appendChild(title);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tag-input';
    input.placeholder = 'Enter tags separated by spaces';
    input.value = item.tags ? item.tags.join(' ') : '';

    // Handle Enter key
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const tagsString = input.value.trim();
        const tags = tagsString ? tagsString.split(/\s+/).filter(t => t) : [];
        await this.updateTags(item, tags);
        document.body.removeChild(modal);
      }
    });

    modalContent.appendChild(input);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'modal-buttons';

    const updateBtn = document.createElement('button');
    updateBtn.textContent = 'Update';
    updateBtn.className = 'modal-btn primary-btn';
    updateBtn.addEventListener('click', async () => {
      const tagsString = input.value.trim();
      const tags = tagsString ? tagsString.split(/\s+/).filter(t => t) : [];

      await this.updateTags(item, tags);
      document.body.removeChild(modal);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'modal-btn';
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    buttonContainer.appendChild(updateBtn);
    buttonContainer.appendChild(cancelBtn);
    modalContent.appendChild(buttonContainer);

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Focus input
    input.focus();

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });

    // Close on escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        document.body.removeChild(modal);
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  async updateTags(item, tags) {
    try {
      const response = await fetch('/api/files/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ path: item.path, tags })
      });

      if (response.ok) {
        // Reload the current directory to refresh tags
        await this.load(this.currentPath);
      } else {
        const result = await response.json();
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert(`Failed to update tags: ${error.message}`);
    }
  }

  setupDragAndDrop() {
    const panel = this.container.closest('.file-list-panel');

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      panel.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    // Visual feedback
    ['dragenter', 'dragover'].forEach(eventName => {
      panel.addEventListener(eventName, () => {
        panel.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      panel.addEventListener(eventName, () => {
        panel.classList.remove('drag-over');
      });
    });

    // Handle drop
    panel.addEventListener('drop', (e) => {
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        this.openUploadModal(files);
      }
    });
  }

  openUploadModal(files) {
    // Create modal backdrop (following tag modal pattern from line 304)
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    const title = document.createElement('h2');
    title.textContent = `Upload ${files.length} file${files.length > 1 ? 's' : ''}`;
    modalContent.appendChild(title);

    // Progress container
    const progressContainer = document.createElement('div');
    progressContainer.className = 'upload-progress';

    // File list
    files.forEach((file, index) => {
      const fileRow = document.createElement('div');
      fileRow.className = 'upload-file-row';

      const fileName = document.createElement('span');
      fileName.className = 'upload-file-name';
      fileName.textContent = file.name;

      const fileStatus = document.createElement('span');
      fileStatus.className = 'upload-file-status';
      fileStatus.textContent = 'Pending...';
      fileStatus.dataset.index = index;

      fileRow.appendChild(fileName);
      fileRow.appendChild(fileStatus);
      progressContainer.appendChild(fileRow);
    });

    modalContent.appendChild(progressContainer);

    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'modal-buttons';

    const uploadBtn = document.createElement('button');
    uploadBtn.textContent = 'Upload';
    uploadBtn.className = 'modal-btn primary-btn';
    uploadBtn.addEventListener('click', async () => {
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Uploading...';
      await this.performUpload(files, progressContainer);

      // Hide upload button and update cancel to close
      uploadBtn.style.display = 'none';
      cancelBtn.textContent = 'Close';
      cancelBtn.className = 'modal-btn primary-btn';
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'modal-btn';
    cancelBtn.addEventListener('click', () => {
      // Allow closing if not currently uploading
      if (cancelBtn.textContent === 'Close' || !uploadBtn.disabled) {
        document.body.removeChild(modal);
      }
    });

    buttonContainer.appendChild(uploadBtn);
    buttonContainer.appendChild(cancelBtn);
    modalContent.appendChild(buttonContainer);

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal && (cancelBtn.textContent === 'Close' || !uploadBtn.disabled)) {
        document.body.removeChild(modal);
      }
    });

    // Close on escape
    const escapeHandler = (e) => {
      if (e.key === 'Escape' && (cancelBtn.textContent === 'Close' || !uploadBtn.disabled)) {
        document.body.removeChild(modal);
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  async performUpload(files, progressContainer) {
    const formData = new FormData();

    // Add files
    files.forEach(file => {
      formData.append('files', file);
    });

    // Add current path
    formData.append('path', this.currentPath);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
        // Don't set Content-Type - browser sets it with boundary
      });

      const result = await response.json();

      if (response.ok) {
        // Update status for each file
        result.files.forEach((fileResult, index) => {
          const statusSpan = progressContainer.querySelector(`[data-index="${index}"]`);
          if (statusSpan) {
            statusSpan.textContent = fileResult.savedName === fileResult.originalName
              ? 'Uploaded ✓'
              : `Uploaded as ${fileResult.savedName} ✓`;
            statusSpan.style.color = '#27ae60';
          }
        });

        // Reload file list (pattern from line 394)
        await this.load(this.currentPath);
      } else {
        // Show error
        files.forEach((_, index) => {
          const statusSpan = progressContainer.querySelector(`[data-index="${index}"]`);
          if (statusSpan) {
            statusSpan.textContent = `Error: ${result.error}`;
            statusSpan.style.color = '#e74c3c';
          }
        });
      }
    } catch (error) {
      // Network error
      files.forEach((_, index) => {
        const statusSpan = progressContainer.querySelector(`[data-index="${index}"]`);
        if (statusSpan) {
          statusSpan.textContent = `Failed: ${error.message}`;
          statusSpan.style.color = '#e74c3c';
        }
      });
    }
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }
}
