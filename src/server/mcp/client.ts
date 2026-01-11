import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

/**
 * MCP Client for connecting to external knowledge sources
 *
 * This client can connect to MCP servers like source-diving-agent
 * to query analyzed codebases and patterns.
 */

export interface MCPServerConfig {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
}

export class MCPClient {
  private client: Client | null = null
  private transport: StdioClientTransport | null = null
  private config: MCPServerConfig

  constructor(config: MCPServerConfig) {
    this.config = config
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.client) {
      throw new Error('Already connected')
    }

    this.transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
      env: this.config.env,
      cwd: this.config.cwd,
      stderr: 'inherit',
    })

    this.client = new Client(
      { name: 'orchestrator-client', version: '1.0.0' },
      { capabilities: {} }
    )

    await this.client.connect(this.transport)
    console.log(`[MCPClient] Connected to ${this.config.name}`)
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
      this.transport = null
      console.log(`[MCPClient] Disconnected from ${this.config.name}`)
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client !== null
  }

  /**
   * List available tools on the server
   */
  async listTools(): Promise<Array<{ name: string; description?: string }>> {
    if (!this.client) {
      throw new Error('Not connected')
    }

    const result = await this.client.listTools()
    return result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
    }))
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<unknown> {
    if (!this.client) {
      throw new Error('Not connected')
    }

    const result = await this.client.callTool({
      name,
      arguments: args,
    })

    // Extract text content from result
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find((c) => c.type === 'text')
      if (textContent && 'text' in textContent) {
        return textContent.text
      }
    }

    return result
  }

  /**
   * List available resources on the server
   */
  async listResources(): Promise<Array<{ uri: string; name: string; description?: string }>> {
    if (!this.client) {
      throw new Error('Not connected')
    }

    const result = await this.client.listResources()
    return result.resources.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
    }))
  }

  /**
   * Read a resource from the server
   */
  async readResource(uri: string): Promise<string> {
    if (!this.client) {
      throw new Error('Not connected')
    }

    const result = await this.client.readResource({ uri })

    // Extract text content
    if (result.contents && result.contents.length > 0) {
      const content = result.contents[0]
      if ('text' in content) {
        return content.text
      }
    }

    return JSON.stringify(result)
  }
}

/**
 * MCP Client Manager
 *
 * Manages connections to multiple MCP servers
 */
export class MCPClientManager {
  private clients = new Map<string, MCPClient>()

  /**
   * Register an MCP server configuration
   */
  register(config: MCPServerConfig): void {
    if (this.clients.has(config.name)) {
      // Already registered, skip
      return
    }
    const client = new MCPClient(config)
    this.clients.set(config.name, client)
    console.log(`[MCPClientManager] Registered server: ${config.name}`)
  }

  /**
   * Connect to a registered server
   */
  async connect(name: string): Promise<void> {
    const client = this.clients.get(name)
    if (!client) {
      throw new Error(`Server ${name} not registered`)
    }
    await client.connect()
  }

  /**
   * Disconnect from a server
   */
  async disconnect(name: string): Promise<void> {
    const client = this.clients.get(name)
    if (client) {
      await client.disconnect()
    }
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    for (const client of this.clients.values()) {
      if (client.isConnected()) {
        await client.disconnect()
      }
    }
  }

  /**
   * Get a client by name
   */
  getClient(name: string): MCPClient | undefined {
    return this.clients.get(name)
  }

  /**
   * List registered servers
   */
  listServers(): Array<{ name: string; connected: boolean }> {
    return Array.from(this.clients.entries()).map(([name, client]) => ({
      name,
      connected: client.isConnected(),
    }))
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<unknown> {
    const client = this.clients.get(serverName)
    if (!client) {
      throw new Error(`Server ${serverName} not registered`)
    }
    if (!client.isConnected()) {
      await client.connect()
    }
    return client.callTool(toolName, args)
  }
}

// Singleton instance
export const mcpManager = new MCPClientManager()

// Pre-configured server definitions
export const KNOWN_SERVERS: Record<string, MCPServerConfig> = {
  'source-diving-agent': {
    name: 'source-diving-agent',
    command: 'bun',
    args: ['run', '/home/Ghoul/Projects/source-diving-agent/scripts/mcp-server.ts'],
  },
}
