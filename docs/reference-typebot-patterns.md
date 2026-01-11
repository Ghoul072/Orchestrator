# Typebot.io Best Practices and Patterns

This document analyzes the typebot.io codebase (specifically `apps/builder/src/`) to extract best practices for building modern Next.js applications.

## Table of Contents

1. [Project Structure Overview](#1-project-structure-overview)
2. [API/Server Patterns](#2-apiserver-patterns)
3. [Database Patterns (Prisma)](#3-database-patterns-prisma)
4. [Authentication (NextAuth)](#4-authentication-nextauth)
5. [Component Architecture](#5-component-architecture)
6. [Form Handling](#6-form-handling)
7. [Error Handling](#7-error-handling)

---

## 1. Project Structure Overview

### Monorepo Architecture

Typebot uses a monorepo structure with:
- `apps/` - Application packages (builder, viewer, docs, landing-page)
- `packages/` - Shared packages (prisma, schemas, ui, lib, etc.)

### Feature-Based Organization

The `apps/builder/src/` follows a feature-based structure:

```
src/
├── app/                    # Next.js App Router (if used)
├── assets/                 # Static assets
├── components/             # Shared UI components
├── features/               # Feature modules
│   ├── auth/
│   ├── workspace/
│   ├── typebot/
│   ├── editor/
│   └── ...
├── helpers/                # Utility functions
│   └── server/             # Server-side helpers
│       ├── context.ts
│       ├── trpc.ts
│       └── routers/
├── hooks/                  # Custom React hooks
├── lib/                    # Third-party library configurations
├── pages/                  # Next.js Pages Router
│   └── api/                # API routes
└── i18n/                   # Internationalization
```

### Feature Module Structure

Each feature follows a consistent pattern:

```
features/typebot/
├── api/                    # tRPC procedures
│   ├── router.ts
│   ├── getTypebot.ts
│   ├── createTypebot.ts
│   └── updateTypebot.ts
├── components/             # React components
├── helpers/                # Feature-specific utilities
├── hooks/                  # Feature-specific hooks
├── providers/              # React Context providers
└── queries/                # Legacy REST API queries (if any)
```

---

## 2. API/Server Patterns

### tRPC Setup

Typebot uses tRPC for type-safe API communication with both internal and public routers.

**File: `/apps/builder/src/helpers/server/trpc.ts`**

```typescript
import * as Sentry from "@sentry/nextjs";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { OpenApiMeta } from "trpc-to-openapi";
import { ZodError } from "zod";
import { fromError } from "zod-validation-error";
import { ClientToastError } from "../../lib/ClientToastError";
import type { Context } from "./context";

const t = initTRPC
  .context<Context>()
  .meta<OpenApiMeta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          logError:
            error.cause instanceof ClientToastError
              ? error.cause.toToast()
              : null,
          zodError:
            error.cause instanceof ZodError
              ? fromError(error.cause).message
              : null,
        },
      };
    },
  });

// Authentication middleware
const isAuthed = t.middleware(({ next, ctx }) => {
  if (!ctx.user?.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }
  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

const sentryMiddleware = t.middleware(Sentry.trpcMiddleware());

export const router = t.router;
export const mergeRouters = t.mergeRouters;

// Public procedure with Sentry tracking
export const publicProcedure = t.procedure.use(sentryMiddleware);

// Authenticated procedure with both Sentry and auth middleware
export const authenticatedProcedure = t.procedure
  .use(sentryMiddleware)
  .use(isAuthed);
```

### Context Creation

**File: `/apps/builder/src/helpers/server/context.ts`**

```typescript
import type { CreateNextContextOptions } from "@trpc/server/adapters/next";
import { getAuthenticatedUser } from "@/features/auth/helpers/getAuthenticatedUser";

export const createContext = async (opts: CreateNextContextOptions) => {
  const user = await getAuthenticatedUser(opts.req, opts.res);

  return {
    user,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
```

### Router Organization

**File: `/apps/builder/src/helpers/server/routers/publicRouter.ts`**

```typescript
import { analyticsRouter } from "@/features/analytics/api/router";
import { billingRouter } from "@/features/billing/api/router";
import { typebotRouter } from "@/features/typebot/api/router";
import { workspaceRouter } from "@/features/workspace/api/router";
import { router } from "../trpc";

export const publicRouter = router({
  analytics: analyticsRouter,
  workspace: workspaceRouter,
  typebot: typebotRouter,
  billing: billingRouter,
  // ... more routers
});
```

### tRPC Procedure Pattern

**File: `/apps/builder/src/features/typebot/api/getTypebot.ts`**

```typescript
import { TRPCError } from "@trpc/server";
import prisma from "@typebot.io/prisma";
import { typebotSchema } from "@typebot.io/typebot/schemas/typebot";
import { z } from "@typebot.io/zod";
import { publicProcedure } from "@/helpers/server/trpc";

export const getTypebot = publicProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/v1/typebots/{typebotId}",
      protect: true,
      summary: "Get a typebot",
      tags: ["Typebot"],
    },
  })
  .input(
    z.object({
      typebotId: z.string().describe("[Where to find my bot's ID?](...)"),
      migrateToLatestVersion: z.boolean().optional().default(false),
    }),
  )
  .output(
    z.object({
      typebot: typebotSchema,
      currentUserMode: z.enum(["guest", "read", "write"]),
    }),
  )
  .query(async ({ input: { typebotId, migrateToLatestVersion }, ctx: { user } }) => {
    const existingTypebot = await prisma.typebot.findFirst({
      where: { id: typebotId },
      include: {
        collaborators: true,
        workspace: {
          select: {
            isSuspended: true,
            isPastDue: true,
            members: { select: { userId: true } },
          },
        },
      },
    });

    if (!existingTypebot?.id || (await isReadTypebotForbidden(existingTypebot, user)))
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Typebot not found",
      });

    // ... processing logic

    return {
      typebot,
      currentUserMode: getTypebotAccessRight(user, existingTypebot),
    };
  });
```

### Feature Router Pattern

**File: `/apps/builder/src/features/typebot/api/router.ts`**

```typescript
import { router } from "@/helpers/server/trpc";
import { createTypebot } from "./createTypebot";
import { deleteTypebot } from "./deleteTypebot";
import { getTypebot } from "./getTypebot";
import { updateTypebot } from "./updateTypebot";
// ... more imports

export const typebotRouter = router({
  createTypebot,
  updateTypebot,
  getTypebot,
  deleteTypebot,
  // ... more procedures
});
```

### Client-Side tRPC Configuration

**File: `/apps/builder/src/lib/queryClient.ts`**

```typescript
import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { createTRPCClient, httpLink, TRPCClientError } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";
import type { AppRouter } from "@/helpers/server/routers/appRouter";
import { toast } from "./toast";

export const showHttpRequestErrorToast = (error: unknown, { context }: { context: string }) => {
  if (error instanceof TRPCClientError) {
    if (error.data?.logError) {
      toast(error.data.logError);
      return;
    }
    if (error.data?.httpStatus === 404) return;
    toast({
      title: context,
      description: error.data?.zodError || error.message || error.data.code,
    });
  }
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) =>
      showHttpRequestErrorToast(error, {
        context: (query.meta?.errorContext as string) || parseDefaultErrorContext(query) || "",
      }),
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      showHttpRequestErrorToast(error, {
        context: (mutation.meta?.errorContext as string) || parseDefaultErrorContext(mutation) || "",
      });
    },
  }),
});

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpLink({
      url: typeof window === "undefined"
        ? `${env.NEXTAUTH_URL}/api/trpc`
        : `${window.location.origin}/api/trpc`,
      transformer: superjson,
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});
```

---

## 3. Database Patterns (Prisma)

### Schema Design

**File: `/packages/prisma/postgresql/schema.prisma`**

Key patterns observed:

#### Use of CUID for IDs

```prisma
model User {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt
  // ...
}
```

#### Soft Delete Pattern

```prisma
model Typebot {
  id         String   @id @default(cuid())
  isArchived Boolean  @default(false)
  // ...
}
```

#### JSON Fields for Flexible Data

```prisma
model Typebot {
  groups     Json
  variables  Json
  edges      Json
  theme      Json
  settings   Json
  // ...
}
```

#### Proper Relations with Cascade Delete

```prisma
model Account {
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

#### Composite Unique Constraints

```prisma
model MemberInWorkspace {
  userId      String
  workspaceId String
  @@unique([userId, workspaceId])
}
```

#### Strategic Indexing

```prisma
model Typebot {
  @@index([workspaceId])
  @@index([isArchived, createdAt(sort: Desc)])
}
```

### Prisma Client Singleton

**File: `/packages/prisma/src/index.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

declare const global: { prisma: PrismaClient };

if (!global.prisma) {
  global.prisma = new PrismaClient();
}

export default global.prisma;
```

### Enum Re-exports

**File: `/packages/prisma/src/enum.ts`**

```typescript
import {
  CollaborationType,
  Plan,
  Prisma,
  WorkspaceRole,
} from "@prisma/client";

const JsonNull = Prisma.JsonNull;
const DbNull = Prisma.DbNull;
const PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError;

export {
  WorkspaceRole,
  Plan,
  CollaborationType,
  JsonNull,
  DbNull,
  PrismaClientKnownRequestError,
};
```

### Query Patterns

**Select only needed fields:**

```typescript
const existingTypebot = await prisma.typebot.findFirst({
  where: { id: typebotId },
  select: {
    id: true,
    customDomain: true,
    publicId: true,
    collaborators: {
      select: { userId: true, type: true },
    },
    workspace: {
      select: {
        id: true,
        plan: true,
        members: { select: { userId: true, role: true } },
      },
    },
  },
});
```

**Use include for relations:**

```typescript
const workspace = await prisma.workspace.findFirst({
  where: { id: workspaceId },
  include: { members: true },
});
```

---

## 4. Authentication (NextAuth)

### NextAuth v5 Configuration

**File: `/apps/builder/src/features/auth/lib/nextAuth.ts`**

```typescript
import { env } from "@typebot.io/env";
import prisma from "@typebot.io/prisma";
import NextAuth from "next-auth";
import { createAuthPrismaAdapter } from "../helpers/createAuthPrismaAdapter";
import { providers } from "./providers";

export const {
  auth,
  handlers: authHandlers,
  signIn,
  signOut,
} = NextAuth((req) => ({
  adapter: createAuthPrismaAdapter(prisma),
  secret: env.ENCRYPTION_SECRET,
  providers,
  trustHost: env.VERCEL_GIT_COMMIT_SHA ? undefined : true,
  pages: {
    signIn: "/signin",
    newUser: env.NEXT_PUBLIC_ONBOARDING_TYPEBOT_ID ? "/onboarding" : undefined,
    error: "/signin",
  },
  events: {
    session: async ({ session }) => {
      // Update last activity
      if (!datesAreOnSameDay(session.user.lastActivityAt, new Date())) {
        await prisma.user.updateMany({
          where: { id: session.user.id },
          data: { lastActivityAt: new Date() },
        });
      }
    },
    async signIn({ user, isNewUser }) {
      if (!user.id) return;
      if (isNewUser) return;
      await trackEvents([{ name: "User logged in", userId: user.id }]);
    },
  },
  callbacks: {
    session: async ({ session, user }) => ({
      ...session,
      user: clientUserSchema.parse(user),
    }),
    signIn: async ({ account, user, email }) => {
      // Rate limiting for email sign-in
      if (user.email && email?.verificationRequest) {
        const ip = getIp(req.headers);
        if (oneMinRateLimiter && ip) {
          const { success } = await oneMinRateLimiter.limit(ip);
          if (!success) throw new Error("too-many-requests");
        }
        if (!isEmailLegit(user.email)) throw new Error("email-not-legit");
      }
      // Check for disabled signup
      if (env.DISABLE_SIGNUP && isNewUser && user.email) {
        const { invitations } = await getNewUserInvitations(prisma, user.email);
        if (invitations.length === 0) throw new Error("sign-up-disabled");
      }
      return true;
    },
  },
}));
```

### Provider Configuration

**File: `/apps/builder/src/features/auth/lib/providers.ts`**

```typescript
import { env } from "@typebot.io/env";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import type { Provider } from "next-auth/providers/index";

export const providers: Provider[] = [];

// Conditionally add providers based on environment
if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET)
  providers.push(
    GitHubProvider({
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );

if (env.NEXT_PUBLIC_SMTP_FROM && !env.SMTP_AUTH_DISABLED)
  providers.push(
    Nodemailer({
      server: {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: env.SMTP_USERNAME ? { user: env.SMTP_USERNAME, pass: env.SMTP_PASSWORD } : undefined,
      },
      maxAge: 5 * 60,
      from: env.NEXT_PUBLIC_SMTP_FROM,
      generateVerificationToken: () =>
        Math.floor(100000 + Math.random() * 900000).toString(),
      sendVerificationRequest,
    }),
  );

if (env.GOOGLE_AUTH_CLIENT_ID && env.GOOGLE_AUTH_CLIENT_SECRET)
  providers.push(
    GoogleProvider({
      clientId: env.GOOGLE_AUTH_CLIENT_ID,
      clientSecret: env.GOOGLE_AUTH_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
```

### Custom Prisma Adapter

**File: `/apps/builder/src/features/auth/helpers/createAuthPrismaAdapter.ts`**

```typescript
import type { Adapter } from "@auth/core/adapters";

export const createAuthPrismaAdapter = (p: Prisma.PrismaClient): Adapter => ({
  createUser: async (data) => {
    if (!data.email) throw Error("Provider did not forward email");

    const user = { id: createId(), email: data.email };
    const { invitations, workspaceInvitations } = await getNewUserInvitations(p, user.email);

    // Create user with workspace if no invitations exist
    const createdUser = await p.user.create({
      data: {
        ...data,
        id: user.id,
        workspaces: workspaceInvitations.length > 0 ? undefined : {
          create: {
            role: WorkspaceRole.ADMIN,
            workspace: { create: { name: `${data.name}'s workspace` } },
          },
        },
        onboardingCategories: [],
      },
    });

    // Track events
    await trackEvents([{ name: "User created", userId: createdUser.id }]);

    // Convert invitations
    if (invitations.length > 0)
      await convertInvitationsToCollaborations(p, user, invitations);

    return createdUser as AdapterUser;
  },

  getUser: async (id) => userSchema.parse(await p.user.findUnique({ where: { id } })),

  getUserByEmail: async (email) => {
    const user = await p.user.findUnique({ where: { email } });
    return user ? userSchema.parse(user) : null;
  },
  // ... more adapter methods
});
```

### User Authentication Helper

**File: `/apps/builder/src/features/auth/helpers/getAuthenticatedUser.ts`**

```typescript
import prisma from "@typebot.io/prisma";
import { clientUserSchema } from "@typebot.io/user/schemas";
import { auth } from "../lib/nextAuth";

export const getAuthenticatedUser = async (req, res) => {
  // Support both session-based and API token authentication
  const bearerToken = extractBearerToken(req);
  if (bearerToken) return authenticateByToken(bearerToken);
  return (await auth(req, res))?.user;
};

const authenticateByToken = async (apiToken: string) => {
  const user = await prisma.user.findFirst({
    where: { apiTokens: { some: { token: apiToken } } },
  });
  if (!user) return;
  Sentry.setUser({ id: user.id });
  return clientUserSchema.parse(user);
};
```

### Type Augmentation

**File: `/apps/builder/src/features/auth/next-auth.d.ts`**

```typescript
import type { ClientUser } from "@typebot.io/user/schemas";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: ClientUser;
  }
}
```

---

## 5. Component Architecture

### Provider Pattern

**File: `/apps/builder/src/pages/_app.tsx`**

```typescript
const App = ({ Component, pageProps }: AppProps) => {
  const typebotId = router.query.typebotId?.toString();

  return (
    <TolgeeProvider tolgee={ssrTolgee}>
      <NuqsAdapter>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider>
            <QueryClientProvider client={queryClient}>
              <SessionProvider session={pageProps.session}>
                <UserProvider>
                  <TypebotProvider typebotId={typebotId}>
                    <WorkspaceProvider typebotId={typebotId}>
                      <Component {...pageProps} />
                    </WorkspaceProvider>
                  </TypebotProvider>
                </UserProvider>
              </SessionProvider>
            </QueryClientProvider>
            <ToastProvider toastManager={toastManager}>
              <Toast.List CodeEditor={CodeEditor} />
            </ToastProvider>
          </TooltipProvider>
        </ThemeProvider>
      </NuqsAdapter>
    </TolgeeProvider>
  );
};
```

### Feature Provider Pattern

**File: `/apps/builder/src/features/workspace/WorkspaceProvider.tsx`**

```typescript
const workspaceContext = createContext<{
  workspaces: Pick<Workspace, "id" | "name" | "icon" | "plan">[];
  workspace?: WorkspaceInApp;
  currentUserMode?: "read" | "write" | "guest";
  switchWorkspace: (workspaceId: string) => void;
  createWorkspace: (name?: string) => Promise<void>;
  updateWorkspace: (updates: WorkspaceUpdateProps) => void;
  deleteCurrentWorkspace: () => Promise<void>;
}>({});

export const WorkspaceProvider = ({ typebotId, children }: WorkspaceContextProps) => {
  const { user } = useUser();
  const [workspaceId, setWorkspaceId] = useState<string | undefined>();

  // Fetch workspaces using tRPC + React Query
  const { data: workspacesData } = useQuery(
    trpc.workspace.listWorkspaces.queryOptions(undefined, {
      enabled: !!user,
    }),
  );

  const { data: workspaceData } = useQuery(
    trpc.workspace.getWorkspace.queryOptions(
      { workspaceId: workspaceId as string },
      { enabled: !!workspaceId },
    ),
  );

  // Mutations with optimistic updates
  const createWorkspaceMutation = useMutation(
    trpc.workspace.createWorkspace.mutationOptions({
      onError: (error) => toast({ description: error.message }),
      onSuccess: async () => {
        queryClient.invalidateQueries({
          queryKey: trpc.workspace.listWorkspaces.queryKey(),
        });
      },
    }),
  );

  return (
    <workspaceContext.Provider value={{ workspaces, workspace, /* ... */ }}>
      {children}
    </workspaceContext.Provider>
  );
};

export const useWorkspace = () => useContext(workspaceContext);
```

### State Management with Undo/Redo

**File: `/apps/builder/src/features/editor/providers/TypebotProvider.tsx`**

```typescript
export const TypebotProvider = ({ children, typebotId }: Props) => {
  // Fetch typebot data
  const { data: typebotData, refetch: refetchTypebot } = useQuery(
    trpc.typebot.getTypebot.queryOptions(
      { typebotId: typebotId as string, migrateToLatestVersion: true },
      { enabled: isDefined(typebotId), retry: 0 },
    ),
  );

  // Local state with undo/redo support
  const [
    localTypebot,
    { redo, undo, flush, canRedo, canUndo, set: setLocalTypebot, setUpdateDate },
  ] = useUndo<TypebotV6>(undefined, {
    isReadOnly,
    onUndo: (t) => setElementsCoordinates({ groups: t.groups, events: t.events }),
    onRedo: (t) => setElementsCoordinates({ groups: t.groups, events: t.events }),
  });

  // Auto-save with debounce
  useAutoSave(
    { handler: saveTypebot, item: localTypebot, debounceTimeout: 15000 },
    [saveTypebot, localTypebot],
  );

  // Save on route change
  useEffect(() => {
    Router.events.on("routeChangeStart", saveTypebot);
    return () => Router.events.off("routeChangeStart", saveTypebot);
  }, [saveTypebot]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!areTypebotsEqual(localTypebot, typebot)) {
      window.addEventListener("beforeunload", preventUserFromRefreshing);
    }
    return () => window.removeEventListener("beforeunload", preventUserFromRefreshing);
  }, [localTypebot, typebot, isReadOnly]);

  return (
    <typebotContext.Provider value={{
      typebot: localTypebot,
      save: saveTypebot,
      undo,
      redo,
      canUndo,
      canRedo,
      ...groupsActions(setLocalTypebot),
      ...blocksAction(setLocalTypebot),
      ...variablesAction(setLocalTypebot),
    }}>
      {children}
    </typebotContext.Provider>
  );
};

export const useTypebot = () => useContext(typebotContext);
```

---

## 6. Form Handling

### Simple Form Pattern

**File: `/apps/builder/src/features/workspace/components/AddMemberForm.tsx`**

```typescript
export const AddMemberForm = ({
  workspaceId,
  onNewMember,
  onNewInvitation,
  isLoading,
  isLocked,
}: Props) => {
  const { t } = useTranslate();
  const [invitationEmail, setInvitationEmail] = useState("");
  const [invitationRole, setInvitationRole] = useState<InvitationRole>(WorkspaceRole.MEMBER);
  const [isSendingInvitation, setIsSendingInvitation] = useState(false);

  const handleInvitationSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSendingInvitation(true);

    const { data, error } = await sendInvitationQuery({
      email: invitationEmail,
      type: invitationRole,
      workspaceId,
    });

    if (error) {
      toast({ description: error.message });
    } else {
      setInvitationEmail("");
    }

    if (data?.member) onNewMember(data.member);
    if (data?.invitation) onNewInvitation(data.invitation);
    setIsSendingInvitation(false);
  };

  return (
    <form className="flex items-center gap-2" onSubmit={handleInvitationSubmit}>
      <Input
        placeholder={t("workspace.membersList.inviteInput.placeholder")}
        name="inviteEmail"
        value={invitationEmail}
        onValueChange={setInvitationEmail}
        disabled={isLocked}
      />
      <BasicSelect
        items={[
          { label: "Admin", value: WorkspaceRole.ADMIN },
          { label: "Member", value: WorkspaceRole.MEMBER },
        ]}
        value={invitationRole}
        onChange={setInvitationRole}
      />
      <Button
        type="submit"
        disabled={isLoading || isLocked || invitationEmail === "" || isSendingInvitation}
      >
        {t("workspace.membersList.inviteButton.label")}
      </Button>
    </form>
  );
};
```

### Auto-Save Form Pattern

**File: `/apps/builder/src/features/user/components/MyAccountForm.tsx`**

```typescript
export const MyAccountForm = () => {
  const { user, updateUser } = useUser();
  const [name, setName] = useState(user?.name ?? "");

  const handleNameChange = (newName: string) => {
    setName(newName);
    updateUser({ name: newName }); // Auto-saves with debounce in provider
  };

  return (
    <div className="flex flex-col gap-6">
      <Field.Root>
        <Field.Label>{t("account.myAccount.nameInput.label")}</Field.Label>
        <Input defaultValue={name} onValueChange={handleNameChange} />
      </Field.Root>
    </div>
  );
};
```

### Debounced Input Component

**File: `/apps/builder/src/components/inputs/DebouncedTextInput.tsx`**

```typescript
export const DebouncedTextInput = forwardRef<HTMLInputElement, Props>(
  ({ debounceTimeout = 1000, ...props }, ref) => {
    const commitValue = useDebounce(
      (value: string, eventDetails: ChangeEventDetails) => {
        props.onValueChange?.(value, eventDetails);
      },
      debounceTimeout,
    );

    return (
      <Input
        {...props}
        ref={ref}
        onValueChange={(value, eventDetails) => {
          commitValue(value, eventDetails);
        }}
      />
    );
  },
);
```

### useDebounce Hook

**File: `/apps/builder/src/hooks/useDebounce.ts`**

```typescript
import { useEffect } from "react";
import { useDebouncedCallback } from "use-debounce";

export const useDebounce = <Args extends unknown[], Return>(
  fn: (...args: Args) => Return,
  debounceTimeout: number,
) => {
  const debouncedFn = useDebouncedCallback(fn, debounceTimeout);

  // Flush on unmount
  useEffect(
    () => () => {
      debouncedFn.flush();
    },
    [debouncedFn],
  );

  return debouncedFn;
};
```

### useAutoSave Hook

**File: `/apps/builder/src/hooks/useAutoSave.ts`**

```typescript
export const useAutoSave = <T>(
  { handler, item, debounceTimeout }: {
    handler: () => Promise<any>;
    item?: T;
    debounceTimeout: number;
  },
  dependencies: unknown[],
) => {
  const [debouncedItem] = useDebounce(item, debounceTimeout);

  // Save on visibility change (tab switch)
  useEffect(() => {
    const save = () => handler();
    document.addEventListener("visibilitychange", save);
    return () => document.removeEventListener("visibilitychange", save);
  }, dependencies);

  // Save on debounced item change
  return useEffect(() => {
    handler();
  }, [debouncedItem]);
};
```

---

## 7. Error Handling

### Custom Error Class for Client Toast

**File: `/apps/builder/src/lib/ClientToastError.ts`**

```typescript
import { parseUnknownError } from "@typebot.io/lib/parseUnknownError";

// If thrown on the server, can be correctly parsed in a client error toast
export class ClientToastError extends Error {
  context?: string;
  details?: string;

  constructor({
    description,
    context,
    details,
  }: {
    description: string;
    context?: string;
    details?: string;
  }) {
    super(description);
    this.context = context;
    this.details = details;
  }

  static async fromUnkownError(err: unknown) {
    return new ClientToastError(await parseUnknownError({ err }));
  }

  toToast() {
    return {
      description: this.message,
      context: this.context,
      details: this.details,
    };
  }
}
```

### Error Parsing Utility

**File: `/packages/lib/src/parseUnknownError.ts`**

```typescript
import * as Sentry from "@sentry/nextjs";

export const parseUnknownError = async ({ err, context }: Props): Promise<{
  context?: string;
  description: string;
  details?: string;
}> => {
  try {
    if (typeof err === "string")
      return { context, description: err, details: undefined };

    if (err instanceof Error) {
      const causeMsg = err.cause instanceof Error ? err.cause.message : err.cause;
      return {
        context,
        description: `[${causeMsg}] ${err.message}`,
        details: await extractDetails(err),
      };
    }

    return { context, description: JSON.stringify(err) };
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return { context, description: "Unknown error (failed to parse)" };
  }
};
```

### REST API Error Helpers

**File: `/packages/lib/src/api/utils.ts`**

```typescript
export const methodNotAllowed = (res: NextApiResponse, customMessage?: string) =>
  res.status(405).json({ message: customMessage ?? "Method Not Allowed" });

export const notAuthenticated = (res: NextApiResponse, customMessage?: string) =>
  res.status(401).json({ message: customMessage ?? "Not authenticated" });

export const notFound = (res: NextApiResponse, customMessage?: string) =>
  res.status(404).json({ message: customMessage ?? "Not found" });

export const badRequest = (res: NextApiResponse, customMessage?: any) =>
  res.status(400).json({ message: customMessage ?? "Bad Request" });

export const forbidden = (res: NextApiResponse, customMessage?: string) =>
  res.status(403).json({ message: customMessage ?? "Forbidden" });
```

### tRPC Error Handling

```typescript
// In procedures
if (!existingTypebot?.id || (await isReadTypebotForbidden(existingTypebot, user)))
  throw new TRPCError({
    code: "NOT_FOUND",
    message: "Typebot not found",
  });

// For conflict detection
if (typebot.updatedAt && existingTypebot.updatedAt.getTime() > typebot.updatedAt.getTime())
  throw new TRPCError({
    code: "CONFLICT",
    message: "Found newer version of the typebot in database",
  });

// For validation errors
if (typebot.publicId && (await isPublicIdNotAvailable(typebot.publicId)))
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Public id not available",
  });
```

### Client-Side Error Handling

**File: `/apps/builder/src/lib/queryClient.ts`**

```typescript
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) =>
      showHttpRequestErrorToast(error, {
        context: (query.meta?.errorContext as string) || parseDefaultErrorContext(query) || "",
      }),
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      showHttpRequestErrorToast(error, {
        context: (mutation.meta?.errorContext as string) || parseDefaultErrorContext(mutation) || "",
      });
    },
  }),
});

export const showHttpRequestErrorToast = (error: unknown, { context }: { context: string }) => {
  if (error instanceof TRPCClientError) {
    // Handle custom toast errors from server
    if (error.data?.logError) {
      toast(error.data.logError);
      return;
    }
    // Ignore 404s silently
    if (error.data?.httpStatus === 404) return;
    // Show validation or general errors
    toast({
      title: context,
      description: error.data?.zodError || error.message || error.data.code,
    });
  }
};
```

### Sentry Integration

**File: `/apps/builder/src/instrumentation.ts`**

```typescript
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
```

**File: `/apps/builder/src/pages/_error.tsx`**

```typescript
import * as Sentry from "@sentry/nextjs";
import NextErrorComponent from "next/error";

const CustomErrorComponent = (props) => {
  return <NextErrorComponent statusCode={props.statusCode} />;
};

CustomErrorComponent.getInitialProps = async (contextData) => {
  await Sentry.captureUnderscoreErrorException(contextData);
  return NextErrorComponent.getInitialProps(contextData);
};
```

### Toast System

**File: `/apps/builder/src/lib/toast.tsx`**

```typescript
import { Toast, type AddToastOptions } from "@typebot.io/ui/components/Toast";

export const toastManager = Toast.createToastManager();

export const toast = (props: Omit<AddToastOptions, "type"> & {
  details?: string;
  type?: ToastType;
}) => {
  const parsedDetails = props.details ? parseStrDetails(props.details) : undefined;
  return toastManager.add({
    ...props,
    timeout: props.actionProps
      ? 60000
      : props.details
        ? 30000
        : (props.type ?? "error") === "error"
          ? 8000
          : 5000,
    priority: (props.type ?? "error") === "error" ? "high" : "low",
    data: { details: parsedDetails },
  });
};
```

---

## Summary of Key Patterns

1. **Feature-based organization** - Each feature is self-contained with its own API, components, hooks, and helpers

2. **tRPC for type-safety** - End-to-end type safety between server and client with automatic OpenAPI documentation

3. **Provider pattern** - Context providers for managing global state (user, workspace, typebot)

4. **Optimistic updates** - React Query with cache invalidation for real-time updates

5. **Debounced auto-save** - Automatic saving with debounce to prevent excessive API calls

6. **Comprehensive error handling** - Custom error classes, Sentry integration, and user-friendly toast notifications

7. **Zod validation** - Schema validation at API boundaries with human-readable error messages

8. **Conditional authentication providers** - Dynamic provider configuration based on environment variables

9. **Prisma best practices** - Strategic indexing, cascade deletes, JSON fields for flexibility

10. **Middleware composition** - tRPC middleware for auth, Sentry, and rate limiting
