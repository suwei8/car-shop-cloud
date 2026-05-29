const fs = require('fs');
const har = JSON.parse(fs.readFileSync('erp.baisyi.cn.har','utf8'));
for (const e of har.log.entries) {
  const u = new URL(e.request.url);
  if (!u.hostname.includes('baisyi')) continue;
  const body = e.request.postData?.text;
  if (body || e.request.method !== 'GET') {
    console.log('\n###', e.request.method, u.pathname + u.search, 'status', e.response.status);
    if (body) console.log('REQUEST', body.slice(0,1500));
    let txt=e.response.content?.text||''; if(e.response.content?.encoding==='base64') txt=Buffer.from(txt,'base64').toString('utf8');
    console.log('RESPONSE', txt.replace(/\s+/g,' ').slice(0,1500));
  }
}
