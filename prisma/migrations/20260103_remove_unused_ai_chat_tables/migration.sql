-- Drop the unused AIChat tables
-- These tables were never populated as the system uses agent_sessions and agent_events instead

-- First drop the child table (has foreign key to ai_chats)
DROP TABLE IF EXISTS "ai_chat_messages";

-- Then drop the parent table
DROP TABLE IF EXISTS "ai_chats";

-- Also drop the MessageRole enum if it's no longer used
DROP TYPE IF EXISTS "MessageRole";
