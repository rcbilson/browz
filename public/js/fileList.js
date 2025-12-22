class FileList {
  constructor(container, onNavigate) {
    this.container = container;
    this.onNavigate = onNavigate;
    this.selectedItem = null;
    this.currentPath = '';

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
    this.render(data.items, path);
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

  render(items, currentPath) {
    this.container.innerHTML = '';
    this.selectedItem = null;

    if (items.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'empty-message';
      emptyMsg.textContent = 'Empty directory';
      this.container.appendChild(emptyMsg);
      return;
    }

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
