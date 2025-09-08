export type BuildInfo = {
  number: number;
  url: string;
  result?: string;
  timestamp?: number;
  duration?: number;
};

export type CheckJobResponse = {
  status: string;
  job: string;
  build: BuildInfo;
  log_full: string;
};
