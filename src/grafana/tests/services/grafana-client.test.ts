// @ts-nocheck
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import axios from 'axios';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockAxiosInstance = { 
  get: mockGet, 
  post: mockPost,
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() }
  }
};
const mockCreate = jest.fn().mockReturnValue(mockAxiosInstance);

const mockErrorLogger = jest.fn();
jest.unstable_mockModule('../../utils/logger.js', () => ({
  createLogger: () => ({
    error: mockErrorLogger,
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
mockedAxios.create = mockCreate;

let grafanaClientModule: typeof import('../../services/grafana-client.js');

beforeAll(async () => {
  grafanaClientModule = await import('../../services/grafana-client.js');
});

describe('GrafanaClient', () => {
  const mockConfig = {
    baseUrl: 'https://grafana.example.com',
    apiKey: 'mock-api-key',
    orgId: 1
  };
  
  let client: GrafanaClient;
  
  beforeEach(() => {
    jest.clearAllMocks();
    client = new grafanaClientModule.GrafanaClient(mockConfig);
  });
  
  describe('searchDashboards', () => {
    it('should return dashboard search results', async () => {
      const mockResponse = {
        data: [
          { id: 1, uid: 'abc123', title: 'Test Dashboard', tags: ['test'] }
        ]
      };
      
      (client as any).client.get.mockResolvedValue(mockResponse);
      
      const result = await client.searchDashboards({ query: 'test' });
      
      expect(mockGet).toHaveBeenCalledWith('/api/search', { params: { query: 'test' } });
      expect(result.dashboards).toHaveLength(1);
      expect(result.dashboards[0].id).toBe(1);
      expect(result.dashboards[0].title).toBe('Test Dashboard');
      expect(result.total).toBe(1);
    });
    
    it('should handle errors correctly', async () => {
      mockGet.mockRejectedValue(new Error('API error'));
      
      await expect(client.searchDashboards()).rejects.toThrow('Error searching dashboards: API error');
    });
  });
  
  describe('getDashboard', () => {
    it('should return dashboard details', async () => {
      const mockResponse = {
        data: {
          dashboard: { id: 1, title: 'Test Dashboard' },
          meta: { isStarred: true }
        }
      };
      
      (client as any).client.get.mockResolvedValue(mockResponse);
      
      const result = await client.getDashboard('abc123');
      
      expect(mockGet).toHaveBeenCalledWith('/api/dashboards/uid/abc123');
      expect(result).toEqual(mockResponse.data);
    });
  });
  
  describe('queryMetrics', () => {
    it('should return metric query results', async () => {
      const mockResponse = {
        data: {
          data: {
            result: [
              { metric: { instance: 'test' }, values: [[1600000000, '42.5']] }
            ]
          }
        }
      };
      
      (client as any).client.post.mockResolvedValue(mockResponse);
      
      const result = await client.queryMetrics({ query: 'test_metric', datasource: 'test_ds' });
      
      expect(mockPost).toHaveBeenCalledWith('/api/ds/query', expect.objectContaining({
        queries: expect.arrayContaining([expect.objectContaining({ expr: 'test_metric' })])
      }));
      expect(result.data).toBeDefined();
      expect(result.status).toBe('success');
    });
  });
  
  describe('queryLogs', () => {
    it('should return log query results', async () => {
      const mockResponse = {
        data: {
          data: {
            result: [
              { stream: { level: 'error' }, values: [[1600000000, 'Error message']] }
            ]
          }
        }
      };
      
      (client as any).client.post.mockResolvedValue(mockResponse);
      
      const result = await client.queryLogs({ query: '{level="error"}', datasource: 'test_ds' });
      
      expect(mockPost).toHaveBeenCalledWith('/api/ds/query', expect.objectContaining({
        queries: expect.arrayContaining([expect.objectContaining({ expr: '{level="error"}' })])
      }));
      expect(result.data).toBeDefined();
      expect(result.status).toBe('success');
    });
  });
  
  describe('searchDataSources', () => {
    it('should return all datasources when no filter is provided', async () => {
      const mockDatasources = [
        { id: 1, uid: 'ds1', name: 'Prometheus', type: 'prometheus' },
        { id: 2, uid: 'ds2', name: 'Loki', type: 'loki' }
      ];
      
      (client as any).client.get.mockResolvedValue({ data: mockDatasources });
      
      const result = await client.searchDataSources();
      
      expect(mockGet).toHaveBeenCalledWith('/api/datasources');
      expect(result.datasources).toEqual(mockDatasources);
      expect(result.total).toBe(2);
    });
    
    it('should filter datasources by type', async () => {
      const mockDatasources = [
        { id: 1, uid: 'ds1', name: 'Prometheus', type: 'prometheus' },
        { id: 2, uid: 'ds2', name: 'Loki', type: 'loki' }
      ];
      
      (client as any).client.get.mockResolvedValue({ data: mockDatasources });
      
      const result = await client.searchDataSources({ type: 'prometheus' });
      
      expect(result.datasources).toHaveLength(1);
      expect(result.datasources[0].name).toBe('Prometheus');
    });
    
    it('should filter datasources by name', async () => {
      const mockDatasources = [
        { id: 1, uid: 'ds1', name: 'Prometheus', type: 'prometheus' },
        { id: 2, uid: 'ds2', name: 'Prometheus Staging', type: 'prometheus' }
      ];
      
      (client as any).client.get.mockResolvedValue({ data: mockDatasources });
      
      const result = await client.searchDataSources({ name: 'Staging' });
      
      expect(result.datasources).toHaveLength(1);
      expect(result.datasources[0].name).toBe('Prometheus Staging');
    });
    
    it('should filter datasources by uid', async () => {
      const mockDatasources = [
        { id: 1, uid: 'ds1', name: 'Prometheus', type: 'prometheus' },
        { id: 2, uid: 'ds2', name: 'Loki', type: 'loki' }
      ];
      
      (client as any).client.get.mockResolvedValue({ data: mockDatasources });
      
      const result = await client.searchDataSources({ uid: 'ds1' });
      
      expect(result.datasources).toHaveLength(1);
      expect(result.datasources[0].uid).toBe('ds1');
    });
  });

  describe('querySql', () => {
    it('should return SQL query results', async () => {
      const mockResponse = {
        data: {
          results: {
            A: {
              frames: []
            }
          }
        }
      };
      
      (client as any).client.post.mockResolvedValue(mockResponse);
      
      const result = await client.querySql({ query: 'SELECT 1', datasource: 'test_ds' });
      
      expect(mockPost).toHaveBeenCalledWith('/api/ds/query', expect.objectContaining({
        queries: expect.arrayContaining([expect.objectContaining({ rawSql: 'SELECT 1', format: 'table' })])
      }));
      expect(result.data).toBeDefined();
      expect(result.status).toBe('success');
    });
  });
});
