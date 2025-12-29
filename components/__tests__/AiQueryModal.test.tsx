import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AiQueryModal } from '../AiQueryModal'
import { useUiStore } from '@/stores/uiStore'
import { useQueryStore } from '@/stores/queryStore'
import { ConfigProvider } from 'antd'

// Mock the useAiQuery hook
const mockGenerateQuery = vi.fn()
vi.mock('@/hooks/useAiQuery', () => ({
  useAiQuery: () => ({
    generateQuery: mockGenerateQuery,
    isGenerating: false,
    error: null,
    clearError: vi.fn(),
  }),
}))

const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <ConfigProvider>{component}</ConfigProvider>
  )
}

describe('AiQueryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useUiStore.setState({ aiModalOpen: false })
    useQueryStore.setState({ currentQuery: '' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('when closed', () => {
    it('should not render modal content when closed', () => {
      renderWithProviders(<AiQueryModal />)
      expect(screen.queryByText('Generate SQL with AI')).not.toBeInTheDocument()
    })
  })

  describe('when open', () => {
    beforeEach(() => {
      useUiStore.setState({ aiModalOpen: true })
    })

    it('should render modal with title', () => {
      renderWithProviders(<AiQueryModal />)
      expect(screen.getByText('Generate SQL with AI')).toBeInTheDocument()
    })

    it('should render prompt input', () => {
      renderWithProviders(<AiQueryModal />)
      // Matches both desktop and mobile placeholders
      expect(screen.getByPlaceholderText(/Show all users who signed up/i)).toBeInTheDocument()
    })

    it('should render generate and cancel buttons', () => {
      renderWithProviders(<AiQueryModal />)
      expect(screen.getByRole('button', { name: /Generate/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    })

    it('should close dialog when cancel is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AiQueryModal />)

      await user.click(screen.getByRole('button', { name: /Cancel/i }))

      expect(useUiStore.getState().aiModalOpen).toBe(false)
    })

    it('should have disabled generate button when prompt is empty', () => {
      renderWithProviders(<AiQueryModal />)

      const generateButton = screen.getByRole('button', { name: /Generate/i })
      expect(generateButton).toBeDisabled()
    })
  })

  describe('generation', () => {
    beforeEach(() => {
      useUiStore.setState({ aiModalOpen: true })
    })

    it('should call generateQuery with prompt when generate is clicked', async () => {
      const user = userEvent.setup()
      mockGenerateQuery.mockResolvedValueOnce('SELECT * FROM users')

      renderWithProviders(<AiQueryModal />)

      const promptInput = screen.getByPlaceholderText(/Show all users who signed up/i)

      await user.type(promptInput, 'show all users')
      await user.click(screen.getByRole('button', { name: /Generate/i }))

      await waitFor(() => {
        expect(mockGenerateQuery).toHaveBeenCalledWith('show all users')
      })
    })

    it('should insert generated SQL into editor', async () => {
      const user = userEvent.setup()
      mockGenerateQuery.mockResolvedValueOnce('SELECT * FROM users WHERE active = true')

      renderWithProviders(<AiQueryModal />)

      const promptInput = screen.getByPlaceholderText(/Show all users who signed up/i)

      await user.type(promptInput, 'show active users')
      await user.click(screen.getByRole('button', { name: /Generate/i }))

      await waitFor(() => {
        expect(useQueryStore.getState().currentQuery).toBe('SELECT * FROM users WHERE active = true')
      })
    })

    it('should close modal after successful generation', async () => {
      const user = userEvent.setup()
      mockGenerateQuery.mockResolvedValueOnce('SELECT * FROM users')

      renderWithProviders(<AiQueryModal />)

      const promptInput = screen.getByPlaceholderText(/Show all users who signed up/i)

      await user.type(promptInput, 'show all users')
      await user.click(screen.getByRole('button', { name: /Generate/i }))

      await waitFor(() => {
        expect(useUiStore.getState().aiModalOpen).toBe(false)
      })
    })
  })

  describe('error handling', () => {
    beforeEach(() => {
      useUiStore.setState({ aiModalOpen: true })
    })

    it('should not close modal when generation returns null', async () => {
      const user = userEvent.setup()
      mockGenerateQuery.mockResolvedValueOnce(null) // Simulates an error

      renderWithProviders(<AiQueryModal />)

      const promptInput = screen.getByPlaceholderText(/Show all users who signed up/i)

      await user.type(promptInput, 'show all users')
      await user.click(screen.getByRole('button', { name: /Generate/i }))

      await waitFor(() => {
        expect(mockGenerateQuery).toHaveBeenCalled()
      })

      // Modal should still be open
      expect(useUiStore.getState().aiModalOpen).toBe(true)
    })
  })
})
