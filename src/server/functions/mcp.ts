import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { mcpManager, KNOWN_SERVERS, type MCPServerConfig } from '~/server/mcp/client'

// =============================================================================
// SCHEMAS
// =============================================================================

const ServerNameSchema = z.object({
  serverName: z.string(),
})

const RegisterServerSchema = z.object({
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
})

const CallToolSchema = z.object({
  serverName: z.string(),
  toolName: z.string(),
  args: z.record(z.string(), z.any()).optional(),
})

const ReadResourceSchema = z.object({
  serverName: z.string(),
  uri: z.string(),
})

// =============================================================================
// SERVER FUNCTIONS
// =============================================================================

/**
 * List all known MCP servers
 */
export const listKnownServers = createServerFn({ method: 'POST' })
  .inputValidator(z.void())
  .handler(async () => {
    return Object.entries(KNOWN_SERVERS).map(([key, config]) => ({
      key,
      name: config.name,
      command: config.command,
      args: config.args,
    }))
  })

/**
 * List registered MCP servers and their connection status
 */
export const listMCPServers = createServerFn({ method: 'POST' })
  .inputValidator(z.void())
  .handler(async () => {
    return mcpManager.listServers()
  })

/**
 * Register a new MCP server
 */
export const registerMCPServer = createServerFn({ method: 'POST' })
  .inputValidator(RegisterServerSchema)
  .handler(async ({ data }) => {
    const config: MCPServerConfig = {
      name: data.name,
      command: data.command,
      args: data.args,
      env: data.env,
    }
    mcpManager.register(config)
    return { success: true, name: data.name }
  })

/**
 * Register a known server by key
 */
export const registerKnownServer = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ key: z.string() }))
  .handler(async ({ data }) => {
    const config = KNOWN_SERVERS[data.key]
    if (!config) {
      throw new Error(`Unknown server: ${data.key}`)
    }
    mcpManager.register(config)
    return { success: true, name: config.name }
  })

/**
 * Connect to an MCP server
 */
export const connectMCPServer = createServerFn({ method: 'POST' })
  .inputValidator(ServerNameSchema)
  .handler(async ({ data }) => {
    await mcpManager.connect(data.serverName)
    return { success: true }
  })

/**
 * Disconnect from an MCP server
 */
export const disconnectMCPServer = createServerFn({ method: 'POST' })
  .inputValidator(ServerNameSchema)
  .handler(async ({ data }) => {
    await mcpManager.disconnect(data.serverName)
    return { success: true }
  })

/**
 * List tools available on a server
 */
export const listMCPTools = createServerFn({ method: 'POST' })
  .inputValidator(ServerNameSchema)
  .handler(async ({ data }) => {
    const client = mcpManager.getClient(data.serverName)
    if (!client) {
      throw new Error(`Server ${data.serverName} not registered`)
    }
    if (!client.isConnected()) {
      await client.connect()
    }
    return client.listTools()
  })

/**
 * Call a tool on an MCP server
 */
export const callMCPTool = createServerFn({ method: 'POST' })
  .inputValidator(CallToolSchema)
  .handler(async ({ data }) => {
    const result = await mcpManager.callTool(
      data.serverName,
      data.toolName,
      data.args ?? {}
    )
    // Serialize result to ensure it's JSON-safe
    const serialized = typeof result === 'string' ? result : JSON.stringify(result)
    return { result: serialized }
  })

/**
 * List resources available on a server
 */
export const listMCPResources = createServerFn({ method: 'POST' })
  .inputValidator(ServerNameSchema)
  .handler(async ({ data }) => {
    const client = mcpManager.getClient(data.serverName)
    if (!client) {
      throw new Error(`Server ${data.serverName} not registered`)
    }
    if (!client.isConnected()) {
      await client.connect()
    }
    return client.listResources()
  })

/**
 * Read a resource from an MCP server
 */
export const readMCPResource = createServerFn({ method: 'POST' })
  .inputValidator(ReadResourceSchema)
  .handler(async ({ data }) => {
    const client = mcpManager.getClient(data.serverName)
    if (!client) {
      throw new Error(`Server ${data.serverName} not registered`)
    }
    if (!client.isConnected()) {
      await client.connect()
    }
    const content = await client.readResource(data.uri)
    return { content }
  })

/**
 * Query source-diving-agent for knowledge
 * Convenience function for the most common use case
 */
export const queryKnowledgeBase = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    query: z.string(),
    repository: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const serverName = 'source-diving-agent'

    // Ensure server is registered and connected
    if (!mcpManager.getClient(serverName)) {
      const config = KNOWN_SERVERS[serverName]
      if (!config) {
        throw new Error('source-diving-agent server not configured')
      }
      mcpManager.register(config)
    }

    const client = mcpManager.getClient(serverName)!
    if (!client.isConnected()) {
      await client.connect()
    }

    // Call the search tool
    const result = await client.callTool('search_knowledge', {
      query: data.query,
      repository: data.repository,
    })

    // Serialize result to ensure it's JSON-safe
    const serialized = typeof result === 'string' ? result : JSON.stringify(result)
    return { result: serialized }
  })
