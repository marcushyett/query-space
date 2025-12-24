# Query Space

A PostgreSQL analytics tool for writing SQL queries, exploring database schemas, and visualizing data. Built with Next.js, featuring a dark techy interface, keyboard-driven navigation, and AI-powered query generation.

![Status](https://img.shields.io/badge/status-Phase%201%20Complete-green)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

✅ **Phase 1 (Current):**
- SQL editor with syntax highlighting (Monaco Editor)
- Execute PostgreSQL queries with `Cmd+Enter`
- View results in table format with row count and execution time
- Connection management via localStorage (stateless)
- Query history (auto-saves last 50 queries)
- Dark theme (pure black background, JetBrains Mono font)
- SQL validation with dangerous operation warnings

🚧 **Coming Soon:**
- Database schema browser (Phase 2)
- Data visualization with charts (Phase 3)
- URL-based query sharing (Phase 4)
- AI query generation with Claude (Phase 5)

See [ROADMAP.md](./ROADMAP.md) for complete feature list and development plan.

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (local or remote)
- Read-only database user recommended

### Installation

```bash
# Clone the repository
git clone https://github.com/marcushyett/query-space.git
cd query-space

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### First Use

1. **Connect to Database**: Click "Connect" and enter your PostgreSQL connection string:
   ```
   postgresql://username:password@host:port/database
   ```

2. **Write SQL**: Type your query in the editor

3. **Execute**: Press `Cmd+Enter` or click the Execute button

4. **View Results**: Results appear in the table below with row count and execution time

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Enter` | Execute SQL query |
| `Cmd+K` | Open connection dialog |
| `Cmd+N` | Clear editor (new query) |
| `Cmd+H` | Toggle query history _(coming soon)_ |
| `Cmd+B` | Toggle table browser _(coming soon)_ |

## Security

**Important Security Considerations:**

- Connection strings are stored in browser `localStorage`
- Connection strings are sent to API routes for query execution
- **Never use on shared computers**
- **Create read-only database users** (SELECT-only permissions)
- **Never connect to production databases with sensitive data**

The app is designed for local development and analysis on trusted machines.

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Ant Design
- **Editor**: Monaco Editor (VS Code's editor)
- **State**: Zustand with localStorage persistence
- **Charts** _(coming)_: Recharts
- **AI** _(coming)_: Anthropic Claude API
- **Database**: node-postgres (pg)
- **Deployment**: Vercel

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Linting
npm run lint
```

## Deployment

### Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/marcushyett/query-space)

Or use Vercel CLI:

```bash
vercel login
vercel --prod
```

## Project Structure

```
query-space/
├── app/                  # Next.js App Router
│   ├── api/             # API routes (query execution)
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Main app page
├── components/          # React components
├── stores/              # Zustand stores
├── hooks/               # Custom React hooks
├── lib/                 # Utilities
├── config/              # Configuration files
└── types/               # TypeScript types
```

## Contributing

See [ROADMAP.md](./ROADMAP.md) for planned features and development phases.

Issues and pull requests are welcome!

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for:
- Complete feature list (Phases 1-7)
- Technical architecture
- Implementation details
- Security considerations

---

**Current Status**: Phase 1 Complete ✅
**Next Up**: Phase 2 - Table Browser

Built with [Claude Code](https://claude.com/claude-code)
