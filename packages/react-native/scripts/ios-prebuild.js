/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

const {prepareHermesArtifactsAsync} = require('./ios-prebuild/hermes');
const {
  createFolderIfNotExists,
  throwIfOnEden,
} = require('./ios-prebuild/utils');
const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Prebuilding React Native iOS...');
  console.log('');

  throwIfOnEden();

  try {
    // Root
    const root = process.cwd();

    // Create build folder
    const buildFolder = path.resolve(root, '.build');
    createFolderIfNotExists(buildFolder);

    // Create the hard links folder
    const linksFolder = path.resolve(buildFolder, 'headers');
    createFolderIfNotExists(linksFolder);

    /**
     * Creates a hard link from one path to another. For each subfolder
     * in the source path, it creates a link in the target path with an
     * underscore prefix.
     * @param {string} fromPath - The path to the source file or directory
     * @param {string} includePath - Path in the headers folder to create the link
     * @throws {Error} If the source path does not exist or if the link creation fails
     * @returns {void}
     */
    const link = (fromPath /*:string*/, includePath /*:string*/) => {
      const source = path.resolve(root, fromPath);
      const target = path.resolve(linksFolder, includePath);
      console.log(`Linking ${source} to ${target}...`);

      createFolderIfNotExists(target);

      // get subfolders in source - make sure we only copy folders with header files
      const entries = fs.readdirSync(source, {withFileTypes: true});
      if (
        entries.some(
          dirent =>
            dirent.isFile() &&
            (String(dirent.name).endsWith('.h') ||
              String(dirent.name).endsWith('.hpp')),
        )
      ) {
        // Create link for all header files (*.h, *.hpp) in the source directory
        entries.forEach(entry => {
          const entryName = String(entry.name);
          if (entry.isFile() && /\.(h|hpp)$/.test(entryName)) {
            const sourceFile = path.join(source, entryName);
            const targetFile = path.join(target, entryName);
            // Skip if the file already exists
            if (fs.existsSync(targetFile)) {
              return;
            }
            try {
              fs.linkSync(sourceFile, targetFile);
            } catch (e) {
              console.error(
                `Failed to create link for ${sourceFile} to ${targetFile}: ${e}`,
              );
            }
          }
        });
      }

      const subfolders = entries
        .filter(dirent => dirent.isDirectory())
        .filter(dirent => dirent.name !== '__tests__')
        .map(dirent => dirent.name);

      // Create links for subfolders
      subfolders.forEach(folder => {
        link(path.join(fromPath, String(folder)), includePath);
      });
    };

    // CODEGEN
    console.log('Running codegen...');
    const codegenPath = path.join(root, '.build/codegen');
    createFolderIfNotExists(codegenPath);

    const command = `node scripts/generate-codegen-artifacts -p "${root}" -o "${codegenPath}"  -t ios`;
    console.log(command);
    execSync(command, {stdio: 'inherit'});

    // HERMES ARTIFACTS
    console.log('Download hermes...');
    // Temporary hardcoded hermes version to make the script work
    // We will make it right in a future diff.
    // TODO: T223708709
    await prepareHermesArtifactsAsync('0.80.0-rc.0', 'debug');

    // LINKING
    link('Libraries/WebSocket/', 'React');
    link('React/Base', 'React');
    link('React/Base/Surface', 'React');
    link('React/CxxBridge', 'React');
    link('React/CxxModule', 'React');
    link('React/CxxUtils', 'React');
    link('React/DevSupport', 'React');
    link('React/Inspector', 'React');
    link('React/I18n', 'React');
    link('React/Views', 'React');
    link('React/CoreModules', 'React');
    link('React/Modules', 'React');
    link('React/Fabric', 'React');
    link('React/Profiler', 'React');
    link('React/CoreModules', 'React');
    link('React/Runtime', 'React');
    link('React/Views/ScrollView', 'React');
    link('React/Views/RefreshControl', 'React');
    link('Libraries/Text', 'React');
    link(
      'ReactApple/Libraries/RCTFoundation/RCTDeprecation/Exported',
      'RCTDeprecation',
    );
    link('Libraries/Required', 'RCTRequired');
    link('Libraries/TypeSafety', 'RCTTypeSafety');
    link('Libraries/Text', 'React');
    link('Libraries/Image', 'React');
    link('Libraries/Network', 'React');
    link('Libraries/Blob', 'React');
    link('Libraries/NativeAnimation', 'React');
    link('Libraries/LinkingIOS', 'React');

    link('ReactCommon/hermes', 'reacthermes');
    link('ReactCommon/hermes', 'jsireact');

    link(
      'ReactCommon/react/renderer/imagemanager',
      'react/renderer/imagemanager',
    );

    // Done!
    console.log('🏁 Done!');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  // eslint-disable-next-line no-void
  void main();
}
