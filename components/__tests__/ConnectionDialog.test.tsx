import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectionDialog } from '../ConnectionDialog'
import { useConnectionStore } from '@/stores/connectionStore'
import { useUiStore } from '@/stores/uiStore'
import { ConfigProvider } from 'antd'

// Mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...actual,
    message: {
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
    },
  }
})

const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <ConfigProvider>{component}</ConfigProvider>
  )
}

describe('ConnectionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useConnectionStore.setState({ connectionString: null })
    useUiStore.setState({ connectionDialogOpen: false })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('when closed', () => {
    it('should not render modal content when closed', () => {
      renderWithProviders(<ConnectionDialog />)
      expect(screen.queryByText('Connect to PostgreSQL Database')).not.toBeInTheDocument()
    })
  })

  describe('when open', () => {
    beforeEach(() => {
      useUiStore.setState({ connectionDialogOpen: true })
    })

    it('should render modal with title', () => {
      renderWithProviders(<ConnectionDialog />)
      expect(screen.getByText('Connect to PostgreSQL Database')).toBeInTheDocument()
    })

    it('should render security notice', () => {
      renderWithProviders(<ConnectionDialog />)
      expect(screen.getByText('Security Notice')).toBeInTheDocument()
    })

    it('should render connection string input', () => {
      renderWithProviders(<ConnectionDialog />)
      expect(screen.getByPlaceholderText(/postgresql:\/\/username:password/)).toBeInTheDocument()
    })

    it('should render connect and cancel buttons', () => {
      renderWithProviders(<ConnectionDialog />)
      expect(screen.getByRole('button', { name: /Connect/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    })

    it('should show error when submitting empty connection string', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ConnectionDialog />)

      await user.click(screen.getByRole('button', { name: /Connect/i }))

      expect(screen.getByText('Connection string is required')).toBeInTheDocument()
    })

    it('should show error for invalid connection string format', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ConnectionDialog />)

      const input = screen.getByPlaceholderText(/postgresql:\/\/username:password/)
      await user.type(input, 'invalid-connection-string')
      await user.click(screen.getByRole('button', { name: /Connect/i }))

      expect(screen.getByText(/Invalid connection string format/)).toBeInTheDocument()
    })

    it('should accept valid postgresql:// connection string', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ConnectionDialog />)

      const input = screen.getByPlaceholderText(/postgresql:\/\/username:password/)
      await user.type(input, 'postgresql://user:pass@localhost:5432/db')
      await user.click(screen.getByRole('button', { name: /Connect/i }))

      // Should close dialog and set connection string
      expect(useConnectionStore.getState().connectionString).toBe('postgresql://user:pass@localhost:5432/db')
      expect(useUiStore.getState().connectionDialogOpen).toBe(false)
    })

    it('should accept valid postgres:// connection string', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ConnectionDialog />)

      const input = screen.getByPlaceholderText(/postgresql:\/\/username:password/)
      await user.type(input, 'postgres://user:pass@localhost:5432/db')
      await user.click(screen.getByRole('button', { name: /Connect/i }))

      expect(useConnectionStore.getState().connectionString).toBe('postgres://user:pass@localhost:5432/db')
    })

    it('should close dialog when cancel is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ConnectionDialog />)

      await user.click(screen.getByRole('button', { name: /Cancel/i }))

      expect(useUiStore.getState().connectionDialogOpen).toBe(false)
    })

    it('should clear input and error when dialog closes', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ConnectionDialog />)

      const input = screen.getByPlaceholderText(/postgresql:\/\/username:password/)
      await user.type(input, 'invalid')
      await user.click(screen.getByRole('button', { name: /Connect/i }))

      // Error should be shown
      expect(screen.getByText(/Invalid connection string format/)).toBeInTheDocument()

      // Click cancel
      await user.click(screen.getByRole('button', { name: /Cancel/i }))

      // Reopen dialog
      useUiStore.setState({ connectionDialogOpen: true })

      // Error and input should be cleared (need to re-render)
      renderWithProviders(<ConnectionDialog />)
    })
  })
})
