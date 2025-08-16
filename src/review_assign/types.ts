// Interfaces para la configuración y datos
export interface TeamMember {
    name: string;
    email: string;
    nickname_github: string;
}

export interface Repository {
    name: string;
}

export interface TeamConfig {
    team_name: string;
    members: TeamMember[];
    repositories: string[];
    webhook_url?: string;
}

export interface Config {
    teams: TeamConfig[];
    reviewDays: number;
}
