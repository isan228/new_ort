// On phones every `.table` row is drawn as a card (see styles/mobile.css); each cell shows its
// column name from `data-label`. Labels are taken from the table header, so pages need no changes.
function labelTable(table) {
  const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
  if (!heads.length) return;
  for (const row of table.querySelectorAll('tbody tr')) {
    [...row.children].forEach((cell, i) => {
      if (cell.hasAttribute('data-label') || !heads[i]) return;
      cell.setAttribute('data-label', heads[i]);
    });
  }
}

export function startMobileTables() {
  let queued = false;
  const run = () => {
    queued = false;
    document.querySelectorAll('table.table').forEach(labelTable);
  };
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(run);
  }).observe(document.body, { childList: true, subtree: true });
  run();
}
