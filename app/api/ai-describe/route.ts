import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { getClaudeApiKey } from '@/lib/auth/organization-settings'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 30

interface DescribeRequest {
  organizationId: string
  sql: string
  name?: string
}

// POST /api/ai-describe - Generate a description for a SQL query
export async function POST(request: NextRequest) {
  try {
    await requireUser()

    const body: DescribeRequest = await request.json()
    const { organizationId, sql, name } = body

    if (!sql || !sql.trim()) {
      return NextResponse.json(
        { error: 'SQL is required' },
        { status: 400 }
      )
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // Get API key
    const apiKey = await getClaudeApiKey(organizationId)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Claude API key is not configured' },
        { status: 400 }
      )
    }

    const anthropic = new Anthropic({ apiKey })

    const prompt = `Analyze this SQL query and provide:
1. A short description (1-2 sentences) of what the query does
2. If no name is provided, suggest a good name (2-5 words)

SQL:
\`\`\`sql
${sql}
\`\`\`

${name ? `Current name: "${name}"` : 'No name provided.'}

Respond in JSON format only:
{
  "description": "...",
  "suggestedName": "..." (only if no name was provided)
}`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })

    // Parse the response
    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    // Extract JSON from response
    let result: { description?: string; suggestedName?: string }
    try {
      // Try to parse as JSON directly
      result = JSON.parse(content.text)
    } catch {
      // Try to extract JSON from text
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('Could not parse response')
      }
    }

    return NextResponse.json({
      description: result.description || null,
      suggestedName: result.suggestedName || null,
    })
  } catch (error) {
    console.error('AI describe error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate description'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
