export interface JiraUser {
  self: string;
  accountId: string;
  emailAddress: string;
  avatarUrls: {
    [key: string]: string;
  };
  displayName: string;
  active: boolean;
  timeZone: string;
  accountType: string;
}

export interface JiraIssueFields {
  statusCategory?: {
    self: string;
    id: number;
    key: string;
    colorName: string;
    name: string;
  };
  lastViewed?: string;
  assignee?: JiraUser;
  reporter?: JiraUser;
  creator?: JiraUser;
  summary?: string;
  description?: string;
  status?: {
    self: string;
    description: string;
    iconUrl: string;
    name: string;
    id: string;
    statusCategory: {
      self: string;
      id: number;
      key: string;
      colorName: string;
      name: string;
    };
  };
  project?: {
    self: string;
    id: string;
    key: string;
    name: string;
    projectTypeKey: string;
    simplified: boolean;
    avatarUrls: {
      [key: string]: string;
    };
  };
  created?: string;
  updated?: string;
  [key: string]: any;
}

export interface JiraIssueResponse {
  fields: JiraIssueFields;
}
