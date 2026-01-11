# Hyprnote Reference Project - Best Practices Documentation

This document analyzes the hyprnote project structure and patterns found in `apps/web/src/` to serve as a reference for building TanStack Start applications.

---

## Table of Contents

1. [TanStack Start Server Functions](#1-tanstack-start-server-functions)
2. [Database Patterns (Drizzle Middleware)](#2-database-patterns-drizzle-middleware)
3. [Authentication Patterns](#3-authentication-patterns)
4. [Project Structure](#4-project-structure)
5. [Form Handling (TanStack Form)](#5-form-handling-tanstack-form)
6. [State Management (TanStack Query)](#6-state-management-tanstack-query)

---

## 1. TanStack Start Server Functions

### Basic Structure

Server functions are created using `createServerFn` from `@tanstack/react-start`. The pattern follows a builder approach with method declaration, input validation, and handler.

**Location:** `/apps/web/src/functions/`

### Pattern 1: Simple Server Function (GET)

```typescript
// File: functions/github.ts
import { createServerFn } from "@tanstack/react-start";

export const getGitHubStats = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      const response = await fetchGitHub(
        `https://api.github.com/repos/${GITHUB_ORG_REPO}`,
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch repo info: ${response.status}`);
      }

      const data = await response.json();
      return {
        stars: data.stargazers_count ?? 0,
        forks: data.forks_count ?? 0,
      };
    } catch {
      return { stars: 0, forks: 0 };
    }
  },
);
```

### Pattern 2: Server Function with Zod Input Validation

```typescript
// File: functions/auth.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const shared = z.object({
  flow: z.enum(["desktop", "web"]).default("desktop"),
  scheme: z.string().optional(),
  redirect: z.string().optional(),
});

export const doAuth = createServerFn({ method: "POST" })
  .inputValidator(
    shared.extend({
      provider: z.enum(["google", "github"]),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();

    const params = new URLSearchParams({ flow: data.flow });
    if (data.scheme) params.set("scheme", data.scheme);
    if (data.redirect) params.set("redirect", data.redirect);

    const { data: authData, error } = await supabase.auth.signInWithOAuth({
      provider: data.provider,
      options: {
        redirectTo: `${env.VITE_APP_URL}/callback/auth?${params.toString()}`,
      },
    });

    if (error) {
      return { error: true, message: error.message };
    }

    return { success: true, url: authData.url };
  });
```

### Pattern 3: Server Function with Middleware

```typescript
// File: functions/nango.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { nangoMiddleware } from "@/middleware/nango";

const CreateConnectSessionInput = z.object({
  userId: z.string().min(1),
  userEmail: z.string().email().optional(),
  userName: z.string().optional(),
  organizationId: z.string().optional(),
  allowedIntegrations: z.array(z.string()).optional(),
});

export const nangoCreateConnectSession = createServerFn({ method: "POST" })
  .middleware([nangoMiddleware])
  .inputValidator(CreateConnectSessionInput)
  .handler(async ({ context, data }) => {
    const { nango } = context;

    const res = await nango.createConnectSession({
      end_user: {
        id: data.userId,
        email: data.userEmail,
        display_name: data.userName,
        tags: data.organizationId
          ? { organizationId: data.organizationId }
          : undefined,
      },
      allowed_integrations: data.allowedIntegrations,
    });

    return {
      sessionToken: res.data.token,
    };
  });
```

### Error Handling Pattern

The project uses a consistent error response pattern:

```typescript
// Success response
return { success: true, data: result };

// Error response
return { error: true, message: error.message };

// Or throw for critical errors
if (!user?.id) {
  throw new Error("Unauthorized");
}
```

### Best Practices Summary

1. **Define input schemas separately** for reusability (like `shared` schema above)
2. **Use `.extend()` on base schemas** for variations
3. **Always specify method** (`GET` or `POST`)
4. **Use `as const`** for discriminated union types in return values
5. **Chain builder methods**: `createServerFn().middleware().inputValidator().handler()`

---

## 2. Database Patterns (Drizzle Middleware)

### Drizzle Middleware Setup

**Location:** `/apps/web/src/middleware/drizzle.ts`

```typescript
import { createMiddleware } from "@tanstack/react-start";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/env";

export const drizzleMiddleware = createMiddleware().server(async ({ next }) => {
  const client = postgres(env.DATABASE_URL, { prepare: false });
  const db = drizzle({ client });

  return next({
    context: {
      db,
    },
  });
});
```

### Usage in Server Functions

```typescript
import { drizzleMiddleware } from "@/middleware/drizzle";

export const myServerFunction = createServerFn({ method: "POST" })
  .middleware([drizzleMiddleware])
  .handler(async ({ context }) => {
    const { db } = context;
    // Use db for queries
  });
```

### Key Points

1. **Create connection per request** - The middleware creates a fresh connection for each request
2. **Use `prepare: false`** for serverless environments
3. **Pass db through context** - Makes it available to handlers via `context.db`

---

## 3. Authentication Patterns

### Server/Client Function Separation

**Location:** `/apps/web/src/functions/supabase.ts`

```typescript
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClientOnlyFn, createServerOnlyFn } from "@tanstack/react-start";
import { getCookies, setCookie } from "@tanstack/react-start/server";

import { env } from "@/env";

// Browser client - only runs on client
export const getSupabaseBrowserClient = createClientOnlyFn(() => {
  return createBrowserClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_ANON_KEY,
    {
      auth: {
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    },
  );
});

// Server client - only runs on server
export const getSupabaseServerClient = createServerOnlyFn(() => {
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
    },
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({
          name,
          value,
        }));
      },
      setAll(cookies) {
        cookies.forEach((cookie) => {
          setCookie(cookie.name, cookie.value);
        });
      },
    },
  });
});
```

### Stripe Client Pattern

**Location:** `/apps/web/src/functions/stripe.ts`

```typescript
import { createServerOnlyFn } from "@tanstack/react-start";
import Stripe from "stripe";

import { env } from "@/env";

export const getStripeClient = createServerOnlyFn(() => {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-10-29.clover",
  });
});
```

### Supabase Auth Middleware

**Location:** `/apps/web/src/middleware/supabase.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import { createMiddleware } from "@tanstack/react-start";

import { env } from "@/env";

export const supabaseAuthMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace(/^bearer /i, "");

    if (!token) {
      throw new Response(
        JSON.stringify({ error: "missing_authorization_header" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      throw new Response(
        JSON.stringify({ error: "invalid_authorization_header" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return next({ context: { supabase, user: data.user } });
  },
);
```

### Route-Level Authentication (Protected Routes)

**Location:** `/apps/web/src/routes/_view/app/route.tsx`

```typescript
import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchUser } from "@/functions/auth";

export const Route = createFileRoute("/_view/app")({
  beforeLoad: async ({ location }) => {
    const user = await fetchUser();
    if (!user) {
      const searchStr =
        Object.keys(location.search).length > 0
          ? `?${new URLSearchParams(location.search as Record<string, string>).toString()}`
          : "";
      throw redirect({
        to: "/auth",
        search: {
          flow: "web",
          redirect: location.pathname + searchStr,
        },
      });
    }
    return { user };
  },
});
```

### OAuth Callback Handling

**Location:** `/apps/web/src/routes/_view/callback/auth.tsx`

```typescript
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { getSupabaseServerClient } from "@/functions/supabase";

const validateSearch = z.object({
  code: z.string().optional(),
  token_hash: z.string().optional(),
  type: z.literal("email").optional(),
  flow: z.enum(["desktop", "web"]).default("desktop"),
  scheme: z.string().default("hyprnote"),
  redirect: z.string().optional(),
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
});

export const Route = createFileRoute("/_view/callback/auth")({
  validateSearch,
  component: Component,
  beforeLoad: async ({ search }) => {
    // Handle web flow
    if (search.flow === "web" && search.code) {
      const supabase = getSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(search.code);

      if (!error) {
        throw redirect({ href: search.redirect || "/app/account" });
      }
    }

    // Handle desktop flow
    if (search.flow === "desktop" && search.code) {
      const supabase = getSupabaseServerClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        search.code,
      );

      if (!error && data.session) {
        throw redirect({
          to: "/callback/auth",
          search: {
            flow: "desktop",
            scheme: search.scheme,
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          },
        });
      }
    }

    // Handle magic link OTP
    if (search.token_hash && search.type) {
      const supabase = getSupabaseServerClient();
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: search.token_hash,
        type: search.type,
      });
      // ... handle result
    }
  },
});
```

### Key Authentication Patterns

1. **Use `createServerOnlyFn`** for server-side client factories (Supabase, Stripe)
2. **Use `createClientOnlyFn`** for browser-only clients
3. **Cookie-based sessions** with proper `getAll`/`setAll` handlers
4. **Route-level protection** using `beforeLoad` with redirects
5. **Support multiple auth flows** (web, desktop, magic link)

---

## 4. Project Structure

### Directory Layout

```
apps/web/src/
├── components/           # Reusable UI components
│   ├── mdx/             # MDX-specific components
│   └── transcription/   # Feature-specific components
├── functions/           # Server functions (API layer)
│   ├── auth.ts          # Authentication functions
│   ├── billing.ts       # Stripe billing functions
│   ├── github.ts        # GitHub API functions
│   ├── loops.ts         # Email marketing (Loops.so)
│   ├── nango.ts         # Integration platform functions
│   ├── stripe.ts        # Stripe client factory
│   ├── supabase.ts      # Supabase client factories
│   ├── transcription.ts # Audio transcription functions
│   └── upload.ts        # File upload functions
├── hooks/               # Custom React hooks
│   ├── use-docs-drawer.ts
│   ├── use-handbook-drawer.ts
│   ├── use-hero-context.tsx
│   ├── use-platform.ts
│   └── use-posthog.ts
├── middleware/          # TanStack Start middleware
│   ├── cors.ts          # CORS middleware
│   ├── drizzle.ts       # Database middleware
│   ├── nango.ts         # Nango client middleware
│   └── supabase.ts      # Supabase auth middleware
├── providers/           # React context providers
│   └── posthog.tsx
├── routes/              # File-based routing
│   ├── __root.tsx       # Root layout
│   ├── _view/           # Layout group for main views
│   │   ├── app/         # Protected app routes
│   │   │   ├── route.tsx        # Auth guard for /app/*
│   │   │   ├── account.tsx
│   │   │   ├── checkout.tsx
│   │   │   └── file-transcription.tsx
│   │   ├── callback/
│   │   │   └── auth.tsx         # OAuth callback handler
│   │   ├── docs/
│   │   ├── blog/
│   │   └── index.tsx            # Landing page
│   ├── webhook/
│   │   └── nango.ts     # Webhook handlers
│   └── auth.tsx         # Auth page
├── utils/               # Utility functions
├── env.ts               # Environment configuration
├── queries.ts           # TanStack Query hooks
├── router.tsx           # Router configuration
└── routeTree.gen.ts     # Auto-generated route tree
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Server functions | camelCase, verb prefix | `createCheckoutSession`, `fetchUser` |
| Middleware | camelCase + "Middleware" suffix | `drizzleMiddleware`, `corsMiddleware` |
| Hooks | "use" prefix | `usePlatform`, `useGitHubStats` |
| Routes | kebab-case files | `file-transcription.tsx` |
| Layout routes | Underscore prefix | `_view/` |

### Route Organization Patterns

1. **Layout Groups**: Use `_view/` prefix for shared layouts without affecting URL
2. **Protected Routes**: Create a `route.tsx` file in folder to add auth guards
3. **Dynamic Routes**: Use `$param` syntax (e.g., `$slug.tsx`)
4. **Catch-all Routes**: Use `$.tsx` for wildcard routes
5. **Webhooks**: Separate `webhook/` folder with server handlers

### Webhook Route Pattern

**Location:** `/apps/web/src/routes/webhook/nango.ts`

```typescript
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/webhook/nango")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const payload = await request.json();

          if (
            payload.type === "auth" &&
            payload.operation === "creation" &&
            payload.success === true
          ) {
            // Handle webhook payload
          }

          return new Response("OK", { status: 200 });
        } catch (error) {
          console.error("Error processing webhook:", error);
          return new Response("Internal Server Error", { status: 500 });
        }
      },
    },
  },
});
```

---

## 5. Form Handling (TanStack Form)

### Basic Form Pattern

**Location:** `/apps/web/src/routes/_view/index.tsx`

```typescript
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";

function HeroSection() {
  const mutation = useMutation({
    mutationFn: async (email: string) => {
      await addContact({
        data: {
          email,
          userGroup: "Lead",
          platform: "Desktop",
          source: "LANDING_PAGE",
          intent: "Waitlist",
        },
      });
    },
  });

  const form = useForm({
    defaultValues: {
      email: "",
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value.email);
      form.reset();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.Field
        name="email"
        validators={{
          onChange: ({ value }) => {
            if (!value) {
              return "Email is required";
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              return "Please enter a valid email";
            }
            return undefined;
          },
        }}
      >
        {(field) => (
          <>
            <input
              type="email"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="Enter your email"
              disabled={mutation.isPending || mutation.isSuccess}
            />
            <button
              type="submit"
              disabled={mutation.isPending || mutation.isSuccess}
            >
              {mutation.isPending
                ? "Sending..."
                : mutation.isSuccess
                  ? "Sent!"
                  : "Submit"}
            </button>
            {mutation.isSuccess && (
              <p className="text-green-600">Thanks! We'll be in touch soon.</p>
            )}
            {mutation.isError && (
              <p className="text-red-600">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : "Something went wrong. Please try again."}
              </p>
            )}
          </>
        )}
      </form.Field>
    </form>
  );
}
```

### Search Params Validation

**Location:** `/apps/web/src/routes/auth.tsx`

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const validateSearch = z.object({
  flow: z.enum(["desktop", "web"]).default("web"),
  scheme: z.string().optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch,
  component: Component,
});

function Component() {
  const { flow, scheme, redirect } = Route.useSearch();
  // Use validated search params
}
```

### Key Form Patterns

1. **Combine TanStack Form with TanStack Query** - Form handles UI state, mutation handles API
2. **Field-level validation** using `validators.onChange`
3. **Show mutation states** (isPending, isSuccess, isError) for feedback
4. **Reset form on success** with `form.reset()`
5. **Validate search params** with Zod at route level

---

## 6. State Management (TanStack Query)

### Query Hooks Pattern

**Location:** `/apps/web/src/queries.ts`

```typescript
import { useQuery } from "@tanstack/react-query";
import { getGitHubStats, getStargazers } from "./functions/github";

const LAST_SEEN_STARS = 7032;
const LAST_SEEN_FORKS = 432;

export function useGitHubStats() {
  return useQuery({
    queryKey: ["github-stats"],
    queryFn: async () => {
      const stats = await getGitHubStats();
      return {
        stars: stats.stars || LAST_SEEN_STARS,
        forks: stats.forks || LAST_SEEN_FORKS,
      };
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

export function useGitHubStargazers() {
  return useQuery({
    queryKey: ["github-stargazers"],
    queryFn: () => getStargazers(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
```

### Mutation Pattern

**Location:** `/apps/web/src/routes/_view/app/account.tsx`

```typescript
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

function SignOutSection() {
  const navigate = useNavigate();

  const signOut = useMutation({
    mutationFn: async () => {
      const res = await signOutFn();
      if (res.success) {
        return true;
      }
      throw new Error(res.message);
    },
    onSuccess: () => {
      navigate({ to: "/" });
    },
    onError: (error) => {
      console.error(error);
      navigate({ to: "/" });
    },
  });

  return (
    <button
      onClick={() => signOut.mutate()}
      disabled={signOut.isPending}
    >
      {signOut.isPending ? "Signing out..." : "Sign out"}
    </button>
  );
}
```

### Polling Pattern

**Location:** `/apps/web/src/routes/_view/app/file-transcription.tsx`

```typescript
const pipelineStatusQuery = useQuery({
  queryKey: ["audioPipelineStatus", pipelineId],
  queryFn: async (): Promise<StatusStateType> => {
    if (!pipelineId) {
      throw new Error("Missing pipelineId");
    }
    const res = await getAudioPipelineStatus({
      data: { pipelineId },
    });
    if ("error" in res && res.error) {
      throw new Error(res.message ?? "Failed to get pipeline status");
    }
    return res.status;
  },
  enabled: !!pipelineId, // Only run when pipelineId exists
  refetchInterval: (query) => {
    const status = query.state.data?.status;
    const isTerminal = status === "DONE" || status === "ERROR";
    return isTerminal ? false : 2000; // Poll every 2s until done
  },
});
```

### Router Integration with QueryClient

**Location:** `/apps/web/src/router.tsx`

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    scrollRestoration: true,
    Wrap: (props: { children: React.ReactNode }) => {
      return (
        <PostHogProvider>
          <QueryClientProvider client={queryClient}>
            {props.children}
          </QueryClientProvider>
        </PostHogProvider>
      );
    },
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}
```

### Root Route Context

**Location:** `/apps/web/src/routes/__root.tsx`

```typescript
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext } from "@tanstack/react-router";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "My App" },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFoundDocument,
});
```

### Key Query Patterns

1. **Centralize query hooks** in a `queries.ts` file
2. **Use fallback values** for cached data (e.g., `LAST_SEEN_STARS`)
3. **Set appropriate `staleTime`** for different data types
4. **Use `enabled`** to conditionally run queries
5. **Dynamic `refetchInterval`** for polling that stops when complete
6. **Integrate with router** using `setupRouterSsrQueryIntegration`
7. **Pass QueryClient through router context** for SSR support

---

## Environment Configuration

**Location:** `/apps/web/src/env.ts`

```typescript
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const isCI = process.env.CI === "true";
const isDev = process.env.NODE_ENV === "development";

export const env = createEnv({
  server: {
    NANGO_SECRET_KEY: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    SUPABASE_URL: z.string().min(1),
    SUPABASE_ANON_KEY: z.string().min(1),
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_MONTHLY_PRICE_ID: z.string().min(1),
    STRIPE_YEARLY_PRICE_ID: z.string().min(1),
    LOOPS_KEY: z.string().min(1),
    DEEPGRAM_API_KEY: z.string().min(1),
    GITHUB_TOKEN: z.string().optional(),
  },
  clientPrefix: "VITE_",
  client: {
    VITE_APP_URL: z.string().min(1),
    VITE_API_URL: z.string().default("https://api.example.com"),
    VITE_SUPABASE_URL: z.string().min(1),
    VITE_SUPABASE_ANON_KEY: z.string().min(1),
    VITE_POSTHOG_API_KEY: isDev ? z.string().optional() : z.string().min(1),
    VITE_POSTHOG_HOST: z.string().default("https://us.i.posthog.com"),
    VITE_SENTRY_DSN: z.string().min(1).optional(),
    VITE_APP_VERSION: z.string().min(1).optional(),
  },
  runtimeEnv: { ...process.env, ...import.meta.env },
  emptyStringAsUndefined: true,
  skipValidation: isCI,
});
```

---

## CORS Middleware

**Location:** `/apps/web/src/middleware/cors.ts`

```typescript
import { createMiddleware } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

export const corsMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
      setResponseHeader(key, value);
    });

    if (request.method === "OPTIONS") {
      throw new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    return next();
  },
);
```

---

## Summary of Best Practices

### Server Functions
- Use builder pattern: `createServerFn().middleware().inputValidator().handler()`
- Always validate input with Zod
- Return consistent success/error objects
- Use `createServerOnlyFn` for server-side factories

### Database
- Create middleware for database connections
- Pass db through context
- Use `prepare: false` for serverless

### Authentication
- Use `createClientOnlyFn` and `createServerOnlyFn` appropriately
- Handle cookies properly in SSR context
- Use route-level `beforeLoad` for protected routes
- Support multiple auth flows (OAuth, magic link)

### Project Structure
- Separate concerns: functions/, middleware/, hooks/, routes/
- Use layout groups (`_view/`) for shared layouts
- Centralize query hooks in `queries.ts`
- Validate environment variables with t3-env

### Forms
- Combine TanStack Form with TanStack Query
- Use field-level validation
- Show mutation states for user feedback
- Validate search params at route level

### State Management
- Use staleTime to control refetching
- Use enabled for conditional queries
- Dynamic refetchInterval for polling
- Integrate QueryClient with router for SSR
