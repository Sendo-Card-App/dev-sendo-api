// jest.config.js
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    transform: {
      '^.+\\.(ts|tsx)?$': 'ts-jest',
    },
    testMatch: ['<rootDir>/tests/**/*.test.(ts|tsx|js|jsx)'],
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/src/$1',
      '^@config/(.*)$': '<rootDir>/src/config/$1',
      '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
      '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
      '^@models/(.*)$': '<rootDir>/src/models/$1',
      '^@utils/(.*)$': '<rootDir>/src/utils/$1',
      '^@services/(.*)$': '<rootDir>/src/services/$1',
    },
    forceExit: true
};
  