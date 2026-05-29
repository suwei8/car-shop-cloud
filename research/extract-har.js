const fs = require('fs');
const har = JSON.parse(fs.readFileSync('erp.baisyi.cn.har','utf8'));
function decode(e){let txt=e.response.content?.text||''; if(e.response.content?.encoding==='base64') txt=Buffer.from(txt,'base64').toString('utf8'); return txt;}
const entries = har.log.entries || [];
const out={requests:[], menus:[], buttons:{}, grids:{}, queries:{}, samples:{}};
for (const e of entries) {
  const url = new URL(e.request.url);
  const path=url.pathname;
  out.requests.push({method:e.request.method, host:url.host, path, query:Object.fromEntries(url.searchParams), status:e.response.status, mime:e.response.content?.mimeType});
  let json=null; try { const txt=decode(e).trim(); if(txt && (txt[0]=='{'||txt[0]=='[')) json=JSON.parse(txt); } catch{}
  if (!json) continue;
  if (path.includes('/api/standardMenu/getPcMenu')) out.menus=json.data||[];
  if (path.includes('/api/standardMenu/getPcButton')) out.buttons=json.data||{};
  if (path.includes('/api/gridd/findList')) out.grids[url.searchParams.get('gridCode')||'unknown']=json.data||[];
  if (path.includes('/api/queryd/findList')) out.queries[url.searchParams.get('conditionCode')||'unknown']=json.data||[];
  const sampleKeys = ['/top/erphome/fixTotal','/top/day/customerReport','/api/workshop/customer','/api/workshop/workRoom','/api/workshop/reception','/api/workshop/dispatch','/api/reserve/page','/api/vehicle/getVehicleList','/api/membersetsalesm/page','/api/valuecardAccount/page','/api/systemParameter/page'];
  for (const k of sampleKeys) if (path.includes(k)) out.samples[k]=json;
}
fs.writeFileSync('research/har-extracted.json', JSON.stringify(out,null,2));
console.log('menus', out.menus.length, 'buttons', Object.keys(out.buttons).length, 'grids', Object.keys(out.grids).length, 'queries', Object.keys(out.queries).length);
console.log('menu names:');
console.log(out.menus.map(m=>`${m.id}\t${m.name}\t${m.ename}`).join('\n'));
console.log('\nGrid summaries:');
for (const [k, cols] of Object.entries(out.grids)) console.log(k, cols.map(c=>c.title).join(' | '));
console.log('\nQuery summaries:');
for (const [k, qs] of Object.entries(out.queries)) console.log(k, qs.map(c=>c.name).join(' | '));
