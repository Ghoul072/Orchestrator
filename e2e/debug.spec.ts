import { test, expect } from '@playwright/test'

test('debug project creation', async ({ page }) => {
  await page.goto('/')

  // Wait for page to load
  await page.waitForLoadState('networkidle')

  // Take screenshot
  await page.screenshot({ path: 'e2e/screenshots/before-click.png' })

  // Find and click New Project button
  const mainContent = page.getByRole('main')
  const newProjectBtn = mainContent.getByRole('button', { name: /new project/i })

  // Check if button exists
  const btnCount = await newProjectBtn.count()
  console.log('New Project button count:', btnCount)

  if (btnCount > 0) {
    await newProjectBtn.click()
    await page.waitForTimeout(1000) // Wait for dialog
    await page.screenshot({ path: 'e2e/screenshots/after-click.png' })
  }

  // Log all visible text
  const pageContent = await page.content()
  console.log('Page HTML length:', pageContent.length)
})
