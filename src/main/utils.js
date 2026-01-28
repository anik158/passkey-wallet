const activeWin = require('active-win');

async function getFocusedWindowTitle() {
  const window = await activeWin();
  return window ? window.title : null;
}

module.exports = { getFocusedWindowTitle };