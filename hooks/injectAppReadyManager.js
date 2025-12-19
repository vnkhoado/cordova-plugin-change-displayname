#!/usr/bin/env node

/**
 * Inject AppReadyManager & config-loader-mobile scripts into index.html
 * - Android: uses file:///android_asset/www/js/...
 * - iOS: uses /js/...
 */

module.exports = function (context) {
  const fs = require('fs');
  const path = require('path');

  const platforms = context.opts.platforms || [];
  if (!platforms.length) {
    console.log('[injectAppReadyManager] No platforms detected');
    return;
  }

  platforms.forEach((platform) => {
    if (platform === 'android') {
      const indexPath = path.join(
        context.opts.projectRoot,
        'platforms',
        'android',
        'app',
        'src',
        'main',
        'assets',
        'www',
        'index.html'
      );

      if (!fs.existsSync(indexPath)) {
        console.log('[injectAppReadyManager][android] index.html not found:', indexPath);
        return;
      }

      let content = fs.readFileSync(indexPath, 'utf8');

      // Remove any previous injected tags
      content = content.replace(
        /<script[^>]*src=["'][^"']*AppReadyManager\.js["'][^>]*><\/script>\s*/g,
        ''
      );
      content = content.replace(
        /<script[^>]*src=["'][^"']*config-loader-mobile\.js["'][^>]*><\/script>\s*/g,
        ''
      );

      const scriptTags =
        '<script src="file:///android_asset/www/js/AppReadyManager.js"></script>\n' +
        '<script src="file:///android_asset/www/js/config-loader-mobile.js"></script>\n';

      if (content.includes('</head>')) {
        content = content.replace('</head>', scriptTags + '</head>');
        fs.writeFileSync(indexPath, content, 'utf8');
        console.log('[injectAppReadyManager][android] Injected local scripts with file:// path');
      } else {
        console.log('[injectAppReadyManager][android] </head> not found, skipping inject');
      }
    }

    if (platform === 'ios') {
      const indexPath = path.join(
        context.opts.projectRoot,
        'platforms',
        'ios',
        'www',
        'index.html'
      );

      if (!fs.existsSync(indexPath)) {
        console.log('[injectAppReadyManager][ios] index.html not found:', indexPath);
        return;
      }

      let content = fs.readFileSync(indexPath, 'utf8');

      // Remove any previous injected tags
      content = content.replace(
        /<script[^>]*src=["'][^"']*AppReadyManager\.js["'][^>]*><\/script>\s*/g,
        ''
      );
      content = content.replace(
        /<script[^>]*src=["'][^"']*config-loader-mobile\.js["'][^>]*><\/script>\s*/g,
        ''
      );

      const scriptTags =
        '<script src="/js/AppReadyManager.js"></script>\n' +
        '<script src="/js/config-loader-mobile.js"></script>\n';

      if (content.includes('</head>')) {
        content = content.replace('</head>', scriptTags + '</head>');
        fs.writeFileSync(indexPath, content, 'utf8');
        console.log('[injectAppReadyManager][ios] Injected local scripts with /js/ path');
      } else {
        console.log('[injectAppReadyManager][ios] </head> not found, skipping inject');
      }
    }
  });
};
