# TanStack.com Reference Implementation Patterns

This document captures best practices and patterns from the official TanStack.com website codebase, which serves as a production reference for TanStack Start, TanStack Router, TanStack Query, Drizzle ORM, and Valibot validation.

## Table of Contents

1. [TanStack Start Server Functions](#1-tanstack-start-server-functions)
2. [Database Patterns with Drizzle ORM](#2-database-patterns-with-drizzle-orm)
3. [Authentication Patterns](#3-authentication-patterns)
4. [TanStack Router Patterns](#4-tanstack-router-patterns)
5. [TanStack Query Patterns](#5-tanstack-query-patterns)
6. [File Organization](#6-file-organization)

---

## 1. TanStack Start Server Functions

### Basic Server Function Pattern

Server functions are created using `createServerFn` from `@tanstack/react-start`. The pattern uses method chaining with `.inputValidator()` for validation and `.handler()` for the implementation.

**File: `src/utils/feed.functions.ts`**

```typescript
import { createServerFn } from '@tanstack/react-start'
import * as v from 'valibot'
import { db } from '~/db/client'
import { feedEntries } from '~/db/schema'
import { eq } from 'drizzle-orm'

// Simple server function with no input
export const getFeedStats = createServerFn({ method: 'POST' }).handler(
  async () => {
    const allEntries = await db.select().from(feedEntries)
    return {
      total: allEntries.length,
      // ... more stats
    }
  },
)

// Server function with input validation
export const getFeedEntry = createServerFn({ method: 'POST' })
  .inputValidator(v.object({ id: v.string() }))
  .handler(async ({ data }) => {
    const entry = await db.query.feedEntries.findFirst({
      where: eq(feedEntries.entryId, data.id),
    })
    return entry ? transformFeedEntry(entry) : null
  })
```

### Complex Input Validation with Valibot

**File: `src/utils/docFeedback.functions.ts`**

Using `v.variant` for discriminated unions based on type:

```typescript
export const createDocFeedback = createServerFn({ method: 'POST' })
  .inputValidator(
    v.variant('type', [
      v.object({
        type: v.literal('note'),
        content: v.pipe(v.string(), v.minLength(1, 'Note cannot be empty')),
        pagePath: v.string(),
        libraryId: v.string(),
        libraryVersion: v.string(),
        blockSelector: v.string(),
        blockContentHash: v.optional(v.string()),
        blockMarkdown: v.optional(v.string()),
      }),
      v.object({
        type: v.literal('improvement'),
        content: v.pipe(
          v.string(),
          v.minLength(10, 'Improvement feedback must be at least 10 characters'),
        ),
        pagePath: v.string(),
        libraryId: v.string(),
        libraryVersion: v.string(),
        blockSelector: v.string(),
        blockContentHash: v.optional(v.string()),
        blockMarkdown: v.optional(v.string()),
      }),
    ]),
  )
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser()
    if (!user) {
      throw new Error('Authentication required')
    }
    // Implementation...
  })
```

### Pagination and Filtering Pattern

**File: `src/utils/feed.functions.ts`**

```typescript
export const listFeedEntries = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      pagination: v.object({
        limit: v.number(),
        page: v.optional(v.number()),
      }),
      filters: v.optional(
        v.object({
          entryTypes: v.optional(v.array(entryTypeSchema)),
          libraries: v.optional(v.array(v.string())),
          partners: v.optional(v.array(v.string())),
          tags: v.optional(v.array(v.string())),
          releaseLevels: v.optional(
            v.array(v.picklist(['major', 'minor', 'patch'])),
          ),
          includePrerelease: v.optional(v.boolean()),
          featured: v.optional(v.boolean()),
          search: v.optional(v.string()),
          includeHidden: v.optional(v.boolean()),
        }),
      ),
    }),
  )
  .handler(async ({ data }) => {
    const limit = data.pagination.limit
    const pageIndex = data.pagination.page ?? 0
    const filters = data.filters ?? {}

    const whereClause = buildFeedQueryConditions(filters)

    let allEntries = await db
      .select()
      .from(feedEntries)
      .where(whereClause)
      .orderBy(sql`${feedEntries.publishedAt} DESC`)

    // Pagination
    const start = Math.max(0, pageIndex * limit)
    const end = start + limit
    const page = allEntries.slice(start, end)
    const hasMore = end < allEntries.length

    return {
      page: page.map(transformFeedEntry),
      isDone: !hasMore,
      counts: {
        total: allEntries.length,
        pages: Math.max(1, Math.ceil(allEntries.length / limit)),
      },
    }
  })
```

### UUID Validation Pattern

```typescript
export const updateDocFeedback = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      feedbackId: v.pipe(v.string(), v.uuid()),
      content: v.pipe(v.string(), v.minLength(1, 'Content cannot be empty')),
    }),
  )
  .handler(async ({ data }) => {
    // Implementation...
  })
```

### Centralized Schema Definitions

**File: `src/utils/schemas.ts`**

```typescript
import * as v from 'valibot'
import {
  CAPABILITIES,
  OAUTH_PROVIDERS,
  DOC_FEEDBACK_TYPES,
  DOC_FEEDBACK_STATUSES,
  ENTRY_TYPES,
} from '~/db/types'
import { libraryIds } from '~/libraries'

// Valibot schemas derived from constants
export const capabilitySchema = v.picklist([...CAPABILITIES])
export const oauthProviderSchema = v.picklist([...OAUTH_PROVIDERS])
export const docFeedbackTypeSchema = v.picklist([...DOC_FEEDBACK_TYPES])
export const docFeedbackStatusSchema = v.picklist([...DOC_FEEDBACK_STATUSES])
export const entryTypeSchema = v.picklist([...ENTRY_TYPES])

// Library ID schema - derived from libraries config
export const libraryIdSchema = v.picklist([...libraryIds])
```

---

## 2. Database Patterns with Drizzle ORM

### Database Client Setup with Lazy Initialization

**File: `src/db/client.ts`**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Lazy initialization to avoid throwing at module load time
let _client: ReturnType<typeof postgres> | null = null
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

function getDb() {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set')
    }
    _client = postgres(connectionString, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
    })
    _db = drizzle(_client, { schema })
  }
  return _db
}

// Use a getter to lazily initialize db on first access
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(target, prop, receiver) {
    const realDb = getDb()
    const value = Reflect.get(realDb, prop, realDb)
    if (typeof value === 'function') {
      return value.bind(realDb)
    }
    return value
  },
})
```

### Schema Design Patterns

**File: `src/db/schema.ts`**

#### Enum Definitions

```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'

// Enums defined from constants (single source of truth)
export const capabilityEnum = pgEnum('capability', CAPABILITIES)
export const oauthProviderEnum = pgEnum('oauth_provider', OAUTH_PROVIDERS)
export const docFeedbackTypeEnum = pgEnum('doc_feedback_type', DOC_FEEDBACK_TYPES)
export const docFeedbackStatusEnum = pgEnum('doc_feedback_status', DOC_FEEDBACK_STATUSES)
```

#### Table with Indexes and Relations

```typescript
// Users table
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }),
    displayUsername: varchar('display_username', { length: 255 }),
    image: text('image'),
    oauthImage: text('oauth_image'),
    capabilities: capabilityEnum('capabilities').array().notNull().default([]),
    adsDisabled: boolean('ads_disabled').default(false),
    sessionVersion: integer('session_version').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
    createdAtIdx: index('users_created_at_idx').on(table.createdAt),
  }),
)

export type User = InferSelectModel<typeof users>
export type NewUser = InferInsertModel<typeof users>
```

#### Foreign Key References

```typescript
// Sessions table with foreign key
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: varchar('token', { length: 255 }).notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tokenIdx: index('sessions_token_idx').on(table.token),
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
    expiresAtIdx: index('sessions_expires_at_idx').on(table.expiresAt),
  }),
)
```

#### Unique Composite Indexes

```typescript
export const roleAssignments = pgTable(
  'role_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index('role_assignments_user_id_idx').on(table.userId),
    roleIdIdx: index('role_assignments_role_id_idx').on(table.roleId),
    userRoleUnique: uniqueIndex('role_assignments_user_role_unique').on(
      table.userId,
      table.roleId,
    ),
  }),
)
```

#### Array and JSONB Columns

```typescript
export const feedEntries = pgTable(
  'feed_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryId: varchar('entry_id', { length: 255 }).notNull().unique(),
    entryType: entryTypeEnum('entry_type').notNull().default('announcement'),
    title: text('title').notNull(),
    content: text('content').notNull(),
    metadata: jsonb('metadata'),
    libraryIds: varchar('library_ids', { length: 255 }).array().notNull().default([]),
    tags: varchar('tags', { length: 255 }).array().notNull().default([]),
    showInFeed: boolean('show_in_feed').notNull().default(true),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => ({
    publishedAtIdx: index('feed_entries_published_at_idx').on(table.publishedAt),
    entryTypeIdx: index('feed_entries_entry_type_idx').on(table.entryType),
  }),
)
```

#### Relations

```typescript
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  oauthAccounts: many(oauthAccounts),
  roleAssignments: many(roleAssignments),
  docFeedback: many(docFeedback),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

export const showcasesRelations = relations(showcases, ({ one, many }) => ({
  user: one(users, {
    fields: [showcases.userId],
    references: [users.id],
  }),
  moderator: one(users, {
    fields: [showcases.moderatedBy],
    references: [users.id],
  }),
  votes: many(showcaseVotes),
}))
```

### Client-Safe Types

**File: `src/db/types.ts`**

Keep types separate from Drizzle schema to allow client-side imports:

```typescript
// Client-safe types and constants
// This file contains NO drizzle-orm imports and can be safely imported in client code

export const CAPABILITIES = [
  'admin',
  'disableAds',
  'builder',
  'feed',
  'moderate-feedback',
  'moderate-showcases',
] as const

export const OAUTH_PROVIDERS = ['github', 'google'] as const

export const DOC_FEEDBACK_TYPES = ['note', 'improvement'] as const

export const DOC_FEEDBACK_STATUSES = ['pending', 'approved', 'denied'] as const

// Derived types from constants
export type Capability = (typeof CAPABILITIES)[number]
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number]
export type DocFeedbackType = (typeof DOC_FEEDBACK_TYPES)[number]

// Manual interface definitions (client-safe)
export interface User {
  id: string
  email: string
  name: string | null
  capabilities: Capability[]
  createdAt: Date
  updatedAt: Date
}
```

### Query Patterns

#### Using `db.query` with relational queries

```typescript
const entry = await db.query.feedEntries.findFirst({
  where: eq(feedEntries.entryId, data.id),
})
```

#### Select with joins

```typescript
const feedbackList = await db
  .select({
    feedback: docFeedback,
    user: {
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
    },
  })
  .from(docFeedback)
  .leftJoin(users, eq(docFeedback.userId, users.id))
  .where(whereClause)
  .orderBy(desc(docFeedback.createdAt))
  .limit(pageSize)
  .offset(offset)
```

#### Count queries

```typescript
const [countResult] = await db
  .select({ count: sql<number>`COUNT(*)::int` })
  .from(docFeedback)
  .where(whereClause)

const total = countResult?.count ?? 0
```

#### Insert with returning

```typescript
const [newFeedback] = await db
  .insert(docFeedback)
  .values({
    userId: user.userId,
    type: data.type as DocFeedbackType,
    content: data.content,
    // ...
  })
  .returning()
```

#### Update

```typescript
await db
  .update(docFeedback)
  .set({
    content: data.content,
    characterCount,
    updatedAt: new Date(),
  })
  .where(eq(docFeedback.id, data.feedbackId))
```

#### Upsert pattern

```typescript
const existing = await db.query.feedConfig.findFirst({
  where: eq(feedConfig.key, data.key),
})

if (existing) {
  await db
    .update(feedConfig)
    .set({ value: data.value, updatedAt: new Date() })
    .where(eq(feedConfig.key, data.key))
} else {
  await db.insert(feedConfig).values({
    key: data.key,
    value: data.value,
  })
}
```

---

## 3. Authentication Patterns

### Architecture Overview

The authentication system uses a layered architecture with dependency injection:

```
src/auth/
  auth.server.ts      - Main AuthService class
  session.server.ts   - Session management with HMAC-SHA256 signing
  oauth.server.ts     - OAuth provider integrations (GitHub, Google)
  guards.server.ts    - Authorization guards
  repositories.server.ts - Data access layer
  types.ts            - Type definitions and interfaces
  index.server.ts     - Exports and service factories
```

### Session Management with Cookie Signing

**File: `src/auth/session.server.ts`**

```typescript
export class SessionService implements ISessionService {
  private secret: string
  private isProduction: boolean

  constructor(secret: string, isProduction: boolean = false) {
    if (isProduction && secret === 'dev-secret-key-change-in-production') {
      throw new Error('SESSION_SECRET must be set in production')
    }
    this.secret = secret
    this.isProduction = isProduction
  }

  /**
   * Sign cookie data using HMAC-SHA256
   */
  async signCookie(data: SessionCookieData): Promise<string> {
    const payload = `${data.userId}:${data.expiresAt}:${data.version}`
    const payloadBase64 = base64UrlEncode(payload)

    const encoder = new TextEncoder()
    const keyData = encoder.encode(this.secret)
    const messageData = encoder.encode(payloadBase64)

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )

    const signature = await crypto.subtle.sign('HMAC', key, messageData)
    const signatureBase64 = base64UrlEncode(
      String.fromCharCode(...new Uint8Array(signature))
    )

    return `${payloadBase64}.${signatureBase64}`
  }

  /**
   * Verify and parse signed cookie
   */
  async verifyCookie(signedCookie: string): Promise<SessionCookieData | null> {
    // Verification logic with expiration check
  }

  /**
   * Create session cookie header value
   */
  createSessionCookieHeader(signedCookie: string, maxAge: number): string {
    return `session_token=${encodeURIComponent(signedCookie)}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${this.isProduction ? '; Secure' : ''}`
  }
}
```

### OAuth Flow Implementation

**File: `src/routes/auth/$provider/start.tsx`**

```typescript
export const Route = createFileRoute('/auth/$provider/start')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const provider = params.provider as 'github' | 'google'

        // Generate random state token for CSRF protection
        const state = generateOAuthState()

        // Store state in HTTPS-only cookie
        const stateCookie = createOAuthStateCookie(state, isProduction)

        // Build OAuth URL based on provider
        const redirectUri = `${origin}/api/auth/callback/${provider}`
        let authUrl: string

        if (provider === 'github') {
          authUrl = buildGitHubAuthUrl(clientId, redirectUri, state)
        } else {
          authUrl = buildGoogleAuthUrl(clientId, redirectUri, state)
        }

        return new Response(null, {
          status: 302,
          headers: {
            Location: authUrl,
            'Set-Cookie': stateCookie,
          },
        })
      },
    },
  },
})
```

**File: `src/routes/api/auth/callback/$provider.tsx`**

```typescript
export const Route = createFileRoute('/api/auth/callback/$provider')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const provider = params.provider as 'github' | 'google'
        const url = new URL(request.url)
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')

        // Validate state from cookie (CSRF protection)
        const cookieState = getOAuthStateCookie(request)
        if (cookieState !== state) {
          return Response.redirect(new URL('/login?error=oauth_failed', request.url), 302)
        }

        // Exchange code for access token
        const accessToken = provider === 'github'
          ? await exchangeGitHubCode(code, clientId, clientSecret, redirectUri)
          : await exchangeGoogleCode(code, clientId, clientSecret, redirectUri)

        // Fetch user profile
        const userProfile = provider === 'github'
          ? await fetchGitHubProfile(accessToken)
          : await fetchGoogleProfile(accessToken)

        // Upsert user and OAuth account
        const result = await oauthService.upsertOAuthAccount(provider, userProfile)

        // Create signed session cookie
        const signedCookie = await sessionService.signCookie({
          userId: user.id,
          expiresAt: Date.now() + SESSION_DURATION_MS,
          version: user.sessionVersion,
        })

        const headers = new Headers()
        headers.set('Location', '/account')
        headers.append('Set-Cookie', clearOAuthStateCookie(isProduction))
        headers.append('Set-Cookie', sessionService.createSessionCookieHeader(signedCookie, SESSION_MAX_AGE_SECONDS))

        return new Response(null, { status: 302, headers })
      },
    },
  },
})
```

### OAuth Account Upsert Pattern

**File: `src/auth/oauth.server.ts`**

```typescript
export class OAuthService implements IOAuthService {
  async upsertOAuthAccount(
    provider: OAuthProvider,
    profile: OAuthProfile,
  ): Promise<OAuthResult> {
    // Check if OAuth account already exists
    const existingAccount = await this.oauthAccountRepository.findByProviderAndAccountId(
      provider,
      profile.id,
    )

    if (existingAccount) {
      // Update user info if needed, return existing user
      return { userId: existingAccount.userId, isNewUser: false }
    }

    // Find user by email (for linking multiple OAuth providers)
    const existingUser = await this.userRepository.findByEmail(profile.email)

    if (existingUser) {
      // Link OAuth account to existing user
      await this.oauthAccountRepository.create({
        userId: existingUser.id,
        provider,
        providerAccountId: profile.id,
        email: profile.email,
      })
      return { userId: existingUser.id, isNewUser: false }
    }

    // Create new user and OAuth account
    const newUser = await this.userRepository.create({
      email: profile.email,
      name: profile.name,
      image: profile.image,
    })

    await this.oauthAccountRepository.create({
      userId: newUser.id,
      provider,
      providerAccountId: profile.id,
      email: profile.email,
    })

    return { userId: newUser.id, isNewUser: true }
  }
}
```

### Auth Guards as Server Functions

**File: `src/utils/auth.server.ts`**

```typescript
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

export const getCurrentUser = createServerFn({ method: 'POST' }).handler(
  async () => {
    const request = getRequest()
    const authService = getAuthService()
    return authService.getCurrentUser(request)
  },
)

export const requireAuth = createServerFn({ method: 'POST' }).handler(
  async () => {
    const request = getRequest()
    const guards = getAuthGuards()
    return guards.requireAuth(request)
  },
)

export const requireCapability = createServerFn({ method: 'POST' })
  .inputValidator((data: { capability: string }) => ({
    capability: data.capability as Capability,
  }))
  .handler(async ({ data: { capability } }) => {
    const request = getRequest()
    const guards = getAuthGuards()
    return guards.requireCapability(request, capability)
  })

// Helper for non-blocking user load
export async function loadUser() {
  try {
    return await getCurrentUser()
  } catch {
    return null
  }
}
```

---

## 4. TanStack Router Patterns

### Root Route with Context

**File: `src/routes/__root.tsx`**

```typescript
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ...seo({
        title: 'TanStack | High Quality Open-Source Software',
        description: '...',
      }),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.ico' },
    ],
  }),
  beforeLoad: async (ctx) => {
    // Handle redirects
    if (ctx.location.href.match(/\/docs\/(react|vue|angular|svelte|solid)\//gm)) {
      throw redirect({
        href: ctx.location.href.replace(
          /\/docs\/(react|vue|angular|svelte|solid)\//gm,
          '/docs/framework/$1/',
        ),
      })
    }
  },
  staleTime: Infinity,
  errorComponent: (props) => <DefaultCatchBoundary {...props} />,
  notFoundComponent: () => <NotFound />,
  component: () => (
    <ThemeProvider>
      <SearchProvider>
        <Outlet />
      </SearchProvider>
    </ThemeProvider>
  ),
})
```

### Layout Routes

**File: `src/routes/_libraries/route.tsx`**

```typescript
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_libraries')({
  staleTime: Infinity,
  component: () => (
    <LibrariesLayout>
      <Outlet />
    </LibrariesLayout>
  ),
})
```

### Protected Routes with beforeLoad

**File: `src/routes/admin/route.tsx`**

```typescript
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { requireAnyAdminCapability } from '~/utils/auth.server'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    try {
      const user = await requireAnyAdminCapability()
      return { user }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  component: () => (
    <ClientAdminAuth>
      <AdminLayout>
        <Outlet />
      </AdminLayout>
    </ClientAdminAuth>
  ),
  staticData: {
    Title: () => <Link to=".">Admin</Link>,
  },
})
```

### Search Params Validation with Valibot

**File: `src/routes/_libraries/feed.index.tsx`**

```typescript
import { createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { listFeedEntriesQueryOptions } from '~/queries/feed'

const searchSchema = v.object({
  entryTypes: v.fallback(v.optional(v.array(entryTypeSchema)), undefined),
  libraries: v.fallback(v.optional(v.array(libraryIdSchema)), undefined),
  page: v.fallback(v.optional(v.number(), 1), 1),
  pageSize: v.fallback(
    v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 50),
    50,
  ),
  viewMode: v.fallback(v.optional(feedViewModeSchema, 'table'), 'table'),
})

export const Route = createFileRoute('/_libraries/feed/')({
  staleTime: 1000 * 60 * 5, // 5 minutes
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    pageSize: search.pageSize,
    entryTypes: search.entryTypes,
    libraries: search.libraries,
    // ... other deps
  }),
  loader: async ({ deps, context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      listFeedEntriesQueryOptions({
        pagination: {
          limit: deps.pageSize ?? 50,
          page: (deps.page ?? 1) - 1,
        },
        filters: {
          entryTypes: deps.entryTypes,
          libraries: deps.libraries,
          // ...
        },
      }),
    )
  },
  headers: () => ({
    'cache-control': 'public, max-age=0, must-revalidate',
    'cdn-cache-control': 'max-age=300, stale-while-revalidate=300, durable',
  }),
  component: FeedPage,
  head: () => ({
    meta: seo({
      title: 'Feed | TanStack',
      description: '...',
    }),
  }),
})
```

### Using Route.useSearch and Route.useNavigate

```typescript
function FeedPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <FeedPageComponent
      search={search}
      onNavigate={(updates) => {
        navigate({
          search: (s: typeof search) => ({ ...s, ...updates.search }),
          replace: updates.replace ?? true,
          resetScroll: updates.resetScroll ?? false,
        })
      }}
    />
  )
}
```

### Server Route Handlers

**File: `src/routes/auth/$provider/start.tsx`**

```typescript
export const Route = createFileRoute('/auth/$provider/start')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        // Handle OAuth initiation
        return new Response(null, {
          status: 302,
          headers: { Location: authUrl, 'Set-Cookie': stateCookie },
        })
      },
    },
  },
})
```

---

## 5. TanStack Query Patterns

### Query Options Factory Pattern

**File: `src/queries/feed.ts`**

```typescript
import { queryOptions } from '@tanstack/react-query'
import { listFeedEntries, getFeedEntry, getFeedStats } from '~/utils/feed.functions'

export const listFeedEntriesQueryOptions = (params: ListFeedEntriesParams) =>
  queryOptions({
    queryKey: ['feed', 'list', params],
    queryFn: () => listFeedEntries({ data: params }),
  })

export const getFeedEntryQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['feed', 'entry', id],
    queryFn: () => getFeedEntry({ data: { id } }),
  })

export const getFeedStatsQueryOptions = () =>
  queryOptions({
    queryKey: ['feed', 'stats'],
    queryFn: () => getFeedStats(),
  })

export const getFeedFacetCountsQueryOptions = (filters?: FeedFilters) =>
  queryOptions({
    queryKey: ['feed', 'facetCounts', filters],
    queryFn: () => getFeedFacetCounts({ data: { filters } }),
  })
```

### Auth Query Options

**File: `src/queries/auth.ts`**

```typescript
import { queryOptions } from '@tanstack/react-query'
import { getCurrentUser } from '~/utils/auth.server'

export const currentUserQueryOptions = () =>
  queryOptions({
    queryKey: ['auth', 'currentUser'],
    queryFn: () => getCurrentUser(),
  })
```

### Showcases Query Options with Conditional Queries

**File: `src/queries/showcases.ts`**

```typescript
import { queryOptions } from '@tanstack/react-query'
import { getMyShowcases, getApprovedShowcases, getMyShowcaseVotes } from '~/utils/showcase.functions'

export const getMyShowcasesQueryOptions = (params: {
  pagination: ShowcasePagination
}) =>
  queryOptions({
    queryKey: ['showcases', 'mine', params],
    queryFn: () => getMyShowcases({ data: params }),
  })

export const getApprovedShowcasesQueryOptions = (params: {
  pagination: ShowcasePagination
  filters?: { libraryId?: string; useCases?: ShowcaseUseCase[]; featured?: boolean }
}) =>
  queryOptions({
    queryKey: ['showcases', 'approved', params],
    queryFn: () => getApprovedShowcases({ data: params }),
  })

// Conditional query with enabled option
export const getMyShowcaseVotesQueryOptions = (showcaseIds: string[]) =>
  queryOptions({
    queryKey: ['showcases', 'votes', 'mine', showcaseIds],
    queryFn: () => getMyShowcaseVotes({ data: { showcaseIds } }),
    enabled: showcaseIds.length > 0,
  })
```

### Query Key Conventions

The codebase follows a consistent query key structure:

```typescript
// Entity-based keys
['feed', 'list', params]           // List queries with params
['feed', 'entry', id]              // Single item by ID
['feed', 'entryById', id]          // Alternative single item
['feed', 'stats']                  // Aggregations
['feed', 'facetCounts', filters]   // Faceted counts

// Scoped keys
['showcases', 'mine', params]      // User's own items
['showcases', 'approved', params]  // Public approved items
['showcases', 'moderation', params] // Admin moderation view
['showcases', 'votes', 'mine', ids] // User's votes

// Auth keys
['auth', 'currentUser']            // Current user session
```

### Prefetching in Route Loaders

```typescript
export const Route = createFileRoute('/_libraries/feed/')({
  loader: async ({ deps, context: { queryClient } }) => {
    // Use ensureQueryData to prefetch
    await queryClient.ensureQueryData(
      listFeedEntriesQueryOptions({
        pagination: { limit: deps.pageSize, page: deps.page - 1 },
        filters: { entryTypes: deps.entryTypes },
      }),
    )
  },
})
```

---

## 6. File Organization

### Directory Structure

```
src/
  auth/                     # Authentication module (isolated)
    auth.server.ts          # Main AuthService class
    capabilities.server.ts  # Capability checking
    context.server.ts       # Auth context factory
    guards.server.ts        # Authorization guards
    oauth.server.ts         # OAuth provider implementations
    repositories.server.ts  # Data access repositories
    session.server.ts       # Session/cookie management
    types.ts               # Type definitions
    index.server.ts        # Public exports (server)
    index.ts               # Public exports (client-safe)
    client.ts              # Client-side auth utilities

  db/                      # Database layer
    client.ts              # Drizzle client setup
    schema.ts              # All table definitions
    types.ts               # Client-safe types (no drizzle imports)

  queries/                 # TanStack Query options
    auth.ts                # Auth query options
    docFeedback.ts         # Feedback query options
    feed.ts                # Feed query options
    roles.ts               # Roles query options
    showcases.ts           # Showcases query options
    stats.ts               # Stats query options
    users.ts               # Users query options

  utils/                   # Server functions and utilities
    *.functions.ts         # Server functions (createServerFn)
    *.server.ts           # Server-only utilities
    *.client.ts           # Client-only utilities
    schemas.ts            # Valibot schemas

  routes/                  # TanStack Router routes
    __root.tsx            # Root layout
    _libraries/           # Layout route group
      route.tsx           # Layout component
      index.tsx           # Home page
      feed.index.tsx      # Feed listing
      ...
    admin/                # Admin routes
      route.tsx           # Admin layout with auth
      index.tsx           # Admin dashboard
      users.tsx           # User management
      ...
    api/                  # API routes
      auth/               # Auth callbacks
    auth/                 # Auth initiation routes
    $libraryId/           # Dynamic library routes

  components/             # React components
  hooks/                  # Custom React hooks
  contexts/               # React contexts
  images/                 # Static images
  styles/                 # CSS files
```

### File Naming Conventions

| Pattern | Purpose |
|---------|---------|
| `*.functions.ts` | Server functions using `createServerFn` |
| `*.server.ts` | Server-only utilities (not server functions) |
| `*.client.ts` | Client-only utilities |
| `types.ts` | Type definitions (client-safe) |
| `schemas.ts` | Valibot validation schemas |
| `index.ts` / `index.server.ts` | Public exports |

### Server Function Organization

Server functions are organized by domain in the `utils/` folder:

```
utils/
  auth.server.ts           # Auth server functions wrapper
  docFeedback.functions.ts # Doc feedback CRUD
  feed.functions.ts        # Feed CRUD
  showcase.functions.ts    # Showcase CRUD
  roles.functions.ts       # Role management
  stats.functions.ts       # Stats computation
  audit.functions.ts       # Audit logging
  banner.functions.ts      # Banner management
```

### Query Options Organization

Query options are organized by domain in the `queries/` folder, mirroring the server functions:

```
queries/
  auth.ts       # currentUserQueryOptions
  feed.ts       # listFeedEntriesQueryOptions, getFeedEntryQueryOptions, etc.
  showcases.ts  # getMyShowcasesQueryOptions, getApprovedShowcasesQueryOptions, etc.
  users.ts      # User-related query options
```

### Type Sharing Strategy

1. **Constants and types** are defined in `src/db/types.ts` (client-safe)
2. **Drizzle schema** imports types from `db/types.ts`
3. **Valibot schemas** in `utils/schemas.ts` derive from the same constants
4. This ensures single source of truth for enums used across:
   - Database constraints
   - API validation
   - Client-side type checking

### Import Aliases

The codebase uses `~` as an alias for the `src/` directory:

```typescript
import { db } from '~/db/client'
import { users } from '~/db/schema'
import { currentUserQueryOptions } from '~/queries/auth'
import { createDocFeedback } from '~/utils/docFeedback.functions'
```

---

## Summary

The tanstack.com codebase demonstrates production-ready patterns for:

1. **Server Functions**: Using `createServerFn` with Valibot validation for type-safe RPC
2. **Database**: Drizzle ORM with PostgreSQL, lazy initialization, and comprehensive schema design
3. **Authentication**: Cookie-based sessions with HMAC signing, OAuth integration (GitHub/Google)
4. **Routing**: TanStack Router with search param validation, protected routes, and server handlers
5. **Queries**: Query options factory pattern for consistent caching and prefetching
6. **Organization**: Clear separation between server/client code with consistent naming conventions
