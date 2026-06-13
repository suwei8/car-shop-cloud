/**
 * 预置服务项目库数据
 * 分类：洗美(wash)、保养(maintenance)、维修(repair)、轮胎(tire)
 * 价格为默认值，商户可自行修改
 */
export const SERVICE_ITEMS = [
  // ===== 洗美 =====
  { name: '标准洗车', category: 'wash', unit: '次', unitPrice: '30.00', description: '外观清洗+内饰简单整理' },
  { name: '精洗', category: 'wash', unit: '次', unitPrice: '80.00', description: '内外深度清洁' },
  { name: '打蜡', category: 'wash', unit: '次', unitPrice: '200.00', description: '全车手工打蜡' },
  { name: '内饰清洗', category: 'wash', unit: '次', unitPrice: '150.00', description: '座椅/地毯/顶棚深度清洁' },
  { name: '发动机舱清洗', category: 'wash', unit: '次', unitPrice: '100.00', description: '发动机舱清洁养护' },
  { name: '轮毂清洁', category: 'wash', unit: '只', unitPrice: '30.00', description: '轮毂深度清洁' },
  { name: '抛光', category: 'wash', unit: '次', unitPrice: '300.00', description: '漆面抛光翻新' },
  { name: '镀晶', category: 'wash', unit: '次', unitPrice: '800.00', description: '漆面镀晶保护' },
  { name: '贴膜', category: 'wash', unit: '次', unitPrice: '2000.00', description: '全车贴膜（含前挡）' },
  // ===== 保养 =====
  { name: '机油机滤小保养', category: 'maintenance', unit: '次', unitPrice: '0.00', description: '工时费另计，含机油机滤' },
  { name: '空气滤芯更换', category: 'maintenance', unit: '个', unitPrice: '30.00', description: '空气滤芯材料费' },
  { name: '空调滤芯更换', category: 'maintenance', unit: '个', unitPrice: '40.00', description: '空调滤芯材料费' },
  { name: '刹车油更换', category: 'maintenance', unit: '次', unitPrice: '120.00', description: '含刹车油材料+工时' },
  { name: '防冻液更换', category: 'maintenance', unit: '次', unitPrice: '100.00', description: '含防冻液材料+工时' },
  { name: '火花塞更换', category: 'maintenance', unit: '组', unitPrice: '80.00', description: '火花塞材料费（4缸）' },
  { name: '变速箱油更换', category: 'maintenance', unit: '次', unitPrice: '300.00', description: '含变速箱油+工时' },
  { name: '正时皮带更换', category: 'maintenance', unit: '次', unitPrice: '500.00', description: '含正时皮带套件+工时' },
  // ===== 维修 =====
  { name: '故障诊断', category: 'repair', unit: '次', unitPrice: '50.00', description: '电脑诊断+人工排查' },
  { name: '刹车片更换（工时）', category: 'repair', unit: '只', unitPrice: '80.00', description: '前/后刹车片更换工时' },
  { name: '电瓶更换（工时）', category: 'repair', unit: '次', unitPrice: '30.00', description: '电瓶更换工时费' },
  { name: '雨刮片更换', category: 'repair', unit: '对', unitPrice: '20.00', description: '前/后雨刮片更换工时' },
  { name: '大灯更换', category: 'repair', unit: '只', unitPrice: '50.00', description: '大灯总成更换工时' },
  { name: '空调加氟', category: 'repair', unit: '次', unitPrice: '150.00', description: '空调制冷剂加注' },
  { name: '钣金修复', category: 'repair', unit: '面', unitPrice: '200.00', description: '钣金修复+整形' },
  // ===== 轮胎 =====
  { name: '补胎', category: 'tire', unit: '只', unitPrice: '40.00', description: '内补/外补' },
  { name: '换胎（只）', category: 'tire', unit: '只', unitPrice: '20.00', description: '轮胎拆装工时费' },
  { name: '四轮定位', category: 'tire', unit: '次', unitPrice: '150.00', description: '四轮定位调试' },
  { name: '轮胎换位', category: 'tire', unit: '次', unitPrice: '40.00', description: '四轮换位+胎压检测' },
  { name: '动平衡', category: 'tire', unit: '只', unitPrice: '30.00', description: '单轮动平衡' },
] as const;

export type ServiceItemData = (typeof SERVICE_ITEMS)[number];
