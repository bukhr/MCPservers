// @ts-nocheck
import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';
import fs from 'fs';
import winston from 'winston';

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

// Mockear Winston para silenciar logs
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

let registerDashboardsToolFn;
let GrafanaClientClass;

beforeAll(async () => {
  const dashboardsModule = await import('../../tools/dashboards.js');
  const clientModule = await import('../../services/grafana-client.js');
  
  registerDashboardsToolFn = dashboardsModule.registerDashboardsTool;
  GrafanaClientClass = clientModule.GrafanaClient;
});


describe('Dashboards Tool', () => {
  const mockServer = {
    tool: jest.fn()
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('registerDashboardsTool', () => {
    it('should register search_dashboards tool', () => {
      registerDashboardsToolFn(mockServer as any);
      
      expect(mockServer.tool).toHaveBeenCalledWith(
        'search_dashboards',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });
    
    it('should register get_dashboard tool', () => {
      registerDashboardsToolFn(mockServer as any);
      
      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_dashboard',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });
  });
  
  describe('search_dashboards handler', () => {
    it('should process dashboard search', async () => {
      const mockSearchResult = { 
        dashboards: [{ id: 1, title: 'Test Dashboard' }],
        total: 1
      };
      
      mockSearchDashboards.mockResolvedValue(mockSearchResult);
      
      registerDashboardsToolFn(mockServer as any);
      
      const toolHandler = mockServer.tool.mock.calls[0][3];
      const result = await toolHandler({ query: 'test' });
      
      expect(GrafanaClientClass).toHaveBeenCalledWith({
        baseUrl: 'https://grafana.example.com',
        apiKey: 'mock-api-key',
        orgId: 1
      });
      expect(mockSearchDashboards).toHaveBeenCalledWith({
        query: 'test',
        tag: undefined,
        limit: undefined,
        folderIds: undefined,
        starred: undefined
      });
      expect(result.content[0].text).toContain('Test Dashboard');
    });
    
    it('should handle errors', async () => {
      mockSearchDashboards.mockRejectedValue(new Error('Search failed'));
      
      registerDashboardsToolFn(mockServer as any);
      
      const toolHandler = mockServer.tool.mock.calls[0][3];
      const result = await toolHandler({ query: 'test' });
      
      expect(result.content[0].text).toContain('Search failed');
    });
  });
  
  describe('get_dashboard handler', () => {
    it('should process dashboard detail', async () => {
      const mockDashboardDetail = {
        dashboard: { id: 1, title: 'Test Dashboard' },
        meta: { isStarred: true }
      };
      
      mockGetDashboard.mockResolvedValue(mockDashboardDetail);
      
      registerDashboardsToolFn(mockServer as any);
      
      const toolHandler = mockServer.tool.mock.calls[1][3];
      const result = await toolHandler({ uid: 'abc123' });
      
      expect(GrafanaClientClass).toHaveBeenCalledWith({
        baseUrl: 'https://grafana.example.com',
        apiKey: 'mock-api-key',
        orgId: 1
      });
      expect(mockGetDashboard).toHaveBeenCalledWith('abc123');
      expect(result.content[0].text).toContain('Test Dashboard');
    });
    
    it('should handle errors', async () => {
      mockGetDashboard.mockRejectedValue(new Error('Dashboard not found'));
      
      registerDashboardsToolFn(mockServer as any);
      
      const toolHandler = mockServer.tool.mock.calls[1][3];
      const result = await toolHandler({ uid: 'abc123' });
      
      expect(result.content[0].text).toContain('Dashboard not found');
    });
  });
});
