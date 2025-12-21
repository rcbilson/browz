class FileList {
  constructor(container, onNavigate) {
    this.container = container;
    this.onNavigate = onNavigate;
  }

  async load(path = '') {
    const response = await fetch(`/api/files/list?path=${encodeURIComponent(path)}`);
    const data = await response.json();
    this.render(data.items, path);
  }

  render(items, currentPath) {
    this.container.innerHTML = '';

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

      const icon = document.createElement('span');
      icon.className = 'file-icon';
      icon.textContent = item.isDirectory ? '📁' : '📄';

      const name = document.createElement('span');
      name.className = 'file-name';
      name.textContent = item.name;

      const size = document.createElement('span');
      size.className = 'file-size';
      size.textContent = item.isDirectory ? '' : this.formatSize(item.size);

      div.appendChild(icon);
      div.appendChild(name);
      div.appendChild(size);

      div.addEventListener('click', () => {
        if (item.isDirectory) {
          this.onNavigate(item.path);
        } else {
          // Open file in new tab
          window.open(`/browse/${item.path}`, '_blank');
        }
      });

      this.container.appendChild(div);
    }
  }

  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }
}
