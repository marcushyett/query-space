# Query Space - SQL Analytics Tool

## Overview

Query Space is a PostgreSQL analytics tool built with Next.js that allows you to write SQL queries, visualize data, and explore database schemas. It features a dark, techy interface with keyboard-driven navigation and AI-powered query generation.

## Current Status: Phase 3 Complete

### What's Working Now

**Core Infrastructure:**
- [x] Next.js 14 with TypeScript and App Router
- [x] Ant Design component library with custom dark theme
- [x] Pure black (#000000) background, white text, JetBrains Mono font
- [x] Zustand state management with localStorage persistence
- [x] Comprehensive test suite with Vitest (199 tests)
- [x] GitHub Actions CI (tests, lint, build on Node 18.x and 20.x)

**Phase 1 Features (Complete):**
- [x] PostgreSQL connection management (localStorage-based, stateless)
- [x] SQL editor with Monaco (VS Code's editor)
- [x] SQL syntax highlighting for PostgreSQL
- [x] Query execution via secure API routes
- [x] Results display in table format
- [x] Row count and execution time tracking
- [x] Query history (auto-saves last 50 queries)
- [x] SQL validation with dangerous operation warnings
- [x] Connection string stored in localStorage per session

**Phase 2 Features (Complete):**
- [x] Database schema tree view (left sidebar)
- [x] List all tables grouped by schema
- [x] Search/filter tables by name
- [x] Click table to view details in drawer:
  - [x] Column names and data types
  - [x] Primary/Foreign key indicators
  - [x] NULL/NOT NULL constraints
  - [x] Sample data (first 10 rows)
  - [x] Index information
- [x] Two-panel collapsible layout:
  - [x] Table Browser (260px width, toggleable)
  - [x] Editor + Results (remaining space)
- [x] `Cmd+B` keyboard shortcut to toggle table browser
- [x] `POST /api/tables` - List all tables from information_schema
- [x] `POST /api/table-info` - Get columns, indexes, and sample data

**Keyboard Shortcuts:**
- [x] `Cmd+Enter`: Execute SQL query
- [x] `Cmd+K`: Open connection dialog
- [x] `Cmd+N`: Clear editor (new query)
- [x] `Cmd+B`: Toggle table browser

**Phase 3 Features (Complete):**
- [x] Auto-detect chart type from data types (date -> line, text -> column)
- [x] Column chart (bar chart)
  - Categorical X-axis (text columns)
  - Numeric Y-axis (numeric columns)
  - Multiple Y-axis support
- [x] Line chart
  - Date/time X-axis with formatting
  - Numeric Y-axis
  - Multiple series support
- [x] Chart configuration panel:
  - Chart type selector (column/line)
  - X-axis column picker
  - Y-axis column picker(s) with multi-select
  - Legend display
- [x] Dark theme charts with coordinated color palette
- [x] Auto-suggest chart based on query results
- [x] Tab interface to switch between Table and Chart views

**Libraries Used:**
- Recharts (React charting library)

**Components Built:**
- `VisualizationPanel.tsx` - Chart container and orchestrator
- `ChartSelector.tsx` - UI for selecting chart type and axes
- `ColumnChart.tsx` - Bar chart wrapper (Recharts)
- `LineChart.tsx` - Line chart wrapper (Recharts)

**Utilities Created:**
- `lib/chart-utils.ts` - Data transformation and chart type detection

## Remaining Phases

---

### Phase 4: Query Persistence

**Goal:** Save queries via URL and local history management

**Features to Implement:**
- [ ] URL-based query sharing
  - Base64 encode SQL in URL query parameter (`?q=...`)
  - Load query from URL on page load
  - Update URL when query changes (debounced)
- [ ] Query history drawer (right sidebar)
  - List past queries with timestamps
  - Click to load into editor
  - Delete individual queries
  - Clear all history
- [ ] `Cmd+H` keyboard shortcut to toggle history

**Libraries:**
- nuqs (type-safe URL state management)

**Components to Build:**
- `QueryHistoryDrawer.tsx` - History sidebar component

**Hooks to Create:**
- `useUrlState.ts` - URL query parameter management

---

### Phase 5: AI Query Generation

**Goal:** Generate SQL from natural language using Claude API

**Features to Implement:**
- [ ] AI query modal (`Cmd+K` when connected)
- [ ] Natural language prompt input
- [ ] Claude API key input (optional localStorage persistence)
- [ ] Fetch database schema for AI context
- [ ] Generate PostgreSQL-specific SQL
- [ ] Insert generated SQL into editor (not auto-execute)
- [ ] Display generation errors clearly

**AI Prompt Strategy:**
- Fetch full schema (tables + columns + data types)
- Include sample data for context
- Specify PostgreSQL syntax
- Request only SQL (no explanations)

**API Endpoints to Create:**
- `POST /api/ai-query` - Call Anthropic API with schema context

**Components to Build:**
- `AiQueryButton.tsx` - Modal for AI query generation

**Hooks to Create:**
- `useAiQuery.ts` - AI query generation logic

**Libraries:**
- @anthropic-ai/sdk (Claude API)

---

### Phase 6: Polish & Keyboard Shortcuts

**Goal:** Refine UX and add full keyboard navigation

**Features to Implement:**
- [ ] Complete keyboard shortcuts system:
  - `Cmd+Enter`: Execute query [x]
  - `Cmd+K`: AI query generator (when connected) / Connection dialog (when not)
  - `Cmd+H`: Toggle history
  - `Cmd+B`: Toggle table browser
  - `Cmd+/`: Show shortcuts help
  - `Cmd+N`: New query [x]
  - `Cmd+S`: Save query to history (manual save)
- [ ] Shortcuts help modal
- [ ] Loading states for all async operations
- [ ] Error handling improvements:
  - Toast notifications (Ant Design message)
  - Retry logic for failed queries
  - Better error messages
- [ ] SQL linting in Monaco:
  - Real-time syntax checking
  - Warnings for dangerous operations
  - PostgreSQL-specific validations
- [ ] CSV export for query results
- [ ] Copy query link button
- [ ] Query execution status indicator

**Components to Build:**
- `KeyboardShortcutsHelp.tsx` - Modal showing all shortcuts

**Config Files:**
- `config/shortcuts.ts` - Centralized shortcut definitions

---

### Phase 7: Deployment & Documentation

**Goal:** Deploy to Vercel and create comprehensive docs

**Features to Implement:**
- [ ] Vercel deployment configuration
- [ ] Environment variables guide
- [ ] Comprehensive README:
  - Setup instructions
  - Feature documentation
  - Security best practices
  - Keyboard shortcuts reference
  - Screenshots
- [ ] `.env.example` file
- [ ] Testing across browsers
- [ ] PostgreSQL compatibility testing
- [ ] Performance optimizations:
  - Code splitting (Monaco, Recharts)
  - Query result pagination
  - Schema caching

---

## Technical Architecture

### Technology Stack

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Ant Design (UI components)
- Monaco Editor (SQL editor)
- Recharts (data visualization)
- Zustand (state management)
- react-hotkeys-hook (keyboard shortcuts)
- nuqs (URL state)

**Backend:**
- Next.js API Routes
- node-postgres (pg) - PostgreSQL client
- Anthropic SDK (Claude API)

**Deployment:**
- Vercel (serverless)

### Key Design Decisions

1. **Stateless Architecture**: No server-side state. Connection strings stored in browser localStorage and sent with each request.

2. **Single Connection**: One active connection at a time (matches stateless requirement, simpler UX).

3. **Security Model**:
   - Connection strings in localStorage (user should understand risks)
   - Recommend read-only database users
   - Basic SQL injection prevention
   - 30-second query timeout
   - Dangerous operation warnings (DROP, DELETE, etc.)

4. **Dark Theme**: Pure black (#000000) for minimal eye strain, information-dense layout.

5. **Smart Defaults**: Charts auto-detect type from data, minimal configuration needed.

### File Structure

```
query-space/
├── app/
│   ├── layout.tsx                 # Root layout with dark theme
│   ├── page.tsx                   # Main app page
│   ├── globals.css                # Global styles, antd overrides
│   └── api/
│       ├── query/route.ts         # [x] Execute SQL queries
│       ├── tables/route.ts        # [x] List database tables
│       ├── table-info/route.ts    # [x] Get table schema + sample data
│       └── ai-query/route.ts      # TODO: AI SQL generation
│
├── components/
│   ├── Providers.tsx              # [x] Ant Design ConfigProvider wrapper
│   ├── HomePage.tsx               # [x] Main app container with layout
│   ├── ConnectionDialog.tsx       # [x] Connect to database modal
│   ├── SqlEditor.tsx              # [x] Monaco editor wrapper
│   ├── QueryResults.tsx           # [x] Table view of results
│   ├── TableBrowser.tsx           # [x] Left sidebar - table tree
│   ├── TableDetailDrawer.tsx      # [x] Drawer with column info
│   ├── VisualizationPanel.tsx     # [x] Chart container + config
│   ├── ColumnChart.tsx            # [x] Recharts bar chart
│   ├── LineChart.tsx              # [x] Recharts line chart
│   ├── ChartSelector.tsx          # [x] Chart type/axis selector
│   ├── AiQueryButton.tsx          # TODO: AI generation modal
│   ├── QueryHistoryDrawer.tsx     # TODO: Saved query history
│   └── KeyboardShortcutsHelp.tsx  # TODO: Shortcuts reference
│
├── stores/
│   ├── connectionStore.ts         # [x] Connection state + localStorage
│   ├── queryStore.ts              # [x] Query state + history
│   └── uiStore.ts                 # [x] UI state (drawers, modals)
│
├── hooks/
│   ├── useQuery.ts                # [x] Execute SQL queries
│   ├── useKeyboardShortcuts.ts    # [x] Global keyboard shortcuts
│   ├── useTables.ts               # [x] Fetch table list
│   ├── useTableInfo.ts            # [x] Fetch table details
│   ├── useAiQuery.ts              # TODO: AI query generation
│   └── useUrlState.ts             # TODO: Query URL persistence
│
├── lib/
│   ├── sql-validation.ts          # [x] SQL injection prevention
│   ├── chart-utils.ts             # [x] Chart data transformation
│   ├── db.ts                      # TODO: PostgreSQL utilities
│   ├── ai.ts                      # TODO: Anthropic API wrapper
│   └── storage.ts                 # TODO: localStorage schema
│
├── types/
│   ├── database.ts                # TODO: DB types
│   ├── chart.ts                   # TODO: Chart config types
│   └── storage.ts                 # TODO: Storage types
│
└── config/
    ├── theme.ts                   # [x] Ant Design dark theme
    ├── shortcuts.ts               # TODO: Keyboard shortcut definitions
    └── monaco.ts                  # TODO: Monaco editor config
```

---

## Development Workflow

### Running Locally

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Connecting to PostgreSQL

The app requires a PostgreSQL connection string in this format:

```
postgresql://username:password@host:port/database
```

**Security Recommendations:**
- Create a read-only user (SELECT-only permissions)
- Never use production credentials
- Use localhost databases or dedicated dev/staging instances
- Connection string is stored in browser localStorage (not encrypted)

### Environment Variables

Optional environment variables:

```bash
# Optional: Default Claude API key (if not provided by user)
CLAUDE_API_KEY=your-anthropic-api-key
```

---

## Deployment to Vercel

### Option 1: Vercel CLI (Fastest)

```bash
# Login to Vercel
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

### Option 2: GitHub Integration

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repository
5. Vercel will auto-detect Next.js and deploy

### Vercel Configuration

No special configuration needed. Next.js is auto-detected.

Optional environment variables in Vercel dashboard:
- `CLAUDE_API_KEY` - Default API key for AI features

---

## Security Considerations

### Connection Strings
- Stored in browser localStorage only
- Sent via POST body (not URL params)
- Never logged or stored on server
- User should create read-only DB users

### SQL Execution
- 30-second query timeout
- Basic injection prevention
- Warnings for dangerous operations
- Recommend SELECT-only permissions

### Claude API Keys
- Never stored on server
- Optional localStorage persistence (user choice)
- Only transmitted to API route for Claude calls

### URL State
- Queries are base64-encoded (not encrypted)
- Users should be aware shared links contain SQL

---

## Contributing

This is a personal project, but contributions are welcome!

**Before starting work:**
1. Check existing phases/features in this roadmap
2. Open an issue to discuss major changes
3. Follow the established architecture and patterns

**Code Style:**
- TypeScript strict mode
- Functional components with hooks
- Zustand for state management
- Ant Design for UI components
- Dark theme consistency (#000000, #ffffff, #333333)

---

## License

MIT License - See LICENSE file for details

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/marcushyett/query-space/issues
- This is a personal/educational project - support is best-effort

---

**Last Updated:** Phase 3 Complete (2025-12-24)
**Next Milestone:** Phase 4 - Query Persistence
