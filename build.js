const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const outputDir = path.join(projectRoot, 'docs');
const filesToCopy = [
  'index.html',
  'style.css',
  'app.js',
  'calculator.js',
  'visualizer.js',
  '.nojekyll'
];

if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true });
}

fs.mkdirSync(outputDir, { recursive: true });

for (const fileName of filesToCopy) {
  const src = path.join(projectRoot, fileName);
  const dest = path.join(outputDir, fileName);

  if (!fs.existsSync(src)) {
    console.warn(`Warning: skipping missing file ${fileName}`);
    continue;
  }

  fs.copyFileSync(src, dest);
}

console.log(`Built GitHub Pages site to ${outputDir}`);
