// @ts-nocheck
import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';
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
  baseUrl: 'https://grafana.example.com',
  apiKey: 'mock-api-key',
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

jest.unstable_mockModule('../../services/grafana-client.js', () => ({
  GrafanaClient: jest.fn().mockImplementation(() => ({
    searchDashboards: mockSearchDashboards,
    getDashboard: mockGetDashboard,
    queryMetrics: mockQueryMetrics,
    queryLogs: mockQueryLogs,
    searchDataSources: mockSearchDataSources
  }))
}));

let registerLogsToolFn;
let GrafanaClientClass;

beforeAll(async () => {
  const logsModule = await import('../../tools/logs.js');
  const clientModule = await import('../../services/grafana-client.js');
  
  registerLogsToolFn = logsModule.registerLogsTool;
  GrafanaClientClass = clientModule.GrafanaClient;
});

describe('Logs Tool', () => {
  const mockServer = {
    tool: jest.fn()
  };
  
  const mockGrafanaConfig = {
    baseUrl: 'https://grafana.example.com',
    apiKey: 'mock-api-key'
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('registerLogsTool', () => {
    it('should register query_logs tool', () => {
      registerLogsToolFn(mockServer as any);
      
      expect(mockServer.tool).toHaveBeenCalledWith(
        'query_logs',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });
  });
  
  describe('query_logs handler', () => {
    it('should process log queries with basic parameters', async () => {
      const mockRawResponse = {
        results: { A: { frames: [ { schema: {}, data: { values: [ [1672574400000], ['Test log message'], [{ level: 'info' }] ] } } ] } }
      };
      
      mockQueryLogs.mockResolvedValue({ data: mockRawResponse, status: 'success' });
      
      registerLogsToolFn(mockServer as any);
      
      const toolHandler = mockServer.tool.mock.calls[0][3];
      const result = await toolHandler({ queries: ['{level="info"}'], datasource: 'test_ds' });
      
      expect(mockQueryLogs).toHaveBeenCalledWith({
        query: '{level="info"}',
        datasource: 'test_ds'
      });
      
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.successful).toHaveLength(1);
      expect(parsedResult.successful[0]).toEqual(mockRawResponse);
      expect(parsedResult.failed).toHaveLength(0);
    });
    
    it('should handle errors', async () => {
      mockQueryLogs.mockRejectedValue(new Error('Query failed'));
      
      registerLogsToolFn(mockServer as any);
      
      const toolHandler = mockServer.tool.mock.calls[0][3];
      const result = await toolHandler({ queries: ['invalid query'], datasource: 'test_ds' });
      
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.successful).toHaveLength(0);
      expect(parsedResult.failed).toHaveLength(1);
      expect(parsedResult.failed[0]).toBe('Query failed');
    });
  });
});
