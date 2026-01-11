import { test, expect } from '@playwright/test'

test('debug project detail', async ({ page }) => {
  const projectName = `Debug-${Date.now()}`

  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByRole('main').getByRole('button', { name: /new project/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByPlaceholder('My Awesome Project').fill(projectName)
  await page.getByRole('button', { name: /create project/i }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  // Click on the project card
  await page.getByRole('link', { name: projectName }).click()

  // Wait and screenshot
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'e2e/screenshots/project-detail.png' })

  console.log('Page URL:', page.url())
})
