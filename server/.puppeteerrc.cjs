const { join } = require('path');

// Chrome is kept inside the project so the www-data service user finds the copy root installed.
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
