/**
 * Build script for packaging the extension
 */

const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');

// Configuration
const distDir = 'dist';
const sourceDir = '.';
const zipName = 'youtube-content-blocker.zip';
const filesToCopy = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'options.html',
  'options.css',
  'options.js',
  'utility.js',
  'guide.html',
  'icons'
];
const filesToIgnore = [
  '.git',
  '.gitignore',
  'node_modules',
  'build.js',
  'zip.js',
  'package.json',
  'package-lock.json',
  'store-submission.md',
  'dist'
];

// Clean dist directory
console.log('Cleaning dist directory...');
fs.removeSync(distDir);
fs.ensureDirSync(distDir);

// Copy files
console.log('Copying files...');
filesToCopy.forEach(file => {
  const srcPath = path.join(sourceDir, file);
  const destPath = path.join(distDir, file);
  if (fs.existsSync(srcPath)) {
    if (fs.lstatSync(srcPath).isDirectory()) {
      fs.copySync(srcPath, destPath);
    } else {
      fs.copySync(srcPath, destPath);
    }
    console.log(`Copied ${file}`);
  } else {
    console.error(`File not found: ${file}`);
  }
});

// Create zip file
console.log('Creating zip file...');
const output = fs.createWriteStream(path.join(distDir, zipName));
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

output.on('close', () => {
  const sizeInMB = (archive.pointer() / 1048576).toFixed(2);
  console.log(`Zip file created: ${zipName} (${sizeInMB} MB)`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// Add all files in dist except the zip itself
fs.readdirSync(distDir).forEach(file => {
  if (file !== zipName) {
    const fullPath = path.join(distDir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      archive.directory(fullPath, file);
    } else {
      archive.file(fullPath, { name: file });
    }
  }
});

archive.finalize();

console.log('Build complete!');
