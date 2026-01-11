import { test, expect } from '@playwright/test'

test('debug task creation errors', async ({ page }) => {
  const errors: string[] = []

  // Listen for console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })

  // Listen for page errors
  page.on('pageerror', (err) => {
    errors.push(`Page error: ${err.message}`)
  })

  // Listen for request failures
  page.on('requestfailed', (request) => {
    errors.push(`Request failed: ${request.url()} - ${request.failure()?.errorText}`)
  })

  const projectName = `TaskError-${Date.now()}`
  const taskTitle = `Task-${Date.now()}`

  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByRole('main').getByRole('button', { name: /new project/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByPlaceholder('My Awesome Project').fill(projectName)
  await page.getByRole('button', { name: /create project/i }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.getByRole('link', { name: projectName }).click()
  await page.waitForLoadState('networkidle')

  // Navigate to tasks page
  await page.getByRole('button', { name: 'Tasks' }).click()
  await page.waitForLoadState('networkidle')

  // Create a task
  await page.getByRole('button', { name: /create task/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByPlaceholder('Task title').fill(taskTitle)

  // Click Create Task button
  await page.getByRole('dialog').getByRole('button', { name: /create task/i }).click()
  await page.waitForTimeout(3000)

  // Check for errors
  console.log('Errors:', errors)

  // Screenshot
  await page.screenshot({ path: 'e2e/screenshots/task-error-check.png' })

  // Check if task was created (dialog should close on success)
  const dialogVisible = await page.getByRole('dialog').isVisible()
  console.log('Dialog still visible:', dialogVisible)
})
