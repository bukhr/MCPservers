import { z } from 'zod';
import { getAuthHeaders, JIRA_BASE_URL } from '../config.js';
import { cleanFields } from '../utils.js';

export const getIssueSchema = {
  issue_key: z.string().describe('Jira issue key')
};

export const getIssueHandler = async ({ issue_key }: { issue_key: string }) => {
  const response = await fetch(`${JIRA_BASE_URL}/rest/agile/1.0/issue/${issue_key}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });

  const data = await response.json();
  const filteredData = cleanFields(data);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(filteredData, null, 2) }]
  };
};
