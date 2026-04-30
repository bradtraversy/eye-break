const fs = require('fs');

for (const dir of ['dist', 'release', 'out']) {
  fs.rmSync(dir, { recursive: true, force: true });
}
