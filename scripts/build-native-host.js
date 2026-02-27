import { execSync } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

// Cross-compilation from macos to windows throws errors due to missing base node binaries.
// This script ensures GitHub Actions runners only build for their own platform natively.
const platform = os.platform();
let target = '';
let outputName = '';

if (platform === 'win32') {
    target = 'node18-win-x64';
    outputName = 'native-host-win.exe';
} else if (platform === 'darwin') {
    target = 'node18-macos-x64';
    outputName = 'native-host-macos';
} else {
    target = 'node18-linux-x64';
    outputName = 'native-host-linux';
}

const inputPath = 'browser-extension/native-host.js';
const outputDir = 'browser-extension/dist';
const outputPath = path.join(outputDir, outputName);

// Ensure output directory exists before pkg runs
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`[Build Native Host] Compiling for platform: ${platform} -> Target: ${target}`);
try {
    // pkg input.js --targets <target> --output <outputPath>
    execSync(`npx pkg ${inputPath} --targets ${target} --output ${outputPath}`, { stdio: 'inherit' });
    console.log(`[Build Native Host] Successfully built ${outputName}`);
} catch (error) {
    console.error(`[Build Native Host] FATAL: pkg failed to build for ${target}`, error);
    process.exit(1);
}
