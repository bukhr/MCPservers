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

jest.unstable_mockModule("../../config/settings.js", () => ({
  loadGrafanaConfig: mockLoadGrafanaConfig,
  loadLogConfig: mockLoadLogConfig,
  getLogDir: jest.fn().mockReturnValue("/var/log/grafana"),
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

let registerDataSourcesToolFn;
let GrafanaClientClass;

beforeAll(async () => {
  const datasourcesModule = await import("../../tools/datasources.js");
  const clientModule = await import("../../services/grafana-client.js");
  
  registerDataSourcesToolFn = datasourcesModule.registerDataSourcesTool;
  GrafanaClientClass = clientModule.GrafanaClient;
});

describe("DataSources Tool", () => {
  const mockServer = {
    tool: jest.fn()
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe("registerDataSourcesTool", () => {
    it("should register search_datasources tool", () => {
      registerDataSourcesToolFn(mockServer as any);
      
      expect(mockServer.tool).toHaveBeenCalledWith(
        "search_datasources",
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });
  });
  
  describe("search_datasources handler", () => {
    it("should process datasource search with no parameters", async () => {
      const mockSearchResult = {
        datasources: [
          {
            id: 1,
            uid: "prometheus",
            name: "Prometheus",
            type: "prometheus"
          },
          {
            id: 2,
            uid: "loki",
            name: "Loki",
            type: "loki"
          }
        ],
        total: 2
      };
      
      mockSearchDataSources.mockResolvedValue(mockSearchResult);
      
      registerDataSourcesToolFn(mockServer as any);
      
      const toolHandler = mockServer.tool.mock.calls[0][3];
      const result = await toolHandler({});
      
      expect(GrafanaClientClass).toHaveBeenCalledWith({
        baseUrl: "https://grafana.example.com",
        apiKey: "mock-api-key",
        orgId: 1
      });
      expect(mockSearchDataSources).toHaveBeenCalledWith(undefined);
      expect(result.content[0].text).toContain("Prometheus");
      expect(result.content[0].text).toContain("Loki");
    });
    
    it("should process datasource search with type filter", async () => {
      const mockSearchResult = {
        datasources: [
          {
            id: 1,
            uid: "prometheus",
            name: "Prometheus",
            type: "prometheus"
          }
        ],
        total: 1
      };
      
      mockSearchDataSources.mockResolvedValue(mockSearchResult);
      
      registerDataSourcesToolFn(mockServer as any);
      
      const toolHandler = mockServer.tool.mock.calls[0][3];
      const result = await toolHandler({ type: "prometheus" });
      
      expect(mockSearchDataSources).toHaveBeenCalledWith(
        { type: "prometheus" }
      );
      expect(result.content[0].text).toContain("Prometheus");
    });
    
    it("should process datasource search with name filter", async () => {
      const mockSearchResult = {
        datasources: [
          {
            id: 2,
            uid: "loki",
            name: "Loki",
            type: "loki"
          }
        ],
        total: 1
      };
      
      mockSearchDataSources.mockResolvedValue(mockSearchResult);
      
      registerDataSourcesToolFn(mockServer as any);
      
      const toolHandler = mockServer.tool.mock.calls[0][3];
      const result = await toolHandler({ name: "Loki" });
      
      expect(mockSearchDataSources).toHaveBeenCalledWith(
        { name: "Loki" }
      );
      expect(result.content[0].text).toContain("Loki");
    });
    
    it("should handle errors", async () => {
      mockSearchDataSources.mockRejectedValue(new Error("Search failed"));
      
      registerDataSourcesToolFn(mockServer as any);
      
      const toolHandler = mockServer.tool.mock.calls[0][3];
      const result = await toolHandler({ type: "invalid" });
      
      expect(result.content[0].text).toContain("Search failed");
    });
  });
});
