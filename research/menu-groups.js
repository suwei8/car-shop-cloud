const fs = require('fs');
const data = JSON.parse(fs.readFileSync('research/har-extracted.json','utf8'));
const groups = {};
const rules = [
 ['维修服务',['MaintenanceService','maintenanceService','workshop','worksheet','reserve','reserved','dispatch','offer','wash','insurance','cage','CheckUp','carManagement']],
 ['客户车辆',['Customer','Vehicle','callingFeedback','Warranty','Complaint','EnterpriseWechat']],
 ['会员营销',['market','Coupon','Storevalue','Member','memberset','valuecard','vip','Fans','Business']],
 ['库存配件',['Stock','Inbound','Outbound','Mountings','Warehouse','Purchase','cloudWarehouse','EPC','epc']],
 ['财务薪资',['Financial','Reimbursement','Wage','Salary','Cost']],
 ['报表分析',['Reportforms','Analysis','Analytics','Report']],
 ['系统基础',['System','Basic','Staff','Supplier','Standard','Print','Help','toolbar']]
];
for (const m of data.menus) {
 let hit='其他';
 for (const [g, keys] of rules) if (keys.some(k => (m.ename||'').includes(k) || (m.name||'').includes(k))) { hit=g; break; }
 (groups[hit] ||= []).push(m);
}
for (const [g, arr] of Object.entries(groups)) console.log('\n## '+g+' '+arr.length+'\n'+arr.map(m=>`- ${m.name} (${m.ename})`).join('\n'));
