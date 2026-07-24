// scripts/fetch-blog.js
// GitHub Actions에서 실행 — 매일 블로그 콘텐츠를 가져와 blog-data.json에 저장

const fs = require('fs');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const PROMPTS = {
  news: `Search the web for 9 recent global B2B and digital marketing news stories from the past 2 weeks. Return ONLY a valid JSON array (no markdown, no backticks). Each item must have: {"title":"...","summary":"2 clear sentences","source":"publication name","date":"Jul 2026","category":"Industry News","emoji":"📰","url":"https://..."}`,

  trends: `Search the web for 9 significant marketing trends shaping the industry right now in 2026. Return ONLY a valid JSON array (no markdown). Each: {"title":"...","summary":"2 sentences with specifics","source":"...","date":"...","category":"Trends","emoji":"📈","url":"..."}`,

  jobs: `Search the web for 9 notable B2B and digital marketing job openings or hiring trends globally right now. Return ONLY a valid JSON array (no markdown). Each: {"title":"role + company or trend","summary":"2 sentences","source":"...","date":"...","category":"Jobs","emoji":"💼","url":"...","location":"city or Remote"}`,

  tools: `Search the web for 9 noteworthy marketing tools or tech updates launched or updated in 2026. Return ONLY a valid JSON array (no markdown). Each: {"title":"...","summary":"2 sentences with features","source":"...","date":"...","category":"Tools","emoji":"🛠","url":"..."}`
};

async function fetchCategory(cat) {
  console.log(`Fetching: ${cat}...`);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: PROMPTS[cat] }]
      })
    });

    const data = await res.json();
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) throw new Error('No JSON array found');

    const articles = JSON.parse(match[0]);
    console.log(`✓ ${cat}: ${articles.length} articles`);
    return articles;

  } catch (err) {
    console.error(`✗ ${cat} failed:`, err.message);
    return [];
  }
}

async function main() {
  const result = {
    updated: new Date().toISOString(),
    news:    [],
    trends:  [],
    jobs:    [],
    tools:   []
  };

  // 순차 실행 (API rate limit 방지)
  result.news   = await fetchCategory('news');
  result.trends = await fetchCategory('trends');
  result.jobs   = await fetchCategory('jobs');
  result.tools  = await fetchCategory('tools');

  fs.writeFileSync('blog-data.json', JSON.stringify(result, null, 2));
  console.log('\n✅ blog-data.json saved successfully');
  console.log(`Total: news(${result.news.length}) trends(${result.trends.length}) jobs(${result.jobs.length}) tools(${result.tools.length})`);
}

main();
