const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(path.join(dir, f));
    }
  });
}

const regexImport = /import\s+\{\s*useAuth\s*\}\s+from\s+['"]([^'"]+hooks\/useAuth)['"];?/g;
const regexCall = /\buseAuth\(\)/g;

let count = 0;

walkDir(path.join(__dirname, 'src'), (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    // Skip the hook and context themselves
    if (filePath.includes('useAuth.ts') || filePath.includes('AuthContext.tsx')) {
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    if (content.match(regexImport)) {
      content = content.replace(regexImport, (match, p1) => {
        const newPath = p1.replace('hooks/useAuth', 'context/AuthContext');
        return `import { useAuthContext } from "${newPath}";`;
      });
      modified = true;
    }
    
    if (modified && content.match(regexCall)) {
      content = content.replace(regexCall, 'useAuthContext()');
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      count++;
      console.log(`Refactored: ${filePath}`);
    }
  }
});

console.log(`Done! Refactored ${count} files.`);
