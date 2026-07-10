const fs = require('fs');
const path = require('path');

// Load .env file for PM2
const envFile = path.join(__dirname, '.env');
const envVars = {};
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...rest] = trimmed.split('=');
      if (key && rest.length) {
        envVars[key.trim()] = rest.join('=').trim();
      }
    }
  });
}

module.exports = {
  apps: [{
    name: "whatxpress",
    script: "dist/server.cjs",
    cwd: "/root/workspace/whatxpress",
    env: {
      NODE_ENV: "production",
      ...envVars
    }
  }]
};
