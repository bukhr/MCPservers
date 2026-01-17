export interface LogQueryParams {
  query: string;
  limit?: number;
  start?: number;
  end?: number;
  datasource?: string;
  timeRange?: {
    from: string;
    to: string;
  };
}

export interface LogEntry {
  timestamp: string;
  content: string;
  labels: Record<string, string>;
  level?: string;
  id?: string;
  dataSource?: string;
}

export interface LogQueryResult {
  data: any;
  status: 'success' | 'error';
  errorMessage?: string;
}
