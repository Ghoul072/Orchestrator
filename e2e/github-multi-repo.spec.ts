import { test, expect } from '@playwright/test'

// Run serially to avoid cross-project state collisions
test.describe.configure({ mode: 'serial' })

test.describe('GitHub multi-repo task UX', () => {
  test('filters tasks by repository and handles unassigned', async ({ page }) => {
    const suffix = Date.now()
    const projectName = `MultiRepo-${suffix}`
    const repoAUrl = `https://github.com/example/repo-a-${suffix}`
    const repoBUrl = `https://github.com/example/repo-b-${suffix}`
    const taskA = `Task A ${suffix}`
    const taskB = `Task B ${suffix}`
    const taskUnassigned = `Task Unassigned ${suffix}`

    // Create project
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('main').getByRole('button', { name: /new project/i }).click()
    await page.getByPlaceholder('My Awesome Project').fill(projectName)
    await page.getByRole('button', { name: /create project/i }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    // Open project
    await page.getByRole('link', { name: projectName }).click()
    await page.waitForLoadState('networkidle')
    const projectUrl = page.url()

    // Go to Repositories and add two repos
    await page.goto(`${projectUrl}/repositories`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: /add repository/i }).first()).toBeVisible()
    await page.getByRole('button', { name: /add repository/i }).first().click()
    await page.getByLabel('Repository URL').fill(repoAUrl)
    await page.getByLabel('Display Name').fill('Repo A')
    await page.getByLabel('Default Branch').fill('main')
    await page.getByRole('button', { name: /add repository/i }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    await page.getByRole('button', { name: /add repository/i }).click()
    await page.getByLabel('Repository URL').fill(repoBUrl)
    await page.getByLabel('Display Name').fill('Repo B')
    await page.getByLabel('Default Branch').fill('main')
    await page.getByRole('button', { name: /add repository/i }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    await expect(page.getByText('Repo A')).toBeVisible()
    await expect(page.getByText('Repo B')).toBeVisible()
    await expect(page.getByText('Token required').first()).toBeVisible()

    // Navigate to Tasks
    await page.goto(`${projectUrl}/tasks`)
    await page.waitForLoadState('networkidle')

    // Helper to create task with repo selection
    const createTask = async (title: string, repoLabel: string) => {
      await page.getByRole('button', { name: /(create task|new task)/i }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.getByPlaceholder('Task title').fill(title)
      const repoSelect = page
        .locator('label:has-text("Repository")')
        .locator('..')
        .locator('button')
        .first()
      await repoSelect.click()
      await page.getByRole('option', { name: repoLabel }).click()
      await page.getByRole('button', { name: /create task/i }).click()
      await expect(page.getByRole('dialog')).toBeHidden()
      await expect(page.getByText(title)).toBeVisible()
    }

    await createTask(taskA, 'Repo A')
    await createTask(taskB, 'Repo B')

    // Unassigned task
    await page.getByRole('button', { name: /(create task|new task)/i }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByPlaceholder('Task title').fill(taskUnassigned)
    await page.getByRole('button', { name: /create task/i }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    // Tabs should include All + repos + Unassigned
    await expect(page.getByRole('tab', { name: 'All' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Repo A' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Repo B' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Unassigned' })).toBeVisible()

    // Repo A tab
    await page.getByRole('tab', { name: 'Repo A' }).click()
    await expect(page.getByText(taskA)).toBeVisible()
    await expect(page.getByText(taskB)).not.toBeVisible()
    await expect(page.getByText(taskUnassigned)).not.toBeVisible()
    await expect(page.getByText('Repo A').first()).toBeVisible()

    // Repo B tab
    await page.getByRole('tab', { name: 'Repo B' }).click()
    await expect(page.getByText(taskB)).toBeVisible()
    await expect(page.getByText(taskA)).not.toBeVisible()

    // Unassigned tab
    await page.getByRole('tab', { name: 'Unassigned' }).click()
    await expect(page.getByText(taskUnassigned)).toBeVisible()
    await expect(page.getByText(taskA)).not.toBeVisible()
    await expect(page.getByText(taskB)).not.toBeVisible()
  })

  test('auto-selects single repository for new tasks', async ({ page }) => {
    const suffix = Date.now()
    const projectName = `SingleRepo-${suffix}`
    const repoUrl = `https://github.com/example/single-${suffix}`
    const taskTitle = `Single Task ${suffix}`

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('main').getByRole('button', { name: /new project/i }).click()
    await page.getByPlaceholder('My Awesome Project').fill(projectName)
    await page.getByRole('button', { name: /create project/i }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await page.getByRole('link', { name: projectName }).click()
    await page.waitForLoadState('networkidle')
    const projectUrl = page.url()

    // Add one repository
    await page.goto(`${projectUrl}/repositories`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: /add repository/i }).first()).toBeVisible()
    await page.getByRole('button', { name: /add repository/i }).first().click()
    await page.getByLabel('Repository URL').fill(repoUrl)
    await page.getByLabel('Display Name').fill('Solo Repo')
    await page.getByRole('button', { name: /add repository/i }).first().click()
    await expect(page.getByRole('dialog')).toBeHidden()

    // Go to tasks and create task (no repo selection)
    await page.goto(`${projectUrl}/tasks`)
    await page.waitForLoadState('networkidle')
    const createButton = page.getByRole('button', { name: /(create task|new task)/i }).first()
    await expect(createButton).toBeVisible()
    await createButton.click()
    await page.getByPlaceholder('Task title').fill(taskTitle)
    await page.getByRole('button', { name: /create task/i }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    // Repo badge should show
    await expect(page.getByText('Solo Repo').first()).toBeVisible()
  })
})
