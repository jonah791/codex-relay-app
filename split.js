const fs = require('fs');
const path = require('path');

const input = 'C:/Users/张/Desktop/新建文件夹/codex-relay-app/dist/Codex-Relay-v1.0.0-portable.zip';
const chunkSize = 25 * 1024 * 1024; // 25MB
const buffer = fs.readFileSync(input);
const total = buffer.length;
const parts = Math.ceil(total / chunkSize);

console.log(`File size: ${(total / 1024 / 1024).toFixed(1)} MB`);
console.log(`Splitting into ${parts} parts of ${chunkSize / 1024 / 1024}MB each...`);

for (let i = 0; i < parts; i++) {
  const start = i * chunkSize;
  const end = Math.min(start + chunkSize, total);
  const chunk = buffer.subarray(start, end);
  const partName = input.replace('.zip', `.part${String(i + 1).padStart(2, '0')}.zip`);
  fs.writeFileSync(partName, chunk);
  console.log(`  Part ${i + 1}/${parts}: ${(chunk.length / 1024 / 1024).toFixed(1)} MB -> ${path.basename(partName)}`);
}

// Also create a merge script
const mergeBat = `@echo off
echo Merging ${parts} parts into Codex-Relay-v1.0.0-portable.zip ...
copy /b ${path.basename(input).replace('.zip', '.part*.zip')} ${path.basename(input)}
echo Done! Now extract the zip.
pause
`;
fs.writeFileSync(input.replace('.zip', '-merge.bat'), mergeBat);
console.log('\nCreated merge.bat script');
console.log('Upload all .part*.zip files + merge.bat to GitHub Release');
