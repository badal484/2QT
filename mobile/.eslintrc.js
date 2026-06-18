module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: [
    'ios/**',
    'android/**',
    'node_modules/**',
    'dist/**'
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    'react-native/no-inline-styles': 'warn',
  }
};
