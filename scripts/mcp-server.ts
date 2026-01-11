#!/usr/bin/env bun
/**
 * MCP Server for Orchestrator
 *
 * Exposes Orchestrator tools to AI agents via Model Context Protocol.
 *
 * Tools:
 * - list_projects: List all projects
 * - get_project: Get project with tasks and repos
 * - list_tasks: List tasks with filters
 * - get_task: Get task details with subtasks
 * - create_task: Create new task
 * - update_task_status: Update task status
 * - add_task_update: Add progress update to task
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

import * as projectsDb from '../src/server/db/projects'
import * as tasksDb from '../src/server/db/tasks'

// Tool input schemas
const ListProjectsSchema = z.object({
  includeArchived: z.boolean().optional().default(false),
})

const GetProjectSchema = z.object({
  id: z.string().uuid(),
})

const ListTasksSchema = z.object({
  projectId: z.string().uuid().optional(),
  status: z
    .enum(['pending', 'in_progress', 'blocked', 'completed', 'cancelled'])
    .optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  includeArchived: z.boolean().optional().default(false),
  limit: z.number().min(1).max(100).optional().default(50),
})

const GetTaskSchema = z.object({
  id: z.string().uuid(),
})

const CreateTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z
    .enum(['pending', 'in_progress', 'blocked', 'completed', 'cancelled'])
    .optional()
    .default('pending'),
  priority: z
    .enum(['low', 'medium', 'high', 'urgent'])
    .optional()
    .default('medium'),
  effort: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).optional(),
  parentId: z.string().uuid().nullable().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  assignee: z.string().optional(),
})

const UpdateTaskStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'in_progress', 'blocked', 'completed', 'cancelled']),
})

const AddTaskUpdateSchema = z.object({
  taskId: z.string().uuid(),
  content: z.string().min(1),
  updateType: z
    .enum(['progress', 'blocker', 'question', 'completion'])
    .optional()
    .default('progress'),
  author: z.string().optional(),
})

// Create MCP server
const server = new Server(
  {
    name: 'orchestrator',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_projects',
        description:
          'List all projects in Orchestrator. Returns project names, descriptions, and IDs.',
        inputSchema: {
          type: 'object',
          properties: {
            includeArchived: {
              type: 'boolean',
              description: 'Include archived projects (default: false)',
            },
          },
        },
      },
      {
        name: 'get_project',
        description:
          'Get detailed information about a specific project, including its tasks and repositories.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Project UUID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'list_tasks',
        description:
          'List tasks with optional filters. Can filter by project, status, and priority.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Filter by project UUID',
            },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'blocked', 'completed', 'cancelled'],
              description: 'Filter by task status',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              description: 'Filter by task priority',
            },
            includeArchived: {
              type: 'boolean',
              description: 'Include archived tasks (default: false)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of tasks to return (default: 50, max: 100)',
            },
          },
        },
      },
      {
        name: 'get_task',
        description:
          'Get detailed information about a specific task, including subtasks and updates.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Task UUID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'create_task',
        description:
          'Create a new task in a project. Can specify title, description, priority, effort, and acceptance criteria.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project UUID to create the task in',
            },
            title: {
              type: 'string',
              description: 'Task title (required, max 500 chars)',
            },
            description: {
              type: 'string',
              description: 'Task description',
            },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'blocked', 'completed', 'cancelled'],
              description: 'Initial status (default: pending)',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              description: 'Task priority (default: medium)',
            },
            effort: {
              type: 'string',
              enum: ['xs', 'sm', 'md', 'lg', 'xl'],
              description: 'Effort estimation',
            },
            parentId: {
              type: 'string',
              description: 'Parent task UUID for subtasks',
              nullable: true,
            },
            acceptanceCriteria: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of acceptance criteria',
            },
            assignee: {
              type: 'string',
              description: 'Assignee name or email',
            },
          },
          required: ['projectId', 'title'],
        },
      },
      {
        name: 'update_task_status',
        description:
          'Update the status of a task. Use this to move tasks through the workflow.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Task UUID',
            },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'blocked', 'completed', 'cancelled'],
              description: 'New status',
            },
          },
          required: ['id', 'status'],
        },
      },
      {
        name: 'add_task_update',
        description:
          'Add a progress update or note to a task. Use this to log progress, blockers, or questions.',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Task UUID',
            },
            content: {
              type: 'string',
              description: 'Update content',
            },
            updateType: {
              type: 'string',
              enum: ['progress', 'blocker', 'question', 'completion'],
              description: 'Type of update (default: progress)',
            },
            author: {
              type: 'string',
              description: 'Author of the update',
            },
          },
          required: ['taskId', 'content'],
        },
      },
    ],
  }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'list_projects': {
        const input = ListProjectsSchema.parse(args)
        const allProjects = await projectsDb.listProjects()
        const filtered = input.includeArchived
          ? allProjects
          : allProjects.filter((p) => !p.isArchived)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                filtered.map((p) => ({
                  id: p.id,
                  name: p.name,
                  description: p.description,
                  isArchived: p.isArchived,
                  createdAt: p.createdAt,
                })),
                null,
                2
              ),
            },
          ],
        }
      }

      case 'get_project': {
        const input = GetProjectSchema.parse(args)
        const project = await projectsDb.getProjectById(input.id)

        if (!project) {
          return {
            content: [{ type: 'text', text: `Project ${input.id} not found` }],
            isError: true,
          }
        }

        // Get project tasks
        const tasks = await tasksDb.listTasks({ projectId: input.id })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ...project,
                  tasks: tasks.map((t) => ({
                    id: t.id,
                    title: t.title,
                    status: t.status,
                    priority: t.priority,
                    parentId: t.parentId,
                  })),
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'list_tasks': {
        const input = ListTasksSchema.parse(args)
        const tasks = await tasksDb.listTasks({
          projectId: input.projectId,
          status: input.status,
          priority: input.priority,
          includeArchived: input.includeArchived,
        })

        const limited = tasks.slice(0, input.limit)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                limited.map((t) => ({
                  id: t.id,
                  projectId: t.projectId,
                  title: t.title,
                  status: t.status,
                  priority: t.priority,
                  effort: t.effort,
                  assignee: t.assignee,
                  parentId: t.parentId,
                  createdAt: t.createdAt,
                })),
                null,
                2
              ),
            },
          ],
        }
      }

      case 'get_task': {
        const input = GetTaskSchema.parse(args)
        const task = await tasksDb.getTaskById(input.id)

        if (!task) {
          return {
            content: [{ type: 'text', text: `Task ${input.id} not found` }],
            isError: true,
          }
        }

        // Get subtasks
        const subtasks = await tasksDb.getSubtasks(input.id)

        // Get task updates
        const updates = await tasksDb.getTaskUpdates(input.id)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ...task,
                  subtasks: subtasks.map((s) => ({
                    id: s.id,
                    title: s.title,
                    status: s.status,
                    priority: s.priority,
                  })),
                  updates: updates.map((u) => ({
                    id: u.id,
                    content: u.content,
                    updateType: u.updateType,
                    author: u.author,
                    createdAt: u.createdAt,
                  })),
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'create_task': {
        const input = CreateTaskSchema.parse(args)

        // Verify project exists
        const project = await projectsDb.getProjectById(input.projectId)
        if (!project) {
          return {
            content: [
              { type: 'text', text: `Project ${input.projectId} not found` },
            ],
            isError: true,
          }
        }

        const task = await tasksDb.createTask({
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          effort: input.effort,
          parentId: input.parentId,
          acceptanceCriteria: input.acceptanceCriteria,
          assignee: input.assignee,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  task: {
                    id: task.id,
                    title: task.title,
                    status: task.status,
                    priority: task.priority,
                    projectId: task.projectId,
                  },
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'update_task_status': {
        const input = UpdateTaskStatusSchema.parse(args)

        // Verify task exists
        const existingTask = await tasksDb.getTaskById(input.id)
        if (!existingTask) {
          return {
            content: [{ type: 'text', text: `Task ${input.id} not found` }],
            isError: true,
          }
        }

        const updatedTask = await tasksDb.updateTask(input.id, {
          status: input.status,
          ...(input.status === 'completed' ? { completedAt: new Date() } : {}),
          ...(input.status === 'in_progress' && !existingTask.startedAt
            ? { startedAt: new Date() }
            : {}),
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  task: {
                    id: updatedTask.id,
                    title: updatedTask.title,
                    status: updatedTask.status,
                    previousStatus: existingTask.status,
                  },
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'add_task_update': {
        const input = AddTaskUpdateSchema.parse(args)

        // Verify task exists
        const task = await tasksDb.getTaskById(input.taskId)
        if (!task) {
          return {
            content: [{ type: 'text', text: `Task ${input.taskId} not found` }],
            isError: true,
          }
        }

        const update = await tasksDb.addTaskUpdate({
          taskId: input.taskId,
          content: input.content,
          updateType: input.updateType,
          author: input.author || 'agent',
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  update: {
                    id: update.id,
                    taskId: update.taskId,
                    content: update.content,
                    updateType: update.updateType,
                    createdAt: update.createdAt,
                  },
                },
                null,
                2
              ),
            },
          ],
        }
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    }
  }
})

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[MCP] Orchestrator MCP server running')
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error)
  process.exit(1)
})
