// scripts/fetch-blog.js
// GitHub Actions 매일 자동 실행 — NewsAPI로 글로벌 마케팅 콘텐츠 수집 → blog-data.json 저장

const fs = require('fs');
const NEWS_API_KEY = process.env.NEWS_API_KEY;

const MARKETING_DOMAINS = [
  'marketingweek.com','adweek.com','thedrum.com','marketingdive.com',
  'campaignlive.co.uk','econsultancy.com','searchengineland.com',
  'contentmarketinginstitute.com','marketingtechnews.net','hubspot.com',
  'techcrunch.com','bloomberg.com','businessinsider.com'
].join(',');

function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function fetchNews(query, category, emoji, options={}){
  const params = new URLSearchParams({
    q: query, language:'en', sortBy:'publishedAt',
    pageSize: options.pageSize||9, apiKey: NEWS_API_KEY
  });
  if(options.domains) params.set('domains', options.domains);
  try{
    const res  = await fetch(`https://newsapi.org/v2/everything?${params}`);
    const data = await res.json();
    if(data.status!=='ok'){ console.warn(`warn [${category}]:`, data.message); return []; }
    return (data.articles||[])
      .filter(a => a.title && a.title!=='[Removed]' && a.url)
      .slice(0, options.pageSize||9)
      .map(a => ({
        title:    a.title.replace(/\s*[-|]\s*[^-|]+$/, '').trim(),
        summary:  (a.description||'').slice(0,200).trim() || 'Click to read the full article.',
        source:   a.source?.name || '',
        date:     a.publishedAt
          ? new Date(a.publishedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
          : '',
        category, emoji, url: a.url
      }));
  }catch(e){ console.warn(`fetch failed [${category}]:`, e.message); return []; }
}

function dedupe(arr){
  const seen = new Set();
  return arr.filter(a => {
    const k = a.title.slice(0,50).toLowerCase();
    if(seen.has(k)) return false;
    seen.add(k); return true;
  });
}

async function main(){
  console.log('Fetching global marketing content via NewsAPI...\n');
  const result = { updated: new Date().toISOString(), news:[], jobs:[], tools:[], events:[] };

  // 1. News — 글로벌 마케팅 전문 매체
  const n1 = await fetchNews(
    'digital marketing OR B2B marketing OR marketing strategy',
    'Industry News','📰',{domains:MARKETING_DOMAINS, pageSize:6});
  await delay(800);
  const n2 = await fetchNews(
    'marketing campaign OR brand strategy OR advertising 2026',
    'Industry News','📰',{pageSize:5});
  result.news = dedupe([...n1,...n2]).slice(0,9);
  console.log(`✓ news: ${result.news.length}`);
  await delay(800);

  // 2. Jobs — 글로벌 마케팅 채용
  const j1 = await fetchNews(
    'CMO hire OR VP marketing OR marketing director appointment 2026',
    'Jobs','💼',{pageSize:5});
  await delay(800);
  const j2 = await fetchNews(
    'marketing jobs remote 2026 OR digital marketing hiring OR marketing career',
    'Jobs','💼',{pageSize:5});
  result.jobs = dedupe([...j1,...j2]).slice(0,9);
  console.log(`✓ jobs: ${result.jobs.length}`);
  await delay(800);

  // 3. Tools — 마케팅 툴/플랫폼
  const t1 = await fetchNews(
    'marketing software launch 2026 OR martech platform OR marketing automation tool',
    'Tools & Tech','🛠',{domains:MARKETING_DOMAINS, pageSize:5});
  await delay(800);
  const t2 = await fetchNews(
    'HubSpot OR Salesforce marketing OR Marketo OR marketing AI tool 2026',
    'Tools & Tech','🛠',{pageSize:5});
  result.tools = dedupe([...t1,...t2]).slice(0,9);
  console.log(`✓ tools: ${result.tools.length}`);
  await delay(800);

  // 4. Events — 마케팅 컨퍼런스/이벤트
  const e1 = await fetchNews(
    'marketing conference 2026 OR marketing summit OR advertising event',
    'Events','🎪',{pageSize:5});
  await delay(800);
  const e2 = await fetchNews(
    'Cannes Lions OR SXSW marketing OR Advertising Week OR Content Marketing World',
    'Events','🎪',{pageSize:5});
  result.events = dedupe([...e1,...e2]).slice(0,9);
  console.log(`✓ events: ${result.events.length}`);

  fs.writeFileSync('blog-data.json', JSON.stringify(result, null, 2));
  console.log('\n✅ blog-data.json saved successfully!');
  console.log(`Total: news(${result.news.length}) jobs(${result.jobs.length}) tools(${result.tools.length}) events(${result.events.length})`);
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });
