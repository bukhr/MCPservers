import dotenv from 'dotenv';

dotenv.config();

export const JIRA_USERNAME = process.env.JIRA_USERNAME;
export const JIRA_API_KEY = process.env.JIRA_API_KEY;
export const JIRA_BASE_URL = process.env.JIRA_BASE_URL;

export const getAuthHeaders = () => ({
  'Authorization': `Basic ${Buffer.from(`${JIRA_USERNAME}:${JIRA_API_KEY}`).toString('base64')}`,
  'Accept': 'application/json',
  'Content-Type': 'application/json'
});
