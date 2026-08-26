/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

import type { Config } from 'jest';

const config: Config = {
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,

  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,

  // The directory where Jest should output its coverage files
  coverageDirectory: "coverage",


  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: "v8",
  transform: {
    // 处理 TypeScript 文件
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        // 指定 tsconfig.json 的路径（可选，但推荐）
        tsconfig: '<rootDir>/tsconfig.json',
      },
    ],
  },
  // 处理路径别名
  moduleNameMapper: {
    // 将 @/ 开头的路径映射到 <rootDir>/src/ 目录下
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // A list of reporter names that Jest uses when writing coverage reports
  coverageReporters: [
    "json",
    "text",
    "html",
  ],
};

export default config;
