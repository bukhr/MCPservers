import axios, { AxiosInstance } from 'axios';
import { GrafanaConfig } from '../types/index.js';
import {
  DashboardSearchParams,
  DashboardSearchResult,
  DashboardDetailResult
} from '../types/dashboards.types.js';
import {
  MetricQueryParams,
  MetricQueryResult
} from '../types/metrics.types.js';
import {
  LogQueryParams,
  LogQueryResult
} from '../types/logs.types.js';
import {
  DataSourceSearchParams,
  DataSourceSearchResult
} from '../types/datasources.types.js';
import { SqlQueryParams, SqlQueryResult } from '../types/sql.types.js';
import { createLogger } from '../utils/logger.js';

const clientLogger = createLogger('grafana_client');

/**
 * Cliente para comunicarse con la API de Grafana
 */
export class GrafanaClient {
  private client: AxiosInstance;
  private config: GrafanaConfig;

  constructor(config: GrafanaConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...(config.orgId ? { 'X-Grafana-Org-Id': `${config.orgId}` } : {})
      },
      timeout: 30000
    });

    this.client.interceptors.request.use((request) => {
      clientLogger.debug(`Sending request to ${request.url}`, {
        method: request.method,
        url: request.url
      });
      return request;
    });

    this.client.interceptors.response.use(
      (response) => {
        clientLogger.debug(`Received response from ${response.config.url}`, {
          status: response.status,
          response: response.data
        });
        return response;
      },
      (error) => {
        if (error.response) {
          clientLogger.error(`API error: ${error.message}`, {
            status: error.response.status,
            data: error.response.data
          });
        } else {
          clientLogger.error(`Request error: ${error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }

  private async executeQuery(params: MetricQueryParams | LogQueryParams | SqlQueryParams, additionalParams: Record<string, any>) {
    if (!params.datasource) {
      throw new Error('El parámetro datasource es obligatorio.');
    }

    const query = {
      datasource: {
        uid: params.datasource
      },
      refId: 'A',
      ...additionalParams
    };

    if (additionalParams.format === 'table') {
      Object.assign(query, { rawSql: params.query });
    } else {
      Object.assign(query, { expr: params.query });
    }

    const queryParams = {
      from: params.timeRange?.from || ('start' in params && params.start ? `${params.start * 1000}` : 'now-1h'),
      to: params.timeRange?.to || ('end' in params && params.end ? `${params.end * 1000}` : 'now'),
      queries: [query]
    };

    clientLogger.debug('Executing Grafana query with params:', { queryParams });

    return this.client.post('/api/ds/query', queryParams);
  }

  async searchDashboards(params?: DashboardSearchParams): Promise<DashboardSearchResult> {
    try {
      const response = await this.client.get('/api/search', { params });
      
      const dashboards = response.data.map((dashboard: any) => ({
        id: dashboard.id,
        uid: dashboard.uid,
        title: dashboard.title,
        url: `${this.config.baseUrl}/d/${dashboard.uid}`,
        tags: dashboard.tags || [],
        folderTitle: dashboard.folderTitle,
        folderId: dashboard.folderId,
        folderUid: dashboard.folderUid,
        isStarred: dashboard.isStarred || false
      }));
      
      return {
        dashboards,
        total: dashboards.length
      };
    } catch (error: any) {
      throw new Error(`Error searching dashboards: ${error.message}`);
    }
  }

  async getDashboard(uid: string): Promise<DashboardDetailResult> {
    try {
      const response = await this.client.get(`/api/dashboards/uid/${uid}`);
      return response.data as DashboardDetailResult;
    } catch (error: any) {
      throw new Error(`Error getting dashboard ${uid}: ${error.message}`);
    }
  }

  async queryMetrics(params: MetricQueryParams): Promise<MetricQueryResult> {
    try {
      const additionalParams: Record<string, any> = {};

      if (params.step) {
        additionalParams.interval = `${params.step}s`;
      }
      
      const response = await this.executeQuery(params, additionalParams);
      
      return {
        data: response.data,
        status: 'success',
        executedQueryString: params.query
      };
    } catch (error: any) {
      return {
        data: [],
        status: 'error',
        errorType: 'query_failed',
        errorMessage: error.message
      };
    }
  }

  async queryLogs(params: LogQueryParams): Promise<LogQueryResult> {
    try {
      const additionalParams: Record<string, any> = {};
      
      if (params.limit) {
        additionalParams.limit = params.limit;
      }

      const response = await this.executeQuery(params, additionalParams);
      
      return {
        data: response.data,
        status: 'success'
      };
    } catch (error: any) {
      return {
        data: [],
        status: 'error',
        errorMessage: error.message
      };
    }
  }

  async querySql(params: SqlQueryParams): Promise<SqlQueryResult> {
    try {
      const response = await this.executeQuery(params, { format: 'table', queryType: "sql" });
      
      return {
        data: response.data,
        status: 'success',
        executedQueryString: params.query
      };
    } catch (error: any) {
      return {
        data: [],
        status: 'error',
        errorType: 'query_failed',
        errorMessage: error.message
      };
    }
  }
  
  /**
   * Busca fuentes de datos (datasources) en Grafana
   * @param params Parámetros de búsqueda
   * @returns Resultado de la búsqueda
   */
  async searchDataSources(params?: DataSourceSearchParams): Promise<DataSourceSearchResult> {
    try {
      const response = await this.client.get('/api/datasources');
      
      let datasources = response.data;
      
      if (params) {
        if (params.uid) {
          datasources = datasources.filter((ds: any) => ds.uid === params.uid);
        }
        if (params.name) {
          const nameLower = params.name.toLowerCase();
          datasources = datasources.filter((ds: any) => 
            ds.name.toLowerCase().includes(nameLower));
        }
        if (params.type) {
          const typeLower = params.type.toLowerCase();
          datasources = datasources.filter((ds: any) => 
            ds.type.toLowerCase().includes(typeLower));
        }
        if (params.id !== undefined) {
          datasources = datasources.filter((ds: any) => ds.id === params.id);
        }
      }
      
      return {
        datasources,
        total: datasources.length
      };
    } catch (error: any) {
      throw new Error(`Error searching datasources: ${error.message}`);
    }
  }
}
