import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireUser } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    await requireUser();

    const { sql } = await request.json();

    if (!sql || typeof sql !== 'string') {
      return NextResponse.json(
        { error: 'SQL query is required' },
        { status: 400 }
      );
    }

    // Clean and limit the SQL for the prompt
    const cleanedSql = sql.trim().slice(0, 2000);

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: `Generate a very short, descriptive name (2-5 words) for this SQL query. Just return the name, nothing else. No quotes or punctuation.

SQL:
${cleanedSql}`,
        },
      ],
    });

    const name = (response.content[0] as { type: string; text: string }).text
      .trim()
      .replace(/^["']|["']$/g, '') // Remove quotes
      .slice(0, 100); // Limit length

    return NextResponse.json({ name });
  } catch (error) {
    console.error('Error generating query name:', error);

    // Fallback to a default name if AI fails
    return NextResponse.json({ name: 'Untitled Query' });
  }
}
