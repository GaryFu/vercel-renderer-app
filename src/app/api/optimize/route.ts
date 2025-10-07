import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { text, isFragment } = await req.json();

  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'DeepSeek API key not configured' }, { status: 500 });
  }

  // Using simple string concatenation to avoid any template literal parsing issues during build.
  const basePrompt = 'You are a world-class LaTeX expert. Your task is to analyze the provided text and correct any structural or syntactical errors to ensure it renders perfectly.' +
    '\nYour final output **must be only the raw, corrected text**. Do **not** wrap your response in Markdown code fences (```) or add any other formatting or explanations.';

  let specificInstructions = '';
  if (isFragment) {
    specificInstructions = '\nThe user has selected a fragment of text for optimization. It is crucial that you **preserve the multi-line structure** of the input. If the input has multiple lines (separated by newlines), the output must also have multiple lines, correctly formatted using a suitable LaTeX environment like `array`. **Do not flatten the structure into a single line.**';
  } else {
    specificInstructions = '\nYour primary focus is to identify multiple, consecutive display math blocks (`$$...$$`) that are clearly intended to be a single, multi-line structure. When you find such a structure, you **must** merge them into a single `$$...$$` block, using a suitable LaTeX environment (e.g., `array`) to preserve the original multi-line vertical layout.';
  }

  const prompt = basePrompt +
    specificInstructions +
    '\n---\nText to process:\n' +
    text +
    '\n---\nCorrected text:\n';

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.0,
        max_tokens: 2048,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('DeepSeek API Error:', errorBody);
      return NextResponse.json({ error: `DeepSeek API error: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    
    if (data.choices && data.choices[0]?.message?.content) {
      let optimizedText = data.choices[0].message.content.trim();
      optimizedText = optimizedText.replace(/^```(?:latex|tex|plain|text)?\s*/, '').replace(/\s*```$/, '');
      return NextResponse.json({ optimizedText });
    } else {
      return NextResponse.json({ error: 'Invalid response structure from DeepSeek API' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error calling DeepSeek API:', error);
    return NextResponse.json({ error: 'Failed to connect to DeepSeek API' }, { status: 500 });
  }
}
