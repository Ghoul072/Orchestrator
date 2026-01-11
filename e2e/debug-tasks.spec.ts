import { test, expect } from '@playwright/test'

test('debug tasks page', async ({ page }) => {
  const projectName = `DebugTasks-${Date.now()}`

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
  await page.waitForTimeout(1000)

  await page.screenshot({ path: 'e2e/screenshots/tasks-page.png' })
  console.log('Page URL:', page.url())
})
