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

jest.unstable_mockModule("../../services/grafana-client.js", () => ({
  GrafanaClient: jest.fn().mockImplementation(() => ({
    searchDashboards: mockSearchDashboards,
    getDashboard: mockGetDashboard,
    queryMetrics: mockQueryMetrics,
    queryLogs: mockQueryLogs,
    searchDataSources: mockSearchDataSources
  }))
}));

let registerMetricsToolFn;
let GrafanaClientClass;

beforeAll(async () => {
  const metricsModule = await import("../../tools/metrics.js");
  const clientModule = await import("../../services/grafana-client.js");
  
  registerMetricsToolFn = metricsModule.registerMetricsTool;
  GrafanaClientClass = clientModule.GrafanaClient;
});

describe("Metrics Tool", () => {
  const mockServer = {
    tool: jest.fn()
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe("registerMetricsTool", () => {
    it("should register query_metrics tool", () => {
      registerMetricsToolFn(mockServer as any);
      
      expect(mockServer.tool).toHaveBeenCalledWith(
        "query_metrics",
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });
  });
  
  describe("query_metrics handler", () => {
    it("should process metric queries with basic parameters", async () => {
      const mockQueryResult = {
        series: [
          { metric: { instance: "server1" }, datapoints: [{ timestamp: 1600000000, value: 42.5 }] }
        ],
        status: "success"
      };
      
      mockQueryMetrics.mockResolvedValue(mockQueryResult);
      
      registerMetricsToolFn(mockServer as any);
      
      const toolHandler = mockServer.tool.mock.calls[0][3];
      const result = await toolHandler({ queries: ["rate(http_requests_total[5m])"], datasource: 'test-ds' });
      
      expect(mockQueryMetrics).toHaveBeenCalledWith({
        query: "rate(http_requests_total[5m])",
        datasource: 'test-ds'
      });
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.successful).toHaveLength(1);
      expect(parsedResult.successful[0]).toEqual(mockQueryResult);
      expect(parsedResult.failed).toHaveLength(0);
    });
    
    it("should handle time range parameters", async () => {
      const mockQueryResult = { series: [], status: "success" };
      
      mockQueryMetrics.mockResolvedValue(mockQueryResult);
      
      registerMetricsToolFn(mockServer as any);
      
      const toolHandler = mockServer.tool.mock.calls[0][3];
      const result = await toolHandler({ 
        queries: ["rate(http_requests_total[5m])"],
        datasource: 'test-ds',
        start: 1600000000,
        end: 1600001000,
        step: 60
      });
      
      expect(mockQueryMetrics).toHaveBeenCalledWith({
        query: "rate(http_requests_total[5m])",
        datasource: 'test-ds',
        start: 1600000000,
        end: 1600001000,
        step: 60
      });
    });
    
    it("should handle from/to parameters", async () => {
      const mockQueryResult = { series: [], status: "success" };
      
      mockQueryMetrics.mockResolvedValue(mockQueryResult);
      
      registerMetricsToolFn(mockServer as any);
      
      const toolHandler = mockServer.tool.mock.calls[0][3];
      const result = await toolHandler({ 
        queries: ["rate(http_requests_total[5m])"],
        datasource: 'test-ds',
        from: "now-1h",
        to: "now"
      });
      
      expect(mockQueryMetrics).toHaveBeenCalledWith({
        query: "rate(http_requests_total[5m])",
        datasource: 'test-ds',
        timeRange: {
          from: "now-1h",
          to: "now"
        }
      });
    });
    
    it("should handle datasource parameter", async () => {
      const mockQueryResult = { series: [], status: "success" };
      
      mockQueryMetrics.mockResolvedValue(mockQueryResult);
      
      registerMetricsToolFn(mockServer as any);
      
      const toolHandler = mockServer.tool.mock.calls[0][3];
      const result = await toolHandler({ 
        queries: ["rate(http_requests_total[5m])"],
        datasource: "prometheus"
      });
      
      expect(mockQueryMetrics).toHaveBeenCalledWith({
        query: "rate(http_requests_total[5m])",
        datasource: "prometheus"
      });
    });
    
    it("should handle errors", async () => {
      mockQueryMetrics.mockRejectedValue(new Error("Query failed"));
      
      registerMetricsToolFn(mockServer as any);
      
      const toolHandler = mockServer.tool.mock.calls[0][3];
      const result = await toolHandler({ queries: ["invalid query"], datasource: 'test-ds' });
      
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.successful).toHaveLength(0);
      expect(parsedResult.failed).toHaveLength(1);
      expect(parsedResult.failed[0]).toBe('Query failed');
    });
  });
});
