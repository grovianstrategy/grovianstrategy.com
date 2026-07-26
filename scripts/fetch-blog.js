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

  // 2. Jobs — 마케팅 구인공고만
  const j1 = await fetchNews('"marketing manager" OR "marketing director" OR "content marketer" OR "growth marketer" job','Jobs','💼',{pageSize:5});
  await delay(800);
  const j2 = await fetchNews('"digital marketing" job opening OR "B2B marketing" vacancy OR "CMO" hire 2026','Jobs','💼',{pageSize:5});
  result.jobs = dedupe([...j1,...j2])
    .filter(a=>/market|brand|content|growth|advertis|campaign|seo|social media/i.test(a.title))
    .slice(0,9);
  await downloadImages(result.jobs,'jobs');
  console.log(`✓ jobs: ${result.jobs.length}`);
  await delay(800);

  // 3. Events
  const e1 = await fetchNews('marketing conference 2026 OR marketing summit 2026 OR marketing event','Events','🎪',{pageSize:5});
  await delay(800);
  const e2 = await fetchNews('Cannes Lions OR "Advertising Week" OR "Content Marketing World" OR "SXSW" marketing','Events','🎪',{pageSize:5});
  result.events = dedupe([...e1,...e2])
    .filter(a=>/conference|summit|event|festival|expo|forum|award|cannes|sxsw|advertising week/i.test(a.title+' '+a.summary))
    .slice(0,9);
  await downloadImages(result.events,'events');
  console.log(`✓ events: ${result.events.length}`);

  fs.writeFileSync('blog-data.json', JSON.stringify(result, null, 2));
  console.log('\n✅ blog-data.json + images saved!');
}

main().catch(err=>{ console.error('Fatal:', err); process.exit(1); });
