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
import {
  SqlQueryParams,
  SqlQueryResult
} from '../types/sql.types.js';

/**
 * Interfaz para el cliente de la API de Grafana
 */
export interface GrafanaClientInterface {
  searchDashboards(params?: DashboardSearchParams): Promise<DashboardSearchResult>;
  getDashboard(uid: string): Promise<DashboardDetailResult>;
  
  queryMetrics(params: MetricQueryParams): Promise<MetricQueryResult>;
  
  queryLogs(params: LogQueryParams): Promise<LogQueryResult>;

  querySql(params: SqlQueryParams): Promise<SqlQueryResult>;
  
  searchDataSources(params?: DataSourceSearchParams): Promise<DataSourceSearchResult>;
}
