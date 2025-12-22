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
  }

  async load(path = '') {
    this.currentPath = path;
    const response = await fetch(`/api/files/list?path=${encodeURIComponent(path)}`);
    const data = await response.json();
    this.currentItems = data.items;
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

      const name = document.createElement('span');
      name.className = 'file-name';
      name.textContent = item.name;

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

        const trashBtn = document.createElement('button');
        trashBtn.className = 'action-btn trash-btn';
        trashBtn.textContent = 'trash';
        trashBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.trashFile(item, div);
        });

        actionsSpan.appendChild(openBtn);
        actionsSpan.appendChild(trashBtn);
        sizeOrActions.appendChild(actionsSpan);
      }

      div.appendChild(icon);
      div.appendChild(name);
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
