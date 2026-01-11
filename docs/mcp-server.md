# Source Dive MCP Server

An MCP (Model Context Protocol) server that exposes the Source Dive knowledge base to AI agents like Claude Code.

> **In-App Documentation:** Visit `/mcp` in the Source Dive web app for interactive documentation with copy-paste configuration snippets.

## Setup

### 1. Add to Claude Code settings

Add to `~/.claude.json` (global) or `.claude/settings.json` (project):

```json
{
  "mcpServers": {
    "source-dive": {
      "command": "bun",
      "args": ["run", "/path/to/source-dive/scripts/mcp-server.ts"]
    }
  }
}
```

Replace `/path/to/source-dive` with the actual path to your Source Dive installation.

### 2. Reconnect MCP servers

Run `/mcp` in Claude Code to reconnect and load the new server.

### 3. Verify connection

The server should appear in the MCP tools list. You can test with:
```
search the source dive knowledge base for "authentication"
```

## Available Tools

### search_knowledge_base

Search documents using BM25 full-text search with operator support. Falls back to ILIKE pattern matching if BM25 indexes are unavailable.

**Parameters:**
- `query` (string, required): Search query with optional operators
- `limit` (number, optional): Max results 1-50, default 10

**Operators:**
| Operator | Example | Description |
|----------|---------|-------------|
| `repo:` | `repo:tanstack` | Filter by repository name |
| `tag:` | `tag:security` | Filter by tag |
| `type:` | `type:architecture` | Filter by document type |
| `project:` | `project:myapp` | Filter by project |
| `"phrase"` | `"useEffect hook"` | Exact phrase match |
| `-exclude` | `auth -oauth` | Exclude term |

**Example:**
```
search_knowledge_base({ query: "authentication flow project:fuzzy" })
```

**Returns:**
```json
{
  "query": "authentication flow project:fuzzy",
  "resultCount": 3,
  "results": [
    {
      "id": "uuid",
      "title": "Authentication Architecture",
      "project": "Fuzzy",
      "type": "architecture",
      "slug": "authentication-architecture",
      "tags": ["auth", "security"],
      "snippet": "...relevant excerpt...",
      "path": "/projects/uuid/documents/authentication-architecture"
    }
  ]
}
```

### get_document

Retrieve full content of a document.

**Parameters (one of):**
- `id` (string): Document UUID
- `projectId` + `slug`: Project UUID and document slug

**Example:**
```
get_document({ id: "abc-123" })
get_document({ projectId: "proj-456", slug: "auth-flow" })
```

**Returns:**
```json
{
  "id": "abc-123",
  "title": "Authentication Flow",
  "project": "My Project",
  "projectId": "proj-456",
  "type": "architecture",
  "slug": "auth-flow",
  "tags": ["auth", "security"],
  "content": "Full document content as plain text...",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T00:00:00Z"
}
```

### list_collections

List all collections with document counts.

**Parameters:** None

**Example:**
```
list_collections({})
```

**Returns:**
```json
{
  "count": 5,
  "collections": [
    {
      "id": "uuid",
      "name": "Auth Patterns",
      "slug": "auth-patterns",
      "description": "Authentication implementation patterns",
      "icon": "🔐",
      "documentCount": 12,
      "isPinned": true
    }
  ]
}
```

### get_collection_documents

Get all documents in a specific collection.

**Parameters:**
- `slug` (string, required): Collection slug

**Example:**
```
get_collection_documents({ slug: "auth-patterns" })
```

**Returns:**
```json
{
  "collection": {
    "id": "uuid",
    "name": "Auth Patterns",
    "description": "Authentication implementation patterns",
    "icon": "🔐"
  },
  "documentCount": 12,
  "documents": [
    {
      "id": "doc-uuid",
      "title": "JWT Implementation",
      "project": "My Project",
      "type": "architecture",
      "slug": "jwt-implementation",
      "addedAt": "2024-01-10T00:00:00Z"
    }
  ]
}
```

### list_projects

List all projects in the knowledge base.

**Parameters:** None

**Example:**
```
list_projects({})
```

**Returns:**
```json
{
  "count": 8,
  "projects": [
    {
      "id": "uuid",
      "name": "TanStack Router",
      "description": "Type-safe routing for React",
      "documentCount": 15,
      "repoCount": 1,
      "tags": ["react", "routing"],
      "metadata": {}
    }
  ]
}
```

### get_project_summary

Get detailed summary of a project including repos and documents.

**Parameters:**
- `id` (string, required): Project UUID

**Example:**
```
get_project_summary({ id: "proj-456" })
```

**Returns:**
```json
{
  "project": {
    "id": "proj-456",
    "name": "TanStack Router",
    "description": "Type-safe routing for React",
    "agentContext": "Custom system prompt for this project",
    "metadata": {},
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T00:00:00Z"
  },
  "repos": [
    {
      "id": "repo-uuid",
      "name": "tanstack/router",
      "url": "https://github.com/tanstack/router",
      "stack": ["typescript", "react"],
      "status": "cloned"
    }
  ],
  "documents": [
    {
      "id": "doc-uuid",
      "title": "Route Configuration",
      "type": "architecture",
      "slug": "route-configuration",
      "tags": ["routing", "config"]
    }
  ],
  "summary": {
    "repoCount": 1,
    "documentCount": 15
  }
}
```

## Usage Examples

### Find implementation patterns

```
User: "How does the tanstack router handle nested routes?"

Agent uses: search_knowledge_base({
  query: "nested routes project:tanstack"
})
```

### Get specific document

```
User: "Show me the full auth flow document from the fuzzy project"

Agent uses:
1. search_knowledge_base({ query: "auth flow project:fuzzy" })
2. get_document({ id: "result-id-from-search" })
```

### Browse a collection

```
User: "What auth patterns do I have documented?"

Agent uses:
1. list_collections({})
2. get_collection_documents({ slug: "auth-patterns" })
```

### Project overview

```
User: "Give me an overview of my TanStack Router analysis"

Agent uses:
1. list_projects({})
2. get_project_summary({ id: "tanstack-project-id" })
```

## Troubleshooting

### Server not appearing in Claude Code

1. Verify the path in settings is correct
2. Run `/mcp` to reconnect
3. Check that bun is in your PATH

### Database connection errors

The MCP server uses the same database as the main app. Ensure:
1. PostgreSQL is running
2. The connection string in `src/server/db/index.ts` is correct
3. Database has been migrated (`bunx drizzle-kit push`)

### Search returning no results

1. Verify documents exist in the database
2. Check if BM25 indexes are created (run `drizzle/0003_bm25_search_indexes.sql`)
3. Try a broader search query without operators

## Technical Details

### Search Implementation

The `search_knowledge_base` tool uses a two-tier search strategy:

1. **Primary: BM25 Search** - Uses PostgreSQL's `pg_textsearch` extension with the `<@>` operator and `to_bm25query()` function for relevance-ranked results
2. **Fallback: ILIKE Search** - If BM25 fails (extension not installed or indexes missing), falls back to case-insensitive pattern matching

### Requirements

- **Runtime**: Bun
- **Database**: PostgreSQL with `pg_textsearch` extension (for BM25)
- **Indexes**: Run `drizzle/0003_bm25_search_indexes.sql` to create BM25 indexes

### Dependencies

The MCP server uses `@modelcontextprotocol/sdk` for the MCP protocol implementation with stdio transport.
