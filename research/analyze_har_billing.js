const fs = require('fs');

try {
  const har = JSON.parse(fs.readFileSync('erp.baisyi.cn.har', 'utf8'));
  const entries = har.log.entries || [];

  console.log('=== Analyzing Baisiyi Billing & Opening Process from RAW HAR Entries ===');

  function decodeResponse(entry) {
    let txt = entry.response.content?.text || '';
    if (entry.response.content?.encoding === 'base64') {
      txt = Buffer.from(txt, 'base64').toString('utf8');
    }
    return txt;
  }

  const targetKeywords = ['reception', 'customer', 'worksheet', 'dispatch', 'workRoom'];

  for (const entry of entries) {
    const urlStr = entry.request.url;
    const url = new URL(urlStr);
    const pathname = url.pathname;

    if (targetKeywords.some(kw => pathname.includes(kw))) {
      console.log(`\n========================================================================`);
      console.log(`[${entry.request.method}] ${pathname}`);
      console.log(`Full URL: ${urlStr}`);
      console.log(`Response Status: ${entry.response.status}`);

      // Request Headers of interest
      const authHeader = entry.request.headers.find(h => h.name.toLowerCase() === 'authorization');
      if (authHeader) {
        console.log(`Authorization: ${authHeader.value.slice(0, 30)}...`);
      }

      // Request Post Data
      if (entry.request.postData && entry.request.postData.text) {
        try {
          const parsedReq = JSON.parse(entry.request.postData.text);
          console.log('Request Payload:\n', JSON.stringify(parsedReq, null, 2));
        } catch {
          console.log('Request Payload (Raw):\n', entry.request.postData.text);
        }
      }

      // Response Content
      const responseText = decodeResponse(entry);
      if (responseText) {
        try {
          const parsedRes = JSON.parse(responseText);
          console.log('Response Payload:\n', JSON.stringify(parsedRes, null, 2).slice(0, 3000));
        } catch {
          console.log('Response Payload (Raw):\n', responseText.slice(0, 1000));
        }
      }
    }
  }

} catch (err) {
  console.error('Error parsing RAW HAR entries:', err);
}
