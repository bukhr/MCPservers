export interface DataSourceSearchParams {
  name?: string;
  type?: string;
  id?: number;
  uid?: string;
}

export interface DataSource {
  id: number;
  uid: string;
  orgId: number;
  name: string;
  type: string;
  typeName: string;
  url: string;
  isDefault: boolean;
  access: string;
  basicAuth: boolean;
  readOnly: boolean;
  jsonData?: any;
}

export interface DataSourceSearchResult {
  datasources: DataSource[];
  total: number;
}
