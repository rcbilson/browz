document.addEventListener('DOMContentLoaded', () => {
  const treeContainer = document.getElementById('tree');
  const fileListContainer = document.getElementById('file-list');
  const breadcrumbContainer = document.getElementById('breadcrumb');
  const treePanel = document.getElementById('tree-panel');
  const treeToggleBtn = document.getElementById('tree-toggle-btn');
  const treeCloseBtn = document.getElementById('tree-close-btn');

  let currentPath = '';

  // Tree panel visibility
  function showTreePanel() {
    treePanel.classList.add('visible');
    treeToggleBtn.classList.add('hidden');
  }

  function hideTreePanel() {
    treePanel.classList.remove('visible');
    treeToggleBtn.classList.remove('hidden');
  }

  treeToggleBtn.addEventListener('click', showTreePanel);
  treeCloseBtn.addEventListener('click', hideTreePanel);

  // Update breadcrumb navigation
  function updateBreadcrumb(path) {
    const parts = path ? path.split('/') : [];
    let html = '<a href="#" data-path="">Root</a>';
    let accumulated = '';

    for (const part of parts) {
      accumulated += (accumulated ? '/' : '') + part;
      html += ` / <a href="#" data-path="${accumulated}">${part}</a>`;
    }

    breadcrumbContainer.innerHTML = html;

    breadcrumbContainer.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(a.dataset.path);
      });
    });
  }

  // Navigate to path
  function navigateTo(path) {
    currentPath = path;
    updateBreadcrumb(path);
    fileList.load(path);
  }

  // Initialize tree view
  const tree = new TreeView(treeContainer, (path) => {
    navigateTo(path);
    hideTreePanel(); // Auto-hide when directory is selected
  });

  // Initialize file list
  const fileList = new FileList(fileListContainer, (path) => {
    navigateTo(path);
  });

  // Initial load
  tree.render();
  fileList.load('');
  updateBreadcrumb('');
});
