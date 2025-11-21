// Interfaces para la configuración y datos
export interface TeamMember {
    name: string;
    email: string;
    nickname_github: string;
    workloadFactor?: number; // 1.0 = normal, < 1.0 = menos disponibilidad (ej: 0.5 = 50% de la carga normal)
}

export interface Repository {
    name: string;
}

export interface TeamConfig {
    team_name: string;
    team_slug?: string;
    org?: string;
    members: TeamMember[];
    repositories: string[];
    webhook_url?: string;
    exclude_members_by_nickname?: string[];
}

export interface Config {
    teams: TeamConfig[];
    reviewDays: number;
    auto_detect_members_from_github?: boolean;
}

export interface LogConfig {
    enableFileLogs: boolean;
    logLevel: string;
    logDir?: string;
}

export interface ReviewerStats {
    member: TeamMember;
    reviewCount: number;
    pendingReviewCount: number;
    normalizedCount: number;
}

export interface ReviewerSelection {
    selectedReviewer: TeamMember;
    reviewerStats: ReviewerStats[];
}
export interface PullRequestInfo {
    title: string;
    url: string;
    author: { login: string };
}

export interface ReviewedPR {
    number: number;
    repository: { name: string, nameWithOwner: string };
    url: string;
    title: string;
}

export interface PendingReviewPR {
    number: number;
    repository: { name: string, nameWithOwner: string };
    url: string;
    title: string;
    requestedReviewers?: { login: string }[];
}

export interface LastReviewer {
    repository: string;
    nickname_github: string;
    assignedAt: number;
}
