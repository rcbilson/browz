class TreeView {
  constructor(container, onSelect) {
    this.container = container;
    this.onSelect = onSelect;
    this.expandedPaths = new Set();
    this.selectedPath = '';
  }

  async loadChildren(path = '') {
    const response = await fetch(`/api/files/tree?path=${encodeURIComponent(path)}`);
    const data = await response.json();
    return data.directories;
  }

  async render() {
    const rootDirs = await this.loadChildren('');
    this.container.innerHTML = '';

    // Add root item
    const rootItem = this.createItem({ name: '/', path: '', hasChildren: true }, true);
    this.container.appendChild(rootItem);

    // Render root children
    const childContainer = document.createElement('div');
    childContainer.className = 'tree-children';
    for (const dir of rootDirs) {
      childContainer.appendChild(this.createItem(dir, false));
    }
    this.container.appendChild(childContainer);
  }

  createItem(item, isRoot) {
    const div = document.createElement('div');
    div.className = 'tree-item';
    if (item.path === this.selectedPath) {
      div.classList.add('selected');
    }

    const toggle = document.createElement('span');
    toggle.className = 'tree-toggle';
    toggle.textContent = item.hasChildren ? '▶' : '';

    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.textContent = '📁';

    const name = document.createElement('span');
    name.textContent = isRoot ? 'Root' : item.name;

    div.appendChild(toggle);
    div.appendChild(icon);
    div.appendChild(name);

    div.addEventListener('click', async (e) => {
      e.stopPropagation();

      // Handle expand/collapse
      if (item.hasChildren) {
        const isExpanded = this.expandedPaths.has(item.path);
        if (isExpanded) {
          this.expandedPaths.delete(item.path);
          toggle.textContent = '▶';
          const children = div.nextElementSibling;
          if (children && children.classList.contains('tree-children')) {
            children.remove();
          }
        } else {
          this.expandedPaths.add(item.path);
          toggle.textContent = '▼';
          const dirs = await this.loadChildren(item.path);
          if (dirs.length > 0) {
            const childContainer = document.createElement('div');
            childContainer.className = 'tree-children';
            for (const dir of dirs) {
              childContainer.appendChild(this.createItem(dir, false));
            }
            div.after(childContainer);
          }
        }
      }

      // Update selection
      this.selectedPath = item.path;
      document.querySelectorAll('.tree-item.selected').forEach(el =>
        el.classList.remove('selected')
      );
      div.classList.add('selected');

      this.onSelect(item.path);
    });

    return div;
  }
}
