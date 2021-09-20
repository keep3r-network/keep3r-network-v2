module.exports = {
  skipFiles: ['for-test', 'interfaces'],
  mocha: {
    forbidOnly: true,
    grep: '@skip-on-coverage',
    invert: true,
  },
};
