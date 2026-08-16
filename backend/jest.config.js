/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/__tests__'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    // Relative imports from test files (depth 1) — e.g. src/__tests__/auth.routes.test.ts → src/services/foo.ts → ../db
    '^../db$': '<rootDir>/src/__tests__/__mocks__/db.ts',
    '^../redis$': '<rootDir>/src/__tests__/__mocks__/redis.ts',
    '^../socket$': '<rootDir>/src/__tests__/__mocks__/socket.ts',
    '^../middleware/auth$': '<rootDir>/src/__tests__/__mocks__/auth-middleware.ts',
    '^../config/firebaseAdmin$': '<rootDir>/src/__tests__/__mocks__/firebaseAdmin.ts',
    // Depth-2 relative imports — route files import from ../../db relative to services, etc.
    '^../../db$': '<rootDir>/src/__tests__/__mocks__/db.ts',
    '^../../redis$': '<rootDir>/src/__tests__/__mocks__/redis.ts',
    '^../../socket$': '<rootDir>/src/__tests__/__mocks__/socket.ts',
    '^../../middleware/auth$': '<rootDir>/src/__tests__/__mocks__/auth-middleware.ts',
    '^../../config/firebaseAdmin$': '<rootDir>/src/__tests__/__mocks__/firebaseAdmin.ts',
    // Depth-3 relative imports — nested modules like src/modules/notifications/strategies
    '^../../../db$': '<rootDir>/src/__tests__/__mocks__/db.ts',
    '^../../../redis$': '<rootDir>/src/__tests__/__mocks__/redis.ts',
    '^../../../socket$': '<rootDir>/src/__tests__/__mocks__/socket.ts',
    '^../../../middleware/auth$': '<rootDir>/src/__tests__/__mocks__/auth-middleware.ts',
    '^../../../config/firebaseAdmin$': '<rootDir>/src/__tests__/__mocks__/firebaseAdmin.ts',
  },
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/__tests__/**',
    '!src/db/migrate.ts',
    '!src/db/seed.ts',
    '!src/index.ts',
    '!src/instrument.ts',
  ],
  coverageReporters: ['text', 'lcov'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { strict: false }, diagnostics: false }],
  },
};
