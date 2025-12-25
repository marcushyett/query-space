import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AiQueryModal } from '../AiQueryModal'
import { useUiStore } from '@/stores/uiStore'
import { useAiStore } from '@/stores/aiStore'
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
    useAiStore.setState({ apiKey: null, persistApiKey: false })
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

    it('should render API key input', () => {
      renderWithProviders(<AiQueryModal />)
      expect(screen.getByPlaceholderText(/sk-ant-/)).toBeInTheDocument()
    })

    it('should render prompt input', () => {
      renderWithProviders(<AiQueryModal />)
      expect(screen.getByPlaceholderText(/Describe the query/i)).toBeInTheDocument()
    })

    it('should render generate and cancel buttons', () => {
      renderWithProviders(<AiQueryModal />)
      expect(screen.getByRole('button', { name: /Generate/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    })

    it('should render persist API key checkbox', () => {
      renderWithProviders(<AiQueryModal />)
      expect(screen.getByText(/Remember API key/i)).toBeInTheDocument()
    })

    it('should show API key from store when persisted', async () => {
      useAiStore.setState({ apiKey: 'sk-ant-saved-key', persistApiKey: true })
      renderWithProviders(<AiQueryModal />)

      // Wait for afterOpenChange to initialize the input with stored value
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/sk-ant-/) as HTMLInputElement
        expect(input.value).toBe('sk-ant-saved-key')
      })
    })

    it('should close dialog when cancel is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AiQueryModal />)

      await user.click(screen.getByRole('button', { name: /Cancel/i }))

      expect(useUiStore.getState().aiModalOpen).toBe(false)
    })

    it('should have disabled generate button when inputs are empty', () => {
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

      const apiKeyInput = screen.getByPlaceholderText(/sk-ant-/)
      const promptInput = screen.getByPlaceholderText(/Describe the query/i)

      await user.type(apiKeyInput, 'sk-ant-test-key')
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

      const apiKeyInput = screen.getByPlaceholderText(/sk-ant-/)
      const promptInput = screen.getByPlaceholderText(/Describe the query/i)

      await user.type(apiKeyInput, 'sk-ant-test-key')
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

      const apiKeyInput = screen.getByPlaceholderText(/sk-ant-/)
      const promptInput = screen.getByPlaceholderText(/Describe the query/i)

      await user.type(apiKeyInput, 'sk-ant-test-key')
      await user.type(promptInput, 'show all users')
      await user.click(screen.getByRole('button', { name: /Generate/i }))

      await waitFor(() => {
        expect(useUiStore.getState().aiModalOpen).toBe(false)
      })
    })

    it('should persist API key when checkbox is checked', async () => {
      const user = userEvent.setup()
      mockGenerateQuery.mockResolvedValueOnce('SELECT * FROM users')

      renderWithProviders(<AiQueryModal />)

      const apiKeyInput = screen.getByPlaceholderText(/sk-ant-/)
      const promptInput = screen.getByPlaceholderText(/Describe the query/i)
      const checkbox = screen.getByRole('checkbox')

      await user.type(apiKeyInput, 'sk-ant-test-key')
      await user.click(checkbox)
      await user.type(promptInput, 'show all users')
      await user.click(screen.getByRole('button', { name: /Generate/i }))

      await waitFor(() => {
        expect(useAiStore.getState().apiKey).toBe('sk-ant-test-key')
        expect(useAiStore.getState().persistApiKey).toBe(true)
      })
    })

    it('should set API key in store before generating', async () => {
      const user = userEvent.setup()
      mockGenerateQuery.mockResolvedValueOnce('SELECT * FROM users')

      renderWithProviders(<AiQueryModal />)

      const apiKeyInput = screen.getByPlaceholderText(/sk-ant-/)
      const promptInput = screen.getByPlaceholderText(/Describe the query/i)

      await user.type(apiKeyInput, 'sk-ant-test-key')
      await user.type(promptInput, 'show all users')
      await user.click(screen.getByRole('button', { name: /Generate/i }))

      // API key should be set before generateQuery is called
      await waitFor(() => {
        expect(useAiStore.getState().apiKey).toBe('sk-ant-test-key')
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

      const apiKeyInput = screen.getByPlaceholderText(/sk-ant-/)
      const promptInput = screen.getByPlaceholderText(/Describe the query/i)

      await user.type(apiKeyInput, 'invalid-key')
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
