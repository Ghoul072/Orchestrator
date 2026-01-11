import { test, expect } from '@playwright/test'

// Run tests serially to avoid state conflicts
test.describe.configure({ mode: 'serial' })

test.describe('Orchestrator App', () => {
  test('shows projects page', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('Projects')
  })

  test('can create a project', async ({ page }) => {
    const projectName = `Project-${Date.now()}`

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Click New Project button in main content area
    await page.getByRole('main').getByRole('button', { name: /new project/i }).click()

    // Wait for dialog to open
    await expect(page.getByRole('dialog')).toBeVisible()

    // Fill in project details
    await page.getByPlaceholder('My Awesome Project').fill(projectName)
    await page.getByPlaceholder('A brief description of your project...').fill('A test project')

    // Submit
    await page.getByRole('button', { name: /create project/i }).click()

    // Dialog should close and project should appear
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByRole('link', { name: projectName })).toBeVisible()
  })

  test('project detail page loads with dashboard', async ({ page }) => {
    const projectName = `DetailProject-${Date.now()}`

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('main').getByRole('button', { name: /new project/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByPlaceholder('My Awesome Project').fill(projectName)
    await page.getByRole('button', { name: /create project/i }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    // Click on the project card
    await page.getByRole('link', { name: projectName }).click()

    // Should see the project dashboard with stats
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Total Tasks')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Recent Activity' })).toBeVisible()
  })

  test('can navigate to tasks page and create a task', async ({ page }) => {
    const projectName = `TaskProject-${Date.now()}`
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

    // Navigate to tasks page from sidebar
    await page.getByRole('button', { name: 'Tasks' }).click()
    await page.waitForLoadState('networkidle')

    // Should see empty state with Create Task button
    await expect(page.getByText('No tasks yet')).toBeVisible()

    // Create a task via empty state button
    await page.getByRole('button', { name: /create task/i }).click()

    // Wait for task editor dialog
    await expect(page.getByRole('dialog')).toBeVisible()

    // Fill in task details
    await page.getByPlaceholder('Task title').fill(taskTitle)

    // Submit the task (button says "Create Task")
    await page.getByRole('dialog').getByRole('button', { name: /create task/i }).click()

    // Dialog should close
    await expect(page.getByRole('dialog')).toBeHidden()

    // Task should appear
    await expect(page.getByText(taskTitle)).toBeVisible()
  })

  test('can navigate to meetings page', async ({ page }) => {
    const projectName = `MeetingsProject-${Date.now()}`

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('main').getByRole('button', { name: /new project/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByPlaceholder('My Awesome Project').fill(projectName)
    await page.getByRole('button', { name: /create project/i }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await page.getByRole('link', { name: projectName }).click()
    await page.waitForLoadState('networkidle')

    // Click Meetings button in sidebar
    await page.getByRole('button', { name: 'Meetings' }).click()
    await page.waitForLoadState('networkidle')

    // Should see Meeting Notes heading
    await expect(page.getByRole('heading', { name: /meeting notes/i })).toBeVisible()
  })

  test('can navigate to documents page', async ({ page }) => {
    const projectName = `DocsProject-${Date.now()}`

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('main').getByRole('button', { name: /new project/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByPlaceholder('My Awesome Project').fill(projectName)
    await page.getByRole('button', { name: /create project/i }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await page.getByRole('link', { name: projectName }).click()
    await page.waitForLoadState('networkidle')

    // Click Documents button in sidebar
    await page.getByRole('button', { name: 'Documents' }).click()
    await page.waitForLoadState('networkidle')

    // Should see Documents heading
    await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible()
  })
})
