module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/packages/**/*.(test|spec).[jt]s?(x)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/lib/'],
  modulePathIgnorePatterns: ['/templates/'],
}
