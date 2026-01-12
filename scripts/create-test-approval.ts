import { db } from '../src/server/db'
import { approvals, tasks } from '../src/server/db/schema'
import { isNotNull } from 'drizzle-orm'

async function main() {
  // Get a task that has a GitHub issue linked
  const [task] = await db
    .select()
    .from(tasks)
    .where(isNotNull(tasks.githubIssueId))
    .limit(1)

  console.log('Task with GitHub issue:', task?.id, task?.title, 'Issue #', task?.githubIssueId)

  const testDiff = `diff --git a/src/auth/jwt.ts b/src/auth/jwt.ts
index abc1234..def5678 100644
--- a/src/auth/jwt.ts
+++ b/src/auth/jwt.ts
@@ -38,6 +38,14 @@ async function validateToken(token: string) {
   try {
     const decoded = jwt.verify(token, process.env.JWT_SECRET)
+    // Add token expiry check
+    if (decoded.exp && decoded.exp < Date.now() / 1000) {
+      throw new Error('Token expired')
+    }
+
+    // Validate token structure
+    if (!decoded.sub || !decoded.iat) {
+      throw new Error('Invalid token structure')
+    }
     return decoded
   } catch (err) {
     throw err
   }
 }`

  // Create test approval
  const [result] = await db
    .insert(approvals)
    .values({
      taskId: task?.id,
      actionType: 'git_push',
      actionDescription: 'Push authentication improvements to feature branch',
      diffContent: testDiff,
      filesAffected: ['src/auth/jwt.ts'],
      status: 'pending',
    })
    .returning()

  console.log('Created approval:', result.id)
  process.exit(0)
}

main().catch(console.error)
