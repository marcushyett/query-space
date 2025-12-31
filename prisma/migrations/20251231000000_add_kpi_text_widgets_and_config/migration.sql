-- AlterEnum
-- Add new widget types KPI and TEXT to the WidgetType enum
ALTER TYPE "WidgetType" ADD VALUE 'KPI';
ALTER TYPE "WidgetType" ADD VALUE 'TEXT';

-- AlterTable
-- Add config column to dashboard_widgets for widget-specific settings
ALTER TABLE "dashboard_widgets" ADD COLUMN "config" JSONB;
