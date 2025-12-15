// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import fs from 'node:fs';
import path from 'node:path';
import readdirp from 'readdirp';

const directories = ['src', 'src-tauri'];
const files = ['*.vue', '*.html', '*.js', '*.ts', '*.rs'];
const htmlTypeCommentExtensions = ['.vue', '.html'];
const lineTypeCommentExtensions = ['.js', '.ts', '.rs'];
const SPDXIdentifier = 'SPDX-License-Identifier';
const licenseText = [
  'SPDX-License-Identifier: GPL-3.0-or-later',
  'License: GNU GPLv3 or later. See the license file in the project root for more information.',
  'Copyright © 2021 - present Aleksey Hoffman. All rights reserved.',
];

async function initAppendLicense() {
  console.log('🔍 Starting license sync...');

  for (const dirPath of directories) {
    console.log(`📂 Scanning directory: ${dirPath}`);

    try {
      const stream = readdirp(dirPath, {
        fileFilter: (entry) => {
          const ext = path.extname(entry.basename);
          return ['.vue', '.html', '.js', '.ts', '.rs'].includes(ext);
        },
        directoryFilter: (entry) => {
          // Exclude specific directories but allow recursion into others
          const shouldExclude = ['target', 'node_modules', 'dist', '.git', 'resources'].includes(entry.basename);
          return !shouldExclude;
        },
        type: 'files',
        depth: Infinity,
      });

      const entries = [];

      for await (const entry of stream) {
        entries.push(entry);

        const licenseLines = getLicenseLines(entry).reverse();
        const fileLines = fs.readFileSync(entry.fullPath).toString().split('\n');
        const alreadyHasLicense = fileLines[0].includes(SPDXIdentifier);

        if (!alreadyHasLicense) {
          console.log(`   ✅ Adding license to: ${entry.path}`);
          licenseLines.forEach((licenseLine) => {
            fileLines.unshift(licenseLine);
          });
          fs.writeFileSync(entry.fullPath, fileLines.join('\n'));
        }
      }

      console.log(`📊 Found ${entries.length} files in ${dirPath}`);
    }
    catch (error) {
      console.error(`❌ Error scanning ${dirPath}:`, error);
    }
  }

  console.log('🎉 License sync completed!');
}

function getLicenseLines(dirItem) {
  const parsedFileName = path.parse(dirItem.basename);

  if (htmlTypeCommentExtensions.includes(parsedFileName.ext)) {
    return [
      `<!-- ${licenseText[0]}`,
      `${licenseText[1]}`,
      `${licenseText[2]}`,
      '-->',
      '',
    ];
  }
  else if (lineTypeCommentExtensions.includes(parsedFileName.ext)) {
    return [
      `// ${licenseText[0]}`,
      `// ${licenseText[1]}`,
      `// ${licenseText[2]}`,
      '',
    ];
  }
  else {
    return [];
  }
}

initAppendLicense();
