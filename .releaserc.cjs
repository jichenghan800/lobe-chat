const config = require('@lobehub/lint').semanticRelease;

config.branches = [
  'main',
  {
    name: 'next',
    prerelease: true,
  },
];

// Remove NPM publishing by excluding "@semantic-release/npm" plugin
// Keep or add other plugins like GitHub Releases
config.plugins = config.plugins.filter((plugin) => plugin !== '@semantic-release/npm');

config.plugins.push([
  '@semantic-release/exec',
  {
    prepareCmd: 'npm run workflow:changelog',
  },
]);

module.exports = config;
