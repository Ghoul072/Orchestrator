import { test, expect } from '@playwright/test'

test('debug create task', async ({ page }) => {
  const projectName = `TaskDebug-${Date.now()}`
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
  await page.screenshot({ path: 'e2e/screenshots/task-dialog-filled.png' })

  // Click Create Task button inside dialog
  await page.getByRole('dialog').getByRole('button', { name: /create task/i }).click()
  await page.waitForTimeout(2000)

  // Screenshot after creation
  await page.screenshot({ path: 'e2e/screenshots/task-after-create.png' })

  console.log('Task title:', taskTitle)
  console.log('Page URL:', page.url())
})
