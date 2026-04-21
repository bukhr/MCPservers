export interface SqlQueryParams {
  query: string;
  datasource: string; // UID o nombre de la fuente de datos
  timeRange?: {
    from: string; // Formato relativo como "now-1h" o timestamp ISO
    to: string;   // Formato relativo como "now" o timestamp ISO
  };
}

export interface SqlQueryResult {
  data: any;
  status: 'success' | 'error';
  errorMessage?: string;
  errorType?: string;
  executedQueryString?: string;
}
