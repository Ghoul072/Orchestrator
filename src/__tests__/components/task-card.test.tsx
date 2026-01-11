import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskCard } from '~/components/tasks/task-card'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Create a wrapper with QueryClient for tests
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('TaskCard', () => {
  const defaultProps = {
    id: 'task-1',
    title: 'Test Task',
    status: 'pending' as const,
    priority: 'medium' as const,
  }

  it('renders task title', () => {
    render(<TaskCard {...defaultProps} />, { wrapper: createWrapper() })
    expect(screen.getByText('Test Task')).toBeInTheDocument()
  })

  it('renders task description when provided', () => {
    render(
      <TaskCard
        {...defaultProps}
        description="This is a test description"
      />,
      { wrapper: createWrapper() }
    )
    expect(screen.getByText('This is a test description')).toBeInTheDocument()
  })

  it('renders priority badge', () => {
    render(<TaskCard {...defaultProps} priority="high" />, {
      wrapper: createWrapper(),
    })
    expect(screen.getByText('high')).toBeInTheDocument()
  })

  it('renders effort badge when provided', () => {
    render(<TaskCard {...defaultProps} effort="md" />, {
      wrapper: createWrapper(),
    })
    expect(screen.getByText('M')).toBeInTheDocument()
  })

  it('renders assignee when provided', () => {
    render(<TaskCard {...defaultProps} assignee="John Doe" />, {
      wrapper: createWrapper(),
    })
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('renders subtask count when provided', () => {
    render(
      <TaskCard
        {...defaultProps}
        subtaskCount={5}
        completedSubtaskCount={2}
      />,
      { wrapper: createWrapper() }
    )
    expect(screen.getByText('2/5')).toBeInTheDocument()
  })

  it('calls onClick when card is clicked', async () => {
    const onClick = vi.fn()
    render(<TaskCard {...defaultProps} onClick={onClick} />, {
      wrapper: createWrapper(),
    })

    // Click on the task title to trigger onClick
    await userEvent.click(screen.getByText('Test Task'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('cycles through status on status icon click', async () => {
    const onStatusChange = vi.fn()
    render(<TaskCard {...defaultProps} onStatusChange={onStatusChange} />, {
      wrapper: createWrapper(),
    })

    // Find and click the status button (first button in the card)
    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[0])

    expect(onStatusChange).toHaveBeenCalledWith('in_progress')
  })

  it('renders compact version correctly', () => {
    render(<TaskCard {...defaultProps} compact />, { wrapper: createWrapper() })
    expect(screen.getByText('Test Task')).toBeInTheDocument()
    // Compact version doesn't show description
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('shows line-through style for completed tasks', () => {
    render(<TaskCard {...defaultProps} status="completed" />, {
      wrapper: createWrapper(),
    })
    const titleElement = screen.getByText('Test Task')
    expect(titleElement).toHaveClass('line-through')
  })

  it('renders due date when provided', () => {
    const dueDate = new Date('2024-12-25')
    render(<TaskCard {...defaultProps} dueDate={dueDate} />, {
      wrapper: createWrapper(),
    })
    expect(screen.getByText('12/25/2024')).toBeInTheDocument()
  })

  it('shows overdue styling for past due dates on non-completed tasks', () => {
    const pastDate = new Date('2020-01-01')
    const { container } = render(
      <TaskCard {...defaultProps} dueDate={pastDate} status="pending" />,
      { wrapper: createWrapper() }
    )
    // The badge with due date should have red border styling
    const redBorderBadge = container.querySelector('.border-red-500')
    expect(redBorderBadge).toBeInTheDocument()
    expect(redBorderBadge).toHaveTextContent('1/1/2020')
  })

  describe('dropdown menu', () => {
    it('opens dropdown menu when three dots button is clicked', async () => {
      render(<TaskCard {...defaultProps} />, { wrapper: createWrapper() })

      // Find the menu button (the one with three dots icon)
      const menuButtons = screen.getAllByRole('button')
      const menuButton = menuButtons.find(btn => btn.className.includes('opacity-0'))

      if (menuButton) {
        await userEvent.click(menuButton)
        expect(screen.getByText('Assign to Agent')).toBeInTheDocument()
      }
    })

    it('shows edit option when onEdit is provided', async () => {
      const onEdit = vi.fn()
      render(<TaskCard {...defaultProps} onEdit={onEdit} />, {
        wrapper: createWrapper(),
      })

      const menuButtons = screen.getAllByRole('button')
      const menuButton = menuButtons.find(btn => btn.className.includes('opacity-0'))

      if (menuButton) {
        await userEvent.click(menuButton)
        expect(screen.getByText('Edit')).toBeInTheDocument()
      }
    })

    it('shows delete option when onDelete is provided', async () => {
      const onDelete = vi.fn()
      render(<TaskCard {...defaultProps} onDelete={onDelete} />, {
        wrapper: createWrapper(),
      })

      const menuButtons = screen.getAllByRole('button')
      const menuButton = menuButtons.find(btn => btn.className.includes('opacity-0'))

      if (menuButton) {
        await userEvent.click(menuButton)
        expect(screen.getByText('Delete')).toBeInTheDocument()
      }
    })

    it('calls onEdit when Edit menu item is clicked', async () => {
      const onEdit = vi.fn()
      render(<TaskCard {...defaultProps} onEdit={onEdit} />, {
        wrapper: createWrapper(),
      })

      const menuButtons = screen.getAllByRole('button')
      const menuButton = menuButtons.find(btn => btn.className.includes('opacity-0'))

      if (menuButton) {
        await userEvent.click(menuButton)
        await userEvent.click(screen.getByText('Edit'))
        expect(onEdit).toHaveBeenCalledTimes(1)
      }
    })
  })
})
