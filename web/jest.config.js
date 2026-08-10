module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { strict: false, jsx: 'react-jsx' } }],
  },
  moduleNameMapper: {
    // Next.js internals — stub them out
    '^next/dynamic$': '<rootDir>/__tests__/__mocks__/next-dynamic.tsx',
    '^next/navigation$': '<rootDir>/__tests__/__mocks__/next-navigation.ts',
    '^next/image$': '<rootDir>/__tests__/__mocks__/next-image.tsx',
    '^next/link$': '<rootDir>/__tests__/__mocks__/next-link.tsx',
    // CSS / static assets
    '\\.(css|scss|sass)$': 'identity-obj-proxy',
    // Any module that just re-exports nothing needed
    '^framer-motion$': '<rootDir>/__tests__/__mocks__/framer-motion.tsx',
    '^sonner$': '<rootDir>/__tests__/__mocks__/sonner.ts',
    '^lucide-react$': '<rootDir>/__tests__/__mocks__/lucide-react.tsx',
  },
  setupFiles: ['<rootDir>/__tests__/setup.ts'],
};
