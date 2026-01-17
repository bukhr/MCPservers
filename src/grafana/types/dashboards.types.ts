export interface DashboardSearchParams {
  query?: string;
  tag?: string[];
  limit?: number;
  folderIds?: number[];
  starred?: boolean;
}

export interface DashboardSearchResult {
  dashboards: Array<{
    id: string | number;
    uid: string;
    title: string;
    url: string;
    tags: string[];
    folderTitle?: string;
    folderId?: number;
    folderUid?: string;
    isStarred: boolean;
  }>;
  total: number;
}

export interface DashboardDetailResult {
  dashboard: {
    id: number;
    uid: string;
    title: string;
    tags: string[];
    timezone: string;
    schemaVersion: number;
    version: number;
    panels: Array<{
      id: number;
      title: string;
      type: string;
      datasource?: {
        type: string;
        uid: string;
      };
    }>;
  };
  meta: {
    isStarred: boolean;
    url: string;
    folderId: number;
    folderUid: string;
    folderTitle: string;
    folderUrl: string;
    provisioned: boolean;
  };
}
