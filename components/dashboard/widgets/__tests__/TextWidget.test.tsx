import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TextWidget } from '../TextWidget'
import { DashboardWidget } from '@/stores/dashboardStore'
import { ConfigProvider } from 'antd'

const createTextWidget = (content: string): DashboardWidget => ({
  id: 'text-1',
  type: 'TEXT',
  positionX: 0,
  positionY: 0,
  width: 12,
  height: 2,
  title: null,
  config: { content },
  chart: null,
  query: null,
})

const renderWithProviders = (component: React.ReactNode) => {
  return render(<ConfigProvider>{component}</ConfigProvider>)
}

describe('TextWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('markdown rendering', () => {
    it('should render plain text', () => {
      const widget = createTextWidget('Hello, World!')
      renderWithProviders(<TextWidget widget={widget} />)
      expect(screen.getByText('Hello, World!')).toBeInTheDocument()
    })

    it('should render h1 headings', () => {
      const widget = createTextWidget('# Main Heading')
      renderWithProviders(<TextWidget widget={widget} />)
      expect(screen.getByRole('heading', { level: 1, name: 'Main Heading' })).toBeInTheDocument()
    })

    it('should render h2 headings', () => {
      const widget = createTextWidget('## Section Heading')
      renderWithProviders(<TextWidget widget={widget} />)
      expect(screen.getByRole('heading', { level: 2, name: 'Section Heading' })).toBeInTheDocument()
    })

    it('should render h3 headings', () => {
      const widget = createTextWidget('### Sub Section')
      renderWithProviders(<TextWidget widget={widget} />)
      expect(screen.getByRole('heading', { level: 3, name: 'Sub Section' })).toBeInTheDocument()
    })

    it('should render bold text', () => {
      const widget = createTextWidget('This is **bold** text')
      renderWithProviders(<TextWidget widget={widget} />)
      expect(screen.getByText('bold')).toHaveStyle({ fontWeight: 600 })
    })

    it('should render italic text', () => {
      const widget = createTextWidget('This is *italic* text')
      renderWithProviders(<TextWidget widget={widget} />)
      const italicText = screen.getByText('italic')
      expect(italicText.tagName).toBe('EM')
    })

    it('should render unordered lists', () => {
      const widget = createTextWidget('- Item 1\n- Item 2\n- Item 3')
      renderWithProviders(<TextWidget widget={widget} />)
      expect(screen.getByRole('list')).toBeInTheDocument()
      expect(screen.getAllByRole('listitem')).toHaveLength(3)
    })

    it('should render ordered lists', () => {
      const widget = createTextWidget('1. First\n2. Second\n3. Third')
      renderWithProviders(<TextWidget widget={widget} />)
      expect(screen.getByRole('list')).toBeInTheDocument()
      expect(screen.getAllByRole('listitem')).toHaveLength(3)
    })

    it('should render links with correct attributes', () => {
      const widget = createTextWidget('[Visit Site](https://example.com)')
      renderWithProviders(<TextWidget widget={widget} />)
      const link = screen.getByRole('link', { name: 'Visit Site' })
      expect(link).toHaveAttribute('href', 'https://example.com')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('should render inline code', () => {
      const widget = createTextWidget('Use `const` for constants')
      renderWithProviders(<TextWidget widget={widget} />)
      const code = screen.getByText('const')
      expect(code.tagName).toBe('CODE')
    })

    it('should render code blocks', () => {
      const widget = createTextWidget('```\nconst x = 1;\nconst y = 2;\n```')
      const { container } = renderWithProviders(<TextWidget widget={widget} />)
      expect(container.querySelector('pre')).toBeInTheDocument()
    })

    it('should render blockquotes', () => {
      const widget = createTextWidget('> This is a quote')
      const { container } = renderWithProviders(<TextWidget widget={widget} />)
      expect(container.querySelector('blockquote')).toBeInTheDocument()
    })

    it('should render horizontal rules', () => {
      const widget = createTextWidget('Above\n\n---\n\nBelow')
      const { container } = renderWithProviders(<TextWidget widget={widget} />)
      expect(container.querySelector('hr')).toBeInTheDocument()
    })
  })

  describe('empty content', () => {
    it('should show placeholder for empty content', () => {
      const widget = createTextWidget('')
      renderWithProviders(<TextWidget widget={widget} />)
      expect(screen.getByText('No content')).toBeInTheDocument()
    })

    it('should show placeholder for whitespace-only content', () => {
      const widget = createTextWidget('   ')
      renderWithProviders(<TextWidget widget={widget} />)
      expect(screen.getByText('No content')).toBeInTheDocument()
    })

    it('should handle null config', () => {
      const widget: DashboardWidget = {
        id: 'text-1',
        type: 'TEXT',
        positionX: 0,
        positionY: 0,
        width: 12,
        height: 2,
        title: null,
        config: null,
        chart: null,
        query: null,
      }
      renderWithProviders(<TextWidget widget={widget} />)
      expect(screen.getByText('No content')).toBeInTheDocument()
    })
  })

  describe('styling', () => {
    it('should have scrollable content container', () => {
      const widget = createTextWidget('Test content')
      const { container } = renderWithProviders(<TextWidget widget={widget} />)
      const contentDiv = container.querySelector('.text-widget-content')
      expect(contentDiv).toHaveStyle({ overflow: 'auto' })
    })
  })
})
