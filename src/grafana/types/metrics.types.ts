// Tipos específicos para las operaciones de Métricas

export interface MetricQueryParams {
  query: string;
  start?: number; // Unix timestamp en segundos
  end?: number;   // Unix timestamp en segundos
  step?: number;  // Intervalo en segundos
  datasource?: string; // UID o nombre de la fuente de datos
  timeRange?: {
    from: string; // Formato relativo como "now-1h" o timestamp ISO
    to: string;   // Formato relativo como "now" o timestamp ISO
  };
}

export interface MetricDataPoint {
  timestamp: number;
  value: number | null;
}

export interface MetricSeries {
  metric: Record<string, string>;
  datapoints: MetricDataPoint[];
}

export interface MetricQueryResult {
  data: any;
  status: 'success' | 'error';
  errorType?: string;
  errorMessage?: string;
  executedQueryString?: string;
}
