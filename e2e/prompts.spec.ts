import { test, expect } from '@playwright/test'

test('prompts page loads correctly', async ({ page }) => {
  // Navigate to prompts page
  await page.goto('/prompts')

  // Should show the page title
  await expect(page.getByRole('heading', { name: 'Prompt Library' })).toBeVisible()

  // Should show the New Prompt button
  await expect(page.getByRole('button', { name: /New Prompt/i })).toBeVisible()

  // Should show the search input
  await expect(page.getByPlaceholder('Search prompts...')).toBeVisible()

  // Should show the category filter
  await expect(page.getByRole('combobox')).toBeVisible()
})

test('can create a prompt', async ({ page }) => {
  // Capture console errors
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  // Use unique name for this test run
  const uniqueName = `Test Prompt ${Date.now()}`

  await page.goto('/prompts')

  // Wait for page to be fully loaded (including client-side hydration)
  await expect(page.getByRole('heading', { name: 'Prompt Library' })).toBeVisible()
  await page.waitForLoadState('networkidle')

  // Wait for data to load (either shows "No prompts yet" or the prompts list)
  await page.waitForTimeout(1000)

  // Click the New Prompt button in the header (always visible)
  const newPromptButton = page.locator('header button:has-text("New Prompt"), div:has(h1) button:has-text("New Prompt")').first()
  // Fallback to any button containing "New Prompt" or "Create Prompt"
  if (!(await newPromptButton.isVisible().catch(() => false))) {
    // If there's a "Create Prompt" button (empty state), use that
    await page.getByRole('button', { name: /Create Prompt|New Prompt/i }).first().click({ force: true })
  } else {
    await newPromptButton.click({ force: true })
  }

  // Wait for dialog
  await page.waitForTimeout(2000)

  // Debug
  console.log('Console errors:', consoleErrors)
  await page.screenshot({ path: '/tmp/prompt-debug.png', fullPage: true })

  // Check for the dialog by looking for the DialogContent container
  const dialogContent = page.locator('[role="dialog"]')
  const isVisible = await dialogContent.isVisible().catch(() => false)
  console.log('Dialog visible:', isVisible)

  // If not visible, check the HTML for dialog elements
  const html = await page.content()
  console.log('Has dialog role:', html.includes('role="dialog"'))
  console.log('Has name input:', html.includes('id="name"'))

  // Should show the editor dialog
  await expect(dialogContent).toBeVisible({ timeout: 10000 })

  // Fill in the form
  await page.locator('input[id="name"]').fill(uniqueName)
  await page.locator('input[id="description"]').fill('A test prompt template')
  await page.locator('textarea[id="content"]').fill('Analyze this {{code}} and provide {{format}} output')

  // Click Extract Variables button
  await page.getByRole('button', { name: 'Extract Variables' }).click()

  // Wait a moment for variables to be extracted
  await page.waitForTimeout(500)

  // Should show extracted variables as badges
  await expect(page.locator('.bg-secondary:has-text("{{code}}")')).toBeVisible()
  await expect(page.locator('.bg-secondary:has-text("{{format}}")')).toBeVisible()

  // Submit the form
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  // Wait for dialog to close or toast to appear
  await page.waitForTimeout(2000)

  // Should show the new prompt in the list
  await expect(page.getByText(uniqueName).first()).toBeVisible({ timeout: 10000 })
})
