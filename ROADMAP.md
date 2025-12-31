# Query Space - Product Roadmap

## Vision

Query Space aims to be a modern, open-source SQL analytics platform that rivals enterprise BI tools like Metabase, Superset, and Tableau. This roadmap focuses on three strategic pillars:

1. **Enterprise-Ready Multi-Tenancy** - Multiple databases, users, and organizations with granular access control
2. **Powerful Dashboard Experience** - Shareable, embeddable dashboards optimized for both desktop and mobile
3. **Rich Data Visualization** - Comprehensive chart library with advanced configuration options

---

## Strategic Pillars Overview

### Pillar 1: Multi-Database, Multi-User, Multi-Organization

Modern analytics tools must support complex organizational structures. Based on analysis of Metabase, Superset, and enterprise BI tools, we need:

- **Multiple databases per organization** - Teams often query across staging, production, data warehouses
- **Multiple users per organization** - Collaboration requires team access with varying permission levels
- **Multiple organizations per user** - Consultants, contractors, and power users work across multiple teams

### Pillar 2: Dashboard Functionality

Best-in-class dashboards (Tableau, Power BI, Grafana) offer:

- **Flexible grid-based layouts** - Drag-and-drop positioning with responsive breakpoints
- **Multiple sharing modes** - Internal sharing, public links, embedded analytics
- **Mobile-first design** - Touch-friendly, responsive visualizations that work on any device
- **Easy widget management** - Quick addition of charts, tables, and KPIs

### Pillar 3: Chart Types & Configuration

Modern visualization libraries (ECharts, D3.js, Highcharts) support 20+ chart types. We should offer:

- **Expanded chart types** - Beyond basic line/bar/pie to treemaps, heatmaps, funnels, and more
- **Advanced styling** - Colors, labels, legends, annotations, reference lines
- **Interactivity** - Drill-downs, tooltips, zoom, pan, and data point selection

---

## Phase 1: Multi-Database Support

**Goal:** Allow organizations to connect and manage multiple database connections

### 1.1 Database Connection Management

**Features:**
- [ ] **Database Connections Model** - New `DatabaseConnection` entity linked to Organization
  - Name (user-friendly identifier)
  - Type (PostgreSQL, MySQL, ClickHouse, BigQuery, etc.)
  - Connection string (encrypted with AES-256-GCM)
  - SSL mode configuration
  - Connection pooling settings
  - Read-only enforcement flag
  - Created/updated timestamps

- [ ] **Connection Management UI** - Dedicated settings page for database connections
  - Add new connection wizard with connection testing
  - Edit existing connections
  - Delete connections (with impact analysis - affected projects/queries)
  - Connection health status indicators
  - Last successful connection timestamp

- [ ] **Connection Selector** - Quick switcher in the main query interface
  - Dropdown to select active database for current session
  - Visual indicator showing current connection
  - Recent connections for quick access
  - Connection-specific schema caching

### 1.2 Project-Database Association

**Features:**
- [ ] **Project-Level Database Binding** - Each project linked to specific database(s)
  - Default database per project
  - Optional: allow queries across multiple databases in same project
  - Inherit organization databases or restrict to subset

- [ ] **Query Context Awareness** - Queries know which database they target
  - Store database connection ID with each saved query
  - Prevent execution on wrong database
  - Migration path for existing queries

### 1.3 Database Type Expansion

**Features:**
- [ ] **PostgreSQL** (current - enhance with SSL, pooling)
- [ ] **MySQL / MariaDB** - Second most common SQL database
- [ ] **ClickHouse** - Popular for analytics workloads
- [ ] **SQLite** - For local file-based databases
- [ ] **DuckDB** - Modern embedded analytics database
- [ ] **BigQuery** - Google Cloud data warehouse
- [ ] **Snowflake** - Cloud data platform
- [ ] **Redshift** - AWS data warehouse

**Technical Implementation:**
```typescript
// New Prisma model
model DatabaseConnection {
  id               String       @id @default(cuid())
  organizationId   String
  organization     Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  name             String
  type             DatabaseType
  encryptedConfig  String       // AES-256-GCM encrypted connection details
  isReadOnly       Boolean      @default(true)
  poolSize         Int          @default(5)
  sslMode          SslMode      @default(PREFER)

  isActive         Boolean      @default(true)
  lastTestedAt     DateTime?
  lastTestResult   String?

  projects         Project[]
  queries          Query[]

  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
}

enum DatabaseType {
  POSTGRESQL
  MYSQL
  CLICKHOUSE
  SQLITE
  DUCKDB
  BIGQUERY
  SNOWFLAKE
  REDSHIFT
}

enum SslMode {
  DISABLE
  PREFER
  REQUIRE
  VERIFY_CA
  VERIFY_FULL
}
```

---

## Phase 2: Advanced User & Organization Management

**Goal:** Robust multi-user, multi-organization support with granular permissions

### 2.1 Organization Switching

**Features:**
- [ ] **Organization Selector** - Header dropdown for switching between organizations
  - Show organization name and role
  - Visual distinction between organizations
  - Quick-switch keyboard shortcut (`Cmd+O`)
  - Last active organization remembered

- [ ] **Organization Dashboard** - Landing page per organization
  - Recent projects and queries
  - Team activity feed
  - Quick stats (queries run, active users, etc.)

### 2.2 Enhanced User Roles & Permissions

**Current roles:** ADMIN, MEMBER

**Expanded Role System:**
- [ ] **OWNER** - Full control, billing, can delete organization
- [ ] **ADMIN** - Manage members, connections, settings (cannot delete org)
- [ ] **EDITOR** - Create/edit projects, queries, dashboards, charts
- [ ] **VIEWER** - Read-only access to assigned resources
- [ ] **ANALYST** - Can execute queries but not modify structure

**Granular Permissions Matrix:**

| Permission | Owner | Admin | Editor | Analyst | Viewer |
|------------|-------|-------|--------|---------|--------|
| Delete organization | ✓ | | | | |
| Manage billing | ✓ | | | | |
| Manage members | ✓ | ✓ | | | |
| Manage database connections | ✓ | ✓ | | | |
| Create/delete projects | ✓ | ✓ | ✓ | | |
| Create/edit queries | ✓ | ✓ | ✓ | ✓ | |
| Execute queries | ✓ | ✓ | ✓ | ✓ | |
| Create/edit dashboards | ✓ | ✓ | ✓ | | |
| View dashboards | ✓ | ✓ | ✓ | ✓ | ✓ |
| Export data | ✓ | ✓ | ✓ | ✓ | |

### 2.3 Project-Level Access Control

**Features:**
- [ ] **Project Visibility Settings**
  - Public (all org members can access)
  - Private (only explicitly granted members)
  - Restricted (specific roles required)

- [ ] **Project Member Management**
  - Add/remove users to specific projects
  - Override organization role at project level
  - Project-specific permissions

### 2.4 Team Collaboration Features

**Features:**
- [ ] **Activity Feed** - Audit log of team actions
  - Query executions with user attribution
  - Dashboard/chart modifications
  - Project changes

- [ ] **User Presence** - Show who's currently active
  - Online indicators
  - "Currently viewing" for dashboards/queries

- [ ] **Comments & Annotations**
  - Comments on queries explaining logic
  - Dashboard annotations for context
  - @mention team members

---

## Phase 3: Dashboard Infrastructure

**Goal:** Build robust dashboard foundation with flexible layout system

### 3.1 Dashboard Core

**Features:**
- [ ] **Dashboard CRUD** - Full lifecycle management
  - Create dashboard with name, description
  - Edit dashboard properties
  - Duplicate dashboards
  - Delete with confirmation
  - Dashboard templates (starter layouts)

- [ ] **Dashboard Organization**
  - Folder/collection grouping
  - Tags for categorization
  - Favorites/starred dashboards
  - Recently viewed

### 3.2 Grid Layout System

**Implementation:** React-Grid-Layout for drag-and-drop positioning

**Features:**
- [ ] **12-Column Responsive Grid**
  - Desktop: 12 columns
  - Tablet: 6 columns
  - Mobile: 2 columns
  - Custom breakpoints

- [ ] **Widget Positioning**
  - Drag to reposition
  - Resize handles (corner and edge)
  - Snap-to-grid alignment
  - Minimum/maximum size constraints
  - Lock position option

- [ ] **Layout Modes**
  - Edit mode (drag, resize, configure)
  - View mode (optimized for consumption)
  - Presentation mode (fullscreen, auto-cycle)

### 3.3 Widget Types

**Chart Widget:**
- [ ] Linked to saved query + chart configuration
- [ ] Auto-refresh interval (optional)
- [ ] Click-through to full query view
- [ ] Inline chart type switcher

**Table Widget:**
- [ ] Query results in table format
- [ ] Column visibility toggle
- [ ] Sorting and pagination
- [ ] Compact/comfortable density

**KPI/Metric Widget:**
- [ ] Single value display (big number)
- [ ] Trend indicator (up/down arrow)
- [ ] Comparison to previous period
- [ ] Conditional formatting (thresholds)

**Text/Markdown Widget:**
- [ ] Rich text with markdown support
- [ ] Headers, lists, links
- [ ] Dashboard documentation
- [ ] Section dividers

**Filter Widget:**
- [ ] Global dashboard filters
- [ ] Dropdown, date range, multi-select
- [ ] Filter affects all linked widgets
- [ ] Cascading filters

### 3.4 Dashboard Variables & Filters

**Features:**
- [ ] **Dashboard Variables**
  - Define variables (date range, category, etc.)
  - Use in query SQL: `WHERE date >= {{start_date}}`
  - Variable picker in dashboard header
  - Default values

- [ ] **Cross-Widget Filtering**
  - Click chart segment to filter other widgets
  - Brush selection for date ranges
  - Clear filters button

- [ ] **Filter Persistence**
  - Remember last filter selections
  - Share dashboard with filters in URL
  - Saved filter presets

---

## Phase 4: Dashboard Sharing & Collaboration

**Goal:** Enable sharing dashboards inside and outside the organization

### 4.1 Internal Sharing

**Features:**
- [ ] **Share with Team Members**
  - Share dialog with member selector
  - Permission levels: View, Edit, Admin
  - Email notification on share

- [ ] **Share with Groups/Roles**
  - Share with "All Editors" or custom groups
  - Role-based access inheritance

### 4.2 Public & External Sharing

**Features:**
- [ ] **Public Link Sharing**
  - Generate unique public URL
  - Optional password protection
  - Expiration date setting
  - View count tracking
  - Revoke link anytime

- [ ] **Signed Token Embedding** (like Metabase's static embeds)
  - Server-side JWT generation
  - Embed dashboards in external apps
  - Parameter passing via token
  - Row-level security support
  - Code snippets for React, Vue, vanilla JS

```typescript
// Example embed token generation
interface EmbedTokenPayload {
  dashboardId: string;
  parameters: Record<string, unknown>;
  expiresAt: number;
  permissions: {
    canExport: boolean;
    canDrillDown: boolean;
  };
}

// Generated iframe code
<iframe
  src="https://app.queryspace.io/embed/d/abc123?token=eyJ..."
  width="100%"
  height="600"
  frameborder="0"
/>
```

- [ ] **Embed Appearance Options**
  - Hide header/navigation
  - Custom background color
  - Bordered or borderless
  - Fit to container

### 4.3 Export & Download

**Features:**
- [ ] **Dashboard Export**
  - Export as PDF (print-ready layout)
  - Export as PNG/SVG (high-resolution)
  - Export underlying data as CSV/Excel

- [ ] **Scheduled Reports**
  - Email dashboard snapshots on schedule
  - Daily/weekly/monthly options
  - Custom recipient lists
  - Include summary text

### 4.4 Collaboration Features

**Features:**
- [ ] **Dashboard Comments**
  - Thread-based discussions
  - @mention team members
  - Attach to specific widgets
  - Resolve/unresolve threads

- [ ] **Version History**
  - Track dashboard changes
  - Restore previous versions
  - Compare versions side-by-side
  - Change attribution

- [ ] **Dashboard Alerts**
  - Set threshold alerts on metrics
  - Email/Slack notifications
  - Alert history log

---

## Phase 5: Mobile & Responsive Design

**Goal:** First-class mobile experience for dashboards and queries

### 5.1 Responsive Dashboard Layouts

**Features:**
- [ ] **Mobile-Specific Layouts**
  - Auto-stack widgets vertically on mobile
  - OR define custom mobile arrangement
  - Swipe between dashboard pages

- [ ] **Touch-Optimized Interactions**
  - Tap to drill down
  - Pinch to zoom charts
  - Swipe gestures for navigation
  - Pull-to-refresh

- [ ] **Mobile Widget Adaptations**
  - Simplified chart views
  - Horizontal scroll for wide tables
  - Collapsible sections
  - Thumb-friendly tap targets (44px minimum)

### 5.2 Mobile Query Interface

**Features:**
- [ ] **Mobile SQL Editor**
  - Simplified editor for small screens
  - Query templates/snippets
  - Voice-to-SQL (stretch goal)
  - Recent queries quick access

- [ ] **Mobile Results View**
  - Card-based result display
  - Swipe between rows
  - Pinch-to-zoom tables
  - Quick share results

### 5.3 Progressive Web App (PWA)

**Features:**
- [ ] **PWA Configuration**
  - Add to home screen prompt
  - App icon and splash screen
  - Offline indicator
  - Push notifications for alerts

- [ ] **Offline Capabilities**
  - Cache recently viewed dashboards
  - Queue queries for execution when online
  - Offline mode indicator

### 5.4 Mobile-First Design System

**Features:**
- [ ] **Responsive Breakpoints**
  - Mobile: < 768px
  - Tablet: 768px - 1024px
  - Desktop: > 1024px

- [ ] **Component Adaptations**
  - Bottom sheet modals on mobile
  - Tab bar navigation
  - Floating action buttons
  - Gesture-based interactions

---

## Phase 6: Expanded Chart Types

**Goal:** Support comprehensive visualization library matching enterprise BI tools

### 6.1 Statistical Charts

**Features:**
- [ ] **Scatter Plot**
  - X/Y axis with continuous variables
  - Point size for third dimension
  - Color coding by category
  - Trend lines (linear, polynomial)
  - Correlation coefficient display

- [ ] **Bubble Chart**
  - Scatter with bubble size encoding
  - Three quantitative dimensions
  - Animated transitions
  - Bubble labels

- [ ] **Box Plot (Box & Whisker)**
  - Statistical distribution visualization
  - Quartiles, median, outliers
  - Multiple series comparison
  - Horizontal/vertical orientation

- [ ] **Histogram**
  - Distribution of single variable
  - Configurable bin count
  - Overlay with normal curve
  - Cumulative histogram option

### 6.2 Part-to-Whole Charts

**Features:**
- [ ] **Donut Chart**
  - Pie chart with center cutout
  - Center label (total, percentage)
  - Multiple ring support
  - Exploded segments

- [ ] **Treemap**
  - Hierarchical data as nested rectangles
  - Drill-down navigation
  - Size and color encoding
  - Labels with smart truncation

- [ ] **Sunburst Chart**
  - Radial hierarchical visualization
  - Interactive drill-down
  - Path highlighting
  - Center navigation

### 6.3 Flow & Relationship Charts

**Features:**
- [ ] **Sankey Diagram**
  - Flow between categories
  - Link width proportional to value
  - Interactive highlighting
  - Multi-level flows (source → intermediate → target)

- [ ] **Funnel Chart**
  - Conversion/drop-off visualization
  - Percentage labels
  - Horizontal or vertical orientation
  - Stage comparison

- [ ] **Chord Diagram**
  - Relationships between entities
  - Bidirectional flow visualization
  - Interactive highlighting

### 6.4 Trend & Comparison Charts

**Features:**
- [ ] **Waterfall Chart**
  - Cumulative effect visualization
  - Positive/negative coloring
  - Subtotal bars
  - Starting/ending totals

- [ ] **Bullet Chart**
  - KPI with target comparison
  - Qualitative ranges (poor/good/excellent)
  - Compact space usage
  - Multiple metrics stacked

- [ ] **Sparklines**
  - Inline mini-charts
  - Embed in tables
  - Trend indicators
  - Win/loss bars

### 6.5 Geographic Charts

**Features:**
- [ ] **Choropleth Map**
  - Country/region shading by value
  - Custom GeoJSON boundaries
  - Zoom and pan
  - Tooltip on hover

- [ ] **Bubble Map**
  - Points on geographic map
  - Size encoding for values
  - Clustering for dense data

### 6.6 Specialized Charts

**Features:**
- [ ] **Gauge Chart**
  - Single metric against target
  - Multiple gauge types:
    - Speedometer (arc gauge)
    - Bullet gauge
    - Progress bar
  - Threshold zones (red/yellow/green)

- [ ] **Heatmap**
  - Two-dimensional color matrix
  - Calendar heatmap option
  - Correlation matrix visualization
  - Custom color scales

- [ ] **Radar/Spider Chart**
  - Multi-dimensional comparison
  - Overlapping series
  - Filled or line mode

---

## Phase 7: Advanced Chart Configuration

**Goal:** Provide fine-grained control over chart appearance and behavior

### 7.1 Axis Configuration

**Features:**
- [ ] **X-Axis Options**
  - Label rotation (0°, 45°, 90°)
  - Custom tick intervals
  - Date formatting patterns
  - Logarithmic scale
  - Reversed direction
  - Axis title and units

- [ ] **Y-Axis Options**
  - Min/max bounds (auto or fixed)
  - Multiple Y-axes (dual axis charts)
  - Unit formatting ($, %, K, M, B)
  - Reference lines (target, average)
  - Grid line styling

- [ ] **Axis Formatting**
  - Number formatting (decimals, thousands separator)
  - Date/time formatting
  - Custom prefix/suffix
  - Null value handling

### 7.2 Visual Styling

**Features:**
- [ ] **Color Configuration**
  - Custom color palette selection
  - Color by category (automatic assignment)
  - Color by value (gradient scales)
  - Conditional coloring (thresholds)
  - Opacity control

- [ ] **Predefined Themes**
  - Dark mode optimized palettes
  - Colorblind-friendly palettes
  - Brand color matching
  - High contrast accessibility

- [ ] **Series Styling**
  - Line styles (solid, dashed, dotted)
  - Line width
  - Point markers (circle, square, triangle)
  - Area fill opacity
  - Bar/column width

### 7.3 Labels & Annotations

**Features:**
- [ ] **Data Labels**
  - Show/hide value labels
  - Position (inside, outside, center)
  - Format (value, percentage, both)
  - Smart collision avoidance
  - Minimum threshold to show

- [ ] **Annotations**
  - Add text annotations to charts
  - Point annotations (callouts)
  - Range annotations (highlighted zones)
  - Event markers on timeline

- [ ] **Reference Lines**
  - Horizontal/vertical reference lines
  - Target line with label
  - Average/median lines
  - Custom styled (color, dash pattern)

### 7.4 Legend & Tooltip

**Features:**
- [ ] **Legend Options**
  - Position (top, bottom, left, right)
  - Orientation (horizontal, vertical)
  - Interactive (click to show/hide series)
  - Pagination for many items
  - Custom formatting

- [ ] **Tooltip Configuration**
  - Custom tooltip template
  - Multiple value display
  - Comparison to previous
  - Formatting options
  - Pin tooltip option

### 7.5 Interactivity & Animation

**Features:**
- [ ] **Drill-Down Actions**
  - Click segment to drill into detail
  - Configurable drill paths
  - Breadcrumb navigation
  - Return to overview

- [ ] **Zoom & Pan**
  - Mouse wheel zoom
  - Brush selection for range zoom
  - Pan by drag
  - Reset zoom button

- [ ] **Animation Options**
  - Enable/disable animations
  - Animation duration
  - Animation easing
  - Entrance animations

### 7.6 Chart Calculations

**Features:**
- [ ] **Built-in Calculations**
  - Running total
  - Percent of total
  - Year-over-year change
  - Moving average
  - Cumulative sum

- [ ] **Trend Lines**
  - Linear regression
  - Polynomial fit
  - Exponential smoothing
  - Confidence intervals

- [ ] **Forecasting** (stretch goal)
  - Simple forecasting methods
  - Confidence bands
  - Seasonal decomposition

---

## Implementation Priority

### High Priority (Core Functionality)
1. **Phase 1.1-1.2** - Multi-database connections (foundation for enterprise use)
2. **Phase 3.1-3.3** - Dashboard core and widgets (primary value proposition)
3. **Phase 6.1-6.4** - Key chart types (scatter, funnel, waterfall, heatmap)

### Medium Priority (Differentiation)
4. **Phase 2.1-2.2** - Organization switching and roles (team collaboration)
5. **Phase 4.1-4.2** - Internal and public sharing (virality and adoption)
6. **Phase 7.1-7.3** - Axis and styling configuration (power user features)

### Lower Priority (Polish & Advanced)
7. **Phase 5** - Mobile optimization (after desktop experience is solid)
8. **Phase 4.3-4.4** - Export and advanced collaboration
9. **Phase 6.5-6.6** - Geographic and specialized charts
10. **Phase 7.4-7.6** - Advanced interactivity and calculations

---

## Technical Architecture Considerations

### Database Layer
- Migrate from single `OrganizationSettings.encryptedDatabaseUrl` to `DatabaseConnection` model
- Implement connection pooling per database (pg-pool, mysql2 pool)
- Add database driver abstraction layer for multi-database support
- Schema caching with TTL per database connection

### State Management
- Extend Zustand stores for multi-database context
- Dashboard state with widget positions, filters, variables
- Real-time collaboration state (WebSocket for presence)

### Visualization Library
- **Retain Recharts** for standard charts (line, bar, area, pie, scatter)
- **Add ECharts** for advanced charts (sankey, treemap, heatmap, gauge, map)
- **Consider Visx** for custom/complex visualizations
- Unified chart configuration interface across libraries

### API Design
- RESTful endpoints for CRUD operations
- WebSocket for real-time dashboard updates
- Streaming for large result sets
- Rate limiting per organization

### Security
- Row-level security for shared dashboards
- Signed embed tokens with expiration
- Audit logging for all data access
- Connection credential encryption (maintain AES-256-GCM)

---

## Success Metrics

### Phase 1 Success
- [ ] Organizations can add 5+ database connections
- [ ] Query execution works across all supported database types
- [ ] Connection testing provides clear success/failure feedback

### Dashboard Success
- [ ] Dashboards load in < 2 seconds
- [ ] Mobile layout is usable without horizontal scrolling
- [ ] Public link sharing adoption > 20% of active dashboards

### Visualization Success
- [ ] 15+ chart types available
- [ ] Chart configuration covers 80% of common use cases
- [ ] Positive feedback on chart aesthetics (dark theme consistency)

---

## Research Sources

This roadmap was informed by analysis of leading BI and analytics platforms:

- **Multi-database & Architecture:** [Metabase](https://www.metabase.com/), [Apache Superset](https://superset.apache.org/), [Redash](https://redash.io/)
- **Dashboard Sharing:** [Tableau](https://www.tableau.com/), [Power BI](https://powerbi.microsoft.com/), [Looker](https://cloud.google.com/looker)
- **Mobile Design:** [Grafana](https://grafana.com/), [Datadog](https://www.datadoghq.com/)
- **Visualization Libraries:** [ECharts](https://echarts.apache.org/), [D3.js](https://d3js.org/), [Recharts](https://recharts.org/)

---

**Last Updated:** 2025-12-31
**Document Version:** 2.0 - Complete Rewrite
