#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

module.exports = function (ctx) {
  const platform = "android";
  if (!ctx.opts.platforms.includes(platform)) {
    return;
  }

  const rootDir = ctx.opts.projectRoot;

  // Thư mục icon gốc trong project
  const resSrc = path.join(rootDir, "res", "android");

  // Thư mục resource trong Android Gradle
  const resDest = path.join(rootDir, "platforms", "android", "app", "src", "main", "res");

  // Các density Android
  const densities = [
    "ldpi",
    "mdpi",
    "hdpi",
    "xhdpi",
    "xxhdpi",
    "xxxhdpi"
  ];

  densities.forEach(dpi => {
    const src = path.join(resSrc, `drawable-${dpi}`, `icon.png`);
    const dest = path.join(resDest, `drawable-${dpi}`, `ic_launcher.png`);

    if (fs.existsSync(src)) {
      try {
        fs.copyFileSync(src, dest);
        console.log(`Copied: ${src} → ${dest}`);
      } catch (err) {
        console.error(`Error copying ${src} → ${dest}:`, err);
      }
    } else {
      console.warn(`⚠️ Not found: ${src}`);
    }
  });
};
