const fs = require('fs');
const path = require('path');

const targets = ['.next', '.next-turbo'];

for (const target of targets) {
  const full = path.join(process.cwd(), target);
  try {
    fs.rmSync(full, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors.
  }
}

