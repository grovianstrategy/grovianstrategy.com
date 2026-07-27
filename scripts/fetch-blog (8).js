// scripts/fetch-blog.js
const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');

const NEWS_API_KEY = process.env.NEWS_API_KEY;

const MARKETING_DOMAINS = [
  'marketingweek.com','adweek.com','thedrum.com','marketingdive.com',
  'campaignlive.co.uk','econsultancy.com','searchengineland.com',
  'contentmarketinginstitute.com','marketingtechnews.net',
  'techcrunch.com','bloomberg.com','businessinsider.com'
].join(',');

// 이미지 저장 폴더
const IMG_DIR = 'blog-images';
if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR);

function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }

// 이미지 다운로드 → 로컬 저장
function downloadImage(url, filename){
  return new Promise((resolve) => {
    if(!url){ resolve(null); return; }
    const dest = path.join(IMG_DIR, filename);
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, { headers:{ 'User-Agent':'Mozilla/5.0' }, timeout:8000 }, res => {
      if(res.statusCode !== 200){ resolve(null); return; }
      const ext = res.headers['content-type']?.includes('png') ? '.png' : '.jpg';
      const finalDest = dest + ext;
      const file = fs.createWriteStream(finalDest);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(IMG_DIR+'/'+filename+ext); });
      file.on('error', () => { resolve(null); });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

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
        title:    a.title.replace(/\s*[-|]\s*[^-|]+$/,'').trim(),
        summary:  (a.description||'').slice(0,200).trim()||'Click to read the full article.',
        source:   a.source?.name||'',
        date:     a.publishedAt
          ? new Date(a.publishedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
          : '',
        imageUrl: a.urlToImage||null,   // 원본 URL (다운로드용)
        image:    null,                  // 로컬 경로 (다운로드 후 채워짐)
        category, emoji, url: a.url
      }));
  }catch(e){ console.warn(`fetch failed [${category}]:`, e.message); return []; }
}

function dedupe(arr){
  const seen=new Set();
  return arr.filter(a=>{
    const k=a.title.slice(0,50).toLowerCase();
    if(seen.has(k)) return false; seen.add(k); return true;
  });
}

// 기사 배열의 이미지 일괄 다운로드
async function downloadImages(articles, prefix){
  for(let i=0;i<articles.length;i++){
    const a = articles[i];
    if(a.imageUrl){
      const filename = `${prefix}_${i}`;
      a.image = await downloadImage(a.imageUrl, filename);
      if(a.image) console.log(`  img: ${a.image}`);
    }
    delete a.imageUrl; // 원본 URL 제거
    await delay(200);
  }
  return articles;
}

async function main(){
  console.log('Fetching global marketing content...\n');
  const result = { updated: new Date().toISOString(), news:[], jobs:[], events:[] };

  // 1. News
  const n1 = await fetchNews('digital marketing OR B2B marketing OR marketing strategy','Industry News','📰',{domains:MARKETING_DOMAINS,pageSize:6});
  await delay(800);
  const n2 = await fetchNews('marketing campaign OR brand marketing OR advertising','Industry News','📰',{pageSize:5});
  result.news = dedupe([...n1,...n2]).slice(0,9);
  await downloadImages(result.news,'news');
  console.log(`✓ news: ${result.news.length}`);
  await delay(800);

  // 2. Jobs — 마케팅 구인공고 (LinkedIn 포함)
  const JOBS_DOMAINS = 'linkedin.com,indeed.com,glassdoor.com,builtinnyc.com,marketingweek.com,adweek.com';
  const j1 = await fetchNews(
    '"marketing manager" job OR "marketing director" job OR "content marketer" job',
    'Jobs','💼',{pageSize:5, domains: JOBS_DOMAINS});
  await delay(800);
  const j2 = await fetchNews(
    '"digital marketing" job opening OR "B2B marketing" vacancy OR "CMO" hire 2026',
    'Jobs','💼',{pageSize:5});
  await delay(800);
  const j3 = await fetchNews(
    'marketing jobs LinkedIn 2026 OR marketing career hiring OR marketing role remote',
    'Jobs','💼',{pageSize:4});
  result.jobs = dedupe([...j1,...j2,...j3])
    .filter(a=>/market|brand|content|growth|advertis|campaign|seo|social media|digital/i.test(a.title))
    .map(a=>({...a, showSource:true}))
    .slice(0,9);
  await downloadImages(result.jobs,'jobs');
  console.log(`✓ jobs: ${result.jobs.length}`);
  await delay(800);

  // 3. Events — B2B IT / AI / Tech 행사 (국가 정보 포함)
  const e1 = await fetchNews(
    'B2B tech conference 2026 OR enterprise IT summit 2026 OR AI conference 2026',
    'Events','🎪',{pageSize:6});
  await delay(800);
  const e2 = await fetchNews(
    'AWS re:Invent OR Salesforce Dreamforce OR Google Cloud Next OR Microsoft Ignite OR NVIDIA GTC OR Databricks Data AI Summit OR Gartner IT symposium 2026',
    'Events','🎪',{pageSize:5});
  await delay(800);
  const e3 = await fetchNews(
    'SaaS Summit OR MarTech conference 2026 OR technology expo 2026 OR AI summit 2026 OR cloud computing event',
    'Events','🎪',{pageSize:5});
  const allEvents = dedupe([...e1,...e2,...e3])
    .filter(a=>/conference|summit|event|expo|forum|symposium|summit|launch|keynote|congress|festival|re:invent|dreamforce|ignite|gtc|next|inbound/i.test(a.title+' '+a.summary));

  // 국가 추출 함수
  function extractCountry(title, summary, url){
    const text = (title+' '+summary+' '+(url||'')).toLowerCase();
    if(/las vegas|nevada|san francisco|san jose|new york|chicago|seattle|boston|austin|\busa\b|\bus\b|united states/i.test(text)) return '🇺🇸 USA';
    if(/london|manchester|birmingham|\buk\b|united kingdom|britain/i.test(text)) return '🇬🇧 UK';
    if(/berlin|munich|frankfurt|hamburg|germany|deutschland/i.test(text)) return '🇩🇪 Germany';
    if(/paris|france/i.test(text)) return '🇫🇷 France';
    if(/amsterdam|netherlands|holland/i.test(text)) return '🇳🇱 Netherlands';
    if(/barcelona|madrid|spain/i.test(text)) return '🇪🇸 Spain';
    if(/singapore/i.test(text)) return '🇸🇬 Singapore';
    if(/tokyo|japan/i.test(text)) return '🇯🇵 Japan';
    if(/dubai|uae/i.test(text)) return '🇦🇪 UAE';
    if(/sydney|australia/i.test(text)) return '🇦🇺 Australia';
    if(/toronto|canada/i.test(text)) return '🇨🇦 Canada';
    if(/virtual|online|remote|worldwide|global/i.test(text)) return '🌐 Online/Global';
    return '🌍 Global';
  }

  result.events = allEvents
    .map(a => ({
      ...a,
      location: extractCountry(a.title, a.summary, a.url)
    }))
    .slice(0,9);
  await downloadImages(result.events,'events');
  console.log(`✓ events: ${result.events.length}`);

  fs.writeFileSync('blog-data.json', JSON.stringify(result, null, 2));
  console.log('\n✅ blog-data.json + images saved!');
}

main().catch(err=>{ console.error('Fatal:', err); process.exit(1); });
