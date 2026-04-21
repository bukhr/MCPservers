// @ts-nocheck
import { describe, it, expect, jest, beforeEach, beforeAll } from "@jest/globals";
import fs from 'fs';
import winston from 'winston';

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

jest.mock('winston', () => {
  const mockFormat = {
    combine: jest.fn().mockReturnValue({}),
    timestamp: jest.fn().mockReturnValue({}),
    printf: jest.fn().mockReturnValue({}),
    colorize: jest.fn().mockReturnValue({})
  };
  
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };
  
  return {
    format: mockFormat,
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    },
    createLogger: jest.fn().mockReturnValue(mockLogger)
  };
});

const mockLoadGrafanaConfig = jest.fn().mockReturnValue({
  baseUrl: "https://grafana.example.com",
  apiKey: "mock-api-key",
  orgId: 1
});

const mockLoadLogConfig = jest.fn().mockReturnValue({
  level: 'info',
  format: 'json',
  enableFileLogs: false,
  logDir: './logs'
});

jest.unstable_mockModule('../../config/settings.js', () => ({
  loadGrafanaConfig: mockLoadGrafanaConfig,
  loadLogConfig: mockLoadLogConfig,
  getLogDir: jest.fn().mockReturnValue('/var/log/grafana'),
  settingsLogger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  }
}));

const mockSearchDashboards = jest.fn();
const mockGetDashboard = jest.fn();
const mockQueryMetrics = jest.fn();
const mockQueryLogs = jest.fn();
const mockSearchDataSources = jest.fn();
const mockQuerySql = jest.fn();

jest.unstable_mockModule("../../services/grafana-client.js", () => ({
  GrafanaClient: jest.fn().mockImplementation(() => ({
    searchDashboards: mockSearchDashboards,
    getDashboard: mockGetDashboard,
    queryMetrics: mockQueryMetrics,
    queryLogs: mockQueryLogs,
    searchDataSources: mockSearchDataSources,
    querySql: mockQuerySql
  }))
}));

let registerSqlToolFn;
let McpServer;

beforeAll(async () => {
  const sqlToolModule = await import("../../tools/sql.js");
  registerSqlToolFn = sqlToolModule.registerSqlTool;
  const mcpModule = await import("@modelcontextprotocol/sdk/server/mcp.js");
  McpServer = mcpModule.McpServer;
});

describe("SQL Tool", () => {
  const mockServer = {
    tool: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should register query_sql tool", () => {
    registerSqlToolFn(mockServer as any);
    expect(mockServer.tool).toHaveBeenCalledWith(
      "query_sql",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should execute SQL queries successfully", async () => {
    registerSqlToolFn(mockServer as any);
    const toolHandler = mockServer.tool.mock.calls[0][3];
    const params = {
      queries: ['SELECT * FROM users'],
      datasource: 'test-ds-uid'
    };
    const mockResponse = { data: { results: {} }, status: 'success' };
    mockQuerySql.mockResolvedValue(mockResponse);

    const result = await toolHandler(params);

    expect(mockQuerySql).toHaveBeenCalledWith({ query: 'SELECT * FROM users', datasource: 'test-ds-uid' });
    const parsedResult = JSON.parse(result.content[0].text);
    expect(parsedResult.successful).toHaveLength(1);
    expect(parsedResult.successful[0]).toEqual(mockResponse);
    expect(parsedResult.failed).toHaveLength(0);
  });

  it("should handle errors during SQL query execution", async () => {
    registerSqlToolFn(mockServer as any);
    const toolHandler = mockServer.tool.mock.calls[0][3];
    const params = {
      queries: ['SELECT * FROM users'],
      datasource: 'test-ds-uid'
    };
    mockQuerySql.mockRejectedValue(new Error('Query failed'));

    const result = await toolHandler(params);

    const parsedResult = JSON.parse(result.content[0].text);
    expect(parsedResult.successful).toHaveLength(0);
    expect(parsedResult.failed).toHaveLength(1);
    expect(parsedResult.failed[0]).toContain('Query failed');
  });
});
