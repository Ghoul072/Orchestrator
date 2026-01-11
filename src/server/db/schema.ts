import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm'

// =============================================================================
// ENUMS
// =============================================================================

export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
])

export const taskPriorityEnum = pgEnum('task_priority', [
  'low',
  'medium',
  'high',
  'urgent',
])

export const taskEffortEnum = pgEnum('task_effort', [
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
])

export const taskRelationTypeEnum = pgEnum('task_relation_type', [
  'blocks',
  'blocked_by',
  'relates_to',
  'duplicates',
])

export const taskUpdateTypeEnum = pgEnum('task_update_type', [
  'progress',
  'blocker',
  'question',
  'completion',
])

export const meetingStatusEnum = pgEnum('meeting_status', ['draft', 'finalized'])

export const meetingTaskLinkTypeEnum = pgEnum('meeting_task_link_type', [
  'created',
  'updated',
])

export const documentTypeEnum = pgEnum('document_type', [
  'note',
  'diagram',
  'upload',
])

export const approvalActionTypeEnum = pgEnum('approval_action_type', [
  'file_delete',
  'git_push',
  'git_force_push',
])

export const approvalStatusEnum = pgEnum('approval_status', [
  'pending',
  'approved',
  'rejected',
])

export const agentSessionStatusEnum = pgEnum('agent_session_status', [
  'queued',
  'planning',
  'awaiting_approval',
  'executing',
  'paused',
  'completed',
  'failed',
  'timeout',
])

export const repoCloneStatusEnum = pgEnum('repo_clone_status', [
  'pending',
  'cloning',
  'cloned',
  'analyzing',
  'ready',
  'failed',
  'cleaned',
])

export const viewLayoutEnum = pgEnum('view_layout', [
  'list',
  'kanban',
  'calendar',
  'gantt',
])

export const collectionItemTypeEnum = pgEnum('collection_item_type', [
  'document',
  'task',
  'meeting',
])

export const annotationColorEnum = pgEnum('annotation_color', [
  'yellow',
  'green',
  'blue',
  'pink',
  'purple',
])

export const promptCategoryEnum = pgEnum('prompt_category', [
  'analysis',
  'security',
  'documentation',
  'review',
  'custom',
])

// =============================================================================
// TABLES
// =============================================================================

// Projects
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    agentContext: text('agent_context'), // Custom system prompt for this project
    metadata: jsonb('metadata').$type<Record<string, object>>(),
    isArchived: boolean('is_archived').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index('projects_name_idx').on(table.name),
    createdAtIdx: index('projects_created_at_idx').on(table.createdAt),
  })
)

// Tags
export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull().unique(),
    color: varchar('color', { length: 7 }), // Hex color
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index('tags_name_idx').on(table.name),
  })
)

// Project Tags (many-to-many)
export const projectTags = pgTable(
  'project_tags',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: uniqueIndex('project_tags_pk').on(table.projectId, table.tagId),
  })
)

// Repositories
export const repositories = pgTable(
  'repositories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    url: varchar('url', { length: 500 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    branch: varchar('branch', { length: 255 }).default('main'),
    localPath: text('local_path'),
    cloneStatus: repoCloneStatusEnum('clone_status').default('pending').notNull(),
    stack: jsonb('stack').$type<string[]>(),
    dependencies: jsonb('dependencies').$type<string[]>(),
    lastClonedAt: timestamp('last_cloned_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('repositories_project_id_idx').on(table.projectId),
    urlIdx: index('repositories_url_idx').on(table.url),
  })
)

// Tasks - parentId is self-referential, handled at application level
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description'),
    status: taskStatusEnum('status').default('pending').notNull(),
    priority: taskPriorityEnum('priority').default('medium').notNull(),
    effort: taskEffortEnum('effort'),
    isArchived: boolean('is_archived').default(false).notNull(),
    isParallel: boolean('is_parallel').default(false).notNull(),
    autoStartWhenUnblocked: boolean('auto_start_when_unblocked').default(false).notNull(),
    assignee: varchar('assignee', { length: 255 }),
    githubIssueId: integer('github_issue_id'),
    githubIssueUrl: text('github_issue_url'),
    acceptanceCriteria: jsonb('acceptance_criteria').$type<string[]>(),
    sortOrder: integer('sort_order').default(0).notNull(),
    dueDate: timestamp('due_date', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('tasks_project_id_idx').on(table.projectId),
    parentIdIdx: index('tasks_parent_id_idx').on(table.parentId),
    statusIdx: index('tasks_status_idx').on(table.status),
    priorityIdx: index('tasks_priority_idx').on(table.priority),
    sortOrderIdx: index('tasks_sort_order_idx').on(table.sortOrder),
  })
)

// Task Relations (dependencies)
export const taskRelations = pgTable(
  'task_relations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceTaskId: uuid('source_task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    targetTaskId: uuid('target_task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    relationType: taskRelationTypeEnum('relation_type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sourceTaskIdIdx: index('task_relations_source_task_id_idx').on(table.sourceTaskId),
    targetTaskIdIdx: index('task_relations_target_task_id_idx').on(table.targetTaskId),
    uniqueRelation: uniqueIndex('task_relations_unique').on(
      table.sourceTaskId,
      table.targetTaskId,
      table.relationType
    ),
  })
)

// Task Updates (progress logs)
export const taskUpdates = pgTable(
  'task_updates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    updateType: taskUpdateTypeEnum('update_type').default('progress').notNull(),
    author: varchar('author', { length: 255 }),
    metadata: jsonb('metadata').$type<Record<string, object>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    taskIdIdx: index('task_updates_task_id_idx').on(table.taskId),
    createdAtIdx: index('task_updates_created_at_idx').on(table.createdAt),
  })
)

// Meetings
export const meetings = pgTable(
  'meetings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 500 }).notNull(),
    date: timestamp('date', { withTimezone: true }).notNull(),
    attendees: jsonb('attendees').$type<string[]>(),
    content: text('content').notNull(),
    summary: text('summary'),
    status: meetingStatusEnum('status').default('draft').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('meetings_project_id_idx').on(table.projectId),
    dateIdx: index('meetings_date_idx').on(table.date),
  })
)

// Meeting-Task Links
export const meetingTaskLinks = pgTable(
  'meeting_task_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    linkType: meetingTaskLinkTypeEnum('link_type').notNull(),
    changesSummary: text('changes_summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    meetingIdIdx: index('meeting_task_links_meeting_id_idx').on(table.meetingId),
    taskIdIdx: index('meeting_task_links_task_id_idx').on(table.taskId),
  })
)

// Documents
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 500 }).notNull(),
    content: text('content'),
    type: documentTypeEnum('type').default('note').notNull(),
    filePath: text('file_path'),
    fileType: varchar('file_type', { length: 100 }),
    fileSize: integer('file_size'),
    linkedTaskId: uuid('linked_task_id').references(() => tasks.id, {
      onDelete: 'set null',
    }),
    linkedMeetingId: uuid('linked_meeting_id').references(() => meetings.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('documents_project_id_idx').on(table.projectId),
    typeIdx: index('documents_type_idx').on(table.type),
    linkedTaskIdIdx: index('documents_linked_task_id_idx').on(table.linkedTaskId),
  })
)

// Annotations (highlights on documents)
export const annotations = pgTable(
  'annotations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    color: annotationColorEnum('color').notNull(),
    startOffset: integer('start_offset').notNull(),
    endOffset: integer('end_offset').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    documentIdIdx: index('annotations_document_id_idx').on(table.documentId),
  })
)

// Collections
export const collections = pgTable(
  'collections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    description: text('description'),
    icon: varchar('icon', { length: 50 }), // Emoji
    color: varchar('color', { length: 7 }), // Hex color
    isPinned: boolean('is_pinned').default(false).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index('collections_slug_idx').on(table.slug),
  })
)

// Collection Items
export const collectionItems = pgTable(
  'collection_items',
  {
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    itemType: collectionItemTypeEnum('item_type').notNull(),
    itemId: uuid('item_id').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: uniqueIndex('collection_items_pk').on(
      table.collectionId,
      table.itemType,
      table.itemId
    ),
    collectionIdIdx: index('collection_items_collection_id_idx').on(table.collectionId),
  })
)

// Agent Sessions
export const agentSessions = pgTable(
  'agent_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    status: agentSessionStatusEnum('status').default('queued').notNull(),
    maxTurns: integer('max_turns').default(50).notNull(),
    currentTurn: integer('current_turn').default(0).notNull(),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    lastHeartbeat: timestamp('last_heartbeat', { withTimezone: true }),
    timeoutAt: timestamp('timeout_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    taskIdIdx: index('agent_sessions_task_id_idx').on(table.taskId),
    statusIdx: index('agent_sessions_status_idx').on(table.status),
  })
)

// Approvals
export const approvals = pgTable(
  'approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    agentSessionId: uuid('agent_session_id').references(() => agentSessions.id, {
      onDelete: 'set null',
    }),
    actionType: approvalActionTypeEnum('action_type').notNull(),
    actionDescription: text('action_description').notNull(),
    diffContent: text('diff_content'),
    filesAffected: jsonb('files_affected').$type<string[]>(),
    status: approvalStatusEnum('status').default('pending').notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    taskIdIdx: index('approvals_task_id_idx').on(table.taskId),
    statusIdx: index('approvals_status_idx').on(table.status),
  })
)

// Saved Views
export const savedViews = pgTable(
  'saved_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'cascade',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    layout: viewLayoutEnum('layout').default('list').notNull(),
    filters: jsonb('filters').$type<Record<string, object>>(),
    groupBy: varchar('group_by', { length: 50 }),
    sortBy: varchar('sort_by', { length: 50 }),
    sortOrder: varchar('sort_order', { length: 4 }).default('asc'),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('saved_views_project_id_idx').on(table.projectId),
  })
)

// Prompts
export const prompts = pgTable(
  'prompts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    content: text('content').notNull(),
    category: promptCategoryEnum('category').default('custom').notNull(),
    variables: jsonb('variables').$type<
      Array<{
        name: string
        type: 'string' | 'text' | 'select'
        options?: string[]
        default?: string
      }>
    >(),
    isBuiltIn: boolean('is_built_in').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    categoryIdx: index('prompts_category_idx').on(table.category),
    nameIdx: index('prompts_name_idx').on(table.name),
  })
)

// =============================================================================
// RELATIONS
// =============================================================================

export const projectsRelations = relations(projects, ({ many }) => ({
  tags: many(projectTags),
  repositories: many(repositories),
  tasks: many(tasks),
  meetings: many(meetings),
  documents: many(documents),
  savedViews: many(savedViews),
}))

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  parent: one(tasks, {
    fields: [tasks.parentId],
    references: [tasks.id],
    relationName: 'subtasks',
  }),
  subtasks: many(tasks, { relationName: 'subtasks' }),
  updates: many(taskUpdates),
  sourceRelations: many(taskRelations, { relationName: 'sourceRelations' }),
  targetRelations: many(taskRelations, { relationName: 'targetRelations' }),
  meetingLinks: many(meetingTaskLinks),
  agentSessions: many(agentSessions),
  approvals: many(approvals),
}))

export const taskRelationsRelations = relations(taskRelations, ({ one }) => ({
  sourceTask: one(tasks, {
    fields: [taskRelations.sourceTaskId],
    references: [tasks.id],
    relationName: 'sourceRelations',
  }),
  targetTask: one(tasks, {
    fields: [taskRelations.targetTaskId],
    references: [tasks.id],
    relationName: 'targetRelations',
  }),
}))

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  project: one(projects, {
    fields: [meetings.projectId],
    references: [projects.id],
  }),
  taskLinks: many(meetingTaskLinks),
  linkedDocuments: many(documents),
}))

export const documentsRelations = relations(documents, ({ one, many }) => ({
  project: one(projects, {
    fields: [documents.projectId],
    references: [projects.id],
  }),
  linkedTask: one(tasks, {
    fields: [documents.linkedTaskId],
    references: [tasks.id],
  }),
  linkedMeeting: one(meetings, {
    fields: [documents.linkedMeetingId],
    references: [meetings.id],
  }),
  annotations: many(annotations),
}))

export const collectionsRelations = relations(collections, ({ many }) => ({
  items: many(collectionItems),
}))

// =============================================================================
// TYPES
// =============================================================================

export type Project = InferSelectModel<typeof projects>
export type NewProject = InferInsertModel<typeof projects>

export type Task = InferSelectModel<typeof tasks>
export type NewTask = InferInsertModel<typeof tasks>

export type TaskUpdate = InferSelectModel<typeof taskUpdates>
export type NewTaskUpdate = InferInsertModel<typeof taskUpdates>

export type Meeting = InferSelectModel<typeof meetings>
export type NewMeeting = InferInsertModel<typeof meetings>

export type Document = InferSelectModel<typeof documents>
export type NewDocument = InferInsertModel<typeof documents>

export type Repository = InferSelectModel<typeof repositories>
export type NewRepository = InferInsertModel<typeof repositories>

export type Collection = InferSelectModel<typeof collections>
export type NewCollection = InferInsertModel<typeof collections>

export type AgentSession = InferSelectModel<typeof agentSessions>
export type NewAgentSession = InferInsertModel<typeof agentSessions>

export type Approval = InferSelectModel<typeof approvals>
export type NewApproval = InferInsertModel<typeof approvals>

export type Prompt = InferSelectModel<typeof prompts>
export type NewPrompt = InferInsertModel<typeof prompts>

export type SavedView = InferSelectModel<typeof savedViews>
export type NewSavedView = InferInsertModel<typeof savedViews>

export type Tag = InferSelectModel<typeof tags>
export type NewTag = InferInsertModel<typeof tags>
