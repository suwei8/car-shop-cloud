const fs = require('fs');

try {
  const har = JSON.parse(fs.readFileSync('erp.baisyi.cn.har', 'utf8'));
  const entries = har.log.entries || [];

  console.log('=== Inspecting Reception and Customer entries ===');

  for (const entry of entries) {
    const urlStr = entry.request.url;
    if (urlStr.includes('/api/workshop/reception') || urlStr.includes('/api/workshop/customer')) {
      console.log(`\n======================================================`);
      console.log(`URL: ${urlStr}`);
      console.log(`Method: ${entry.request.method}`);
      console.log(`Status: ${entry.response.status}`);
      console.log(`Req headers: ${JSON.stringify(entry.request.headers.filter(h => ['content-type', 'authorization'].includes(h.name.toLowerCase())))}`);
      
      if (entry.request.postData) {
        console.log(`PostData: ${JSON.stringify(entry.request.postData)}`);
      } else {
        console.log('No PostData');
      }

      let resText = entry.response.content?.text || '';
      if (entry.response.content?.encoding === 'base64') {
        resText = Buffer.from(resText, 'base64').toString('utf8');
      }
      console.log(`ResText (truncated): ${resText.slice(0, 1000)}`);
    }
  }
} catch (e) {
  console.error(e);
}
