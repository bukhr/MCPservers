import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getIssueSchema, getIssueHandler } from './tools/get-issue.js';
import { searchIssuesSchema, searchIssuesHandler } from './tools/search-issues.js';
import { createIssueSchema, createIssueHandler } from './tools/create-issue.js';
import { updateIssueSchema, updateIssueHandler } from './tools/update-issue.js';
import { searchUserSchema, searchUserHandler } from './tools/search-user.js';

const server = new McpServer({
    id: "jira_mcp",
    name: "Jira MCP",
    version: "1.0.0",
});

// Register tools
server.tool('get_issue', 'Get info about a Jira issue', getIssueSchema, async (args) => getIssueHandler(args));
server.tool('search_issues', 'Search Jira issues using JQL query', searchIssuesSchema, async (args) => searchIssuesHandler(args));
server.tool('create_issue', 'Create a new Jira issue', createIssueSchema, async (args) => createIssueHandler(args));
server.tool('update_issue', 'Update an existing Jira issue', updateIssueSchema, async (args) => updateIssueHandler(args));
server.tool('search_user', 'Search for a Jira user by email', searchUserSchema, async (args) => searchUserHandler(args));

const transport = new StdioServerTransport();
server.connect(transport);
