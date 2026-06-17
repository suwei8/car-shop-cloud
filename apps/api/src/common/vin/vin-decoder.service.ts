import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface VinInfo {
  brand: string;
  model: string;
  year: string;
  engineType: string;
  manufacturer: string;
  country: string;
}

const WMI_MAP: Record<string, { brand: string; country: string }> = {
  'LFV': { brand: '一汽大众', country: '中国' },
  'LDC': { brand: '东风本田', country: '中国' },
  'LTV': { brand: '天津一汽', country: '中国' },
  'LFM': { brand: '一汽丰田', country: '中国' },
  'LVS': { brand: '长安福特', country: '中国' },
  'LJD': { brand: '北京现代', country: '中国' },
  'LBV': { brand: '华晨宝马', country: '中国' },
  'LNB': { brand: '北京奔驰', country: '中国' },
  'LFA': { brand: '一汽大众', country: '中国' },
  'LSV': { brand: '上汽大众', country: '中国' },
  'LSG': { brand: '上汽通用', country: '中国' },
  'LGB': { brand: '东风悦达起亚', country: '中国' },
  'LPA': { brand: '广汽丰田', country: '中国' },
  'LHC': { brand: '广汽本田', country: '中国' },
  'LBE': { brand: '北京汽车', country: '中国' },
  'LBH': { brand: '东风日产', country: '中国' },
  'LBY': { brand: '东风标致', country: '中国' },
  'LET': { brand: '广汽菲克', country: '中国' },
  'LE4': { brand: '北京奔驰', country: '中国' },
  'LFN': { brand: '一汽奔腾', country: '中国' },
  'LFP': { brand: '一汽吉林', country: '中国' },
  'LFT': { brand: '一汽解放', country: '中国' },
  'LGW': { brand: '长城汽车', country: '中国' },
  'LJ4': { brand: '长安汽车', country: '中国' },
  'LJC': { brand: '长安马自达', country: '中国' },
  'LJ1': { brand: '奇瑞汽车', country: '中国' },
  'LKL': { brand: '江铃汽车', country: '中国' },
  'LL0': { brand: '东风雷诺', country: '中国' },
  'LPS': { brand: '广汽三菱', country: '中国' },
  'LVC': { brand: '东风日产', country: '中国' },
  'LVT': { brand: '东风启辰', country: '中国' },
  'LVG': { brand: '广汽本田', country: '中国' },
  'LVSH': { brand: '上汽大众', country: '中国' },
  'LVSU': { brand: '上汽斯柯达', country: '中国' },
  'LVV': { brand: '奇瑞汽车', country: '中国' },
  'LVY': { brand: '东风悦达起亚', country: '中国' },
  'LWD': { brand: '东风小康', country: '中国' },
  'LWT': { brand: '江淮汽车', country: '中国' },
  'LB3': { brand: '吉利汽车', country: '中国' },
  'LB6': { brand: '吉利汽车', country: '中国' },
  'L10': { brand: '比亚迪', country: '中国' },
  'L6T': { brand: '蔚来汽车', country: '中国' },
  'L5Y': { brand: '小鹏汽车', country: '中国' },
  'LCA': { brand: '理想汽车', country: '中国' },
  'LJL': { brand: '江铃汽车', country: '中国' },
  'LKC': { brand: '开瑞汽车', country: '中国' },
  'LMG': { brand: '广汽集团', country: '中国' },
  'LMH': { brand: '华泰汽车', country: '中国' },
  'LMK': { brand: '奇瑞汽车', country: '中国' },
  'LMW': { brand: '众泰汽车', country: '中国' },
  'LN8': { brand: '东南汽车', country: '中国' },
  'LQW': { brand: '华晨汽车', country: '中国' },
  'LRW': { brand: '特斯拉', country: '中国' },
  'LS5': { brand: '上汽大通', country: '中国' },
  'LSE': { brand: '上汽荣威', country: '中国' },
  'LSF': { brand: '上汽名爵', country: '中国' },
  'LSK': { brand: '上汽通用五菱', country: '中国' },
  'LUC': { brand: '长安汽车', country: '中国' },
  'LWX': { brand: '长城汽车', country: '中国' },
  'LZG': { brand: '中兴汽车', country: '中国' },
  'LZP': { brand: '郑州日产', country: '中国' },
  'WBA': { brand: '宝马', country: '德国' },
  'WBS': { brand: '宝马M', country: '德国' },
  'WBY': { brand: '宝马i', country: '德国' },
  'WDB': { brand: '奔驰', country: '德国' },
  'WDC': { brand: '奔驰SUV', country: '德国' },
  'WDD': { brand: '奔驰', country: '德国' },
  'WAU': { brand: '奥迪', country: '德国' },
  'WAP': { brand: '奥迪', country: '德国' },
  'WUA': { brand: '奥迪', country: '德国' },
  'WVW': { brand: '大众', country: '德国' },
  'WV1': { brand: '大众商用车', country: '德国' },
  'WV2': { brand: '大众V级', country: '德国' },
  'WP0': { brand: '保时捷', country: '德国' },
  'WP1': { brand: '保时捷', country: '德国' },
  'W0L': { brand: '欧宝', country: '德国' },
  'WF0': { brand: '福特德国', country: '德国' },
  'JTD': { brand: '丰田', country: '日本' },
  'JTE': { brand: '丰田SUV', country: '日本' },
  'JTK': { brand: '丰田', country: '日本' },
  'JTJ': { brand: '雷克萨斯', country: '日本' },
  'JN1': { brand: '日产', country: '日本' },
  'JN8': { brand: '日产SUV', country: '日本' },
  'JMB': { brand: '三菱', country: '日本' },
  'JMA': { brand: '马自达', country: '日本' },
  'JMZ': { brand: '马自达', country: '日本' },
  'JF1': { brand: '斯巴鲁', country: '日本' },
  'JH4': { brand: '本田', country: '日本' },
  'JDA': { brand: '本田', country: '日本' },
  'JTF': { brand: '丰田', country: '日本' },
  'JTN': { brand: '丰田', country: '日本' },
  'KMH': { brand: '现代', country: '韩国' },
  'KNA': { brand: '起亚', country: '韩国' },
  'KNE': { brand: '现代', country: '韩国' },
  'KNC': { brand: '起亚', country: '韩国' },
  '1G1': { brand: '雪佛兰', country: '美国' },
  '1GC': { brand: '雪佛兰', country: '美国' },
  '1FT': { brand: '福特', country: '美国' },
  '1FA': { brand: '福特', country: '美国' },
  '1HD': { brand: '哈雷', country: '美国' },
  '2HG': { brand: '本田', country: '美国' },
  '2HK': { brand: '本田', country: '美国' },
  '5YJ': { brand: '特斯拉', country: '美国' },
  '1J4': { brand: 'Jeep', country: '美国' },
  '1C4': { brand: 'Jeep', country: '美国' },
  '1C6': { brand: 'Ram', country: '美国' },
  'SAL': { brand: '路虎', country: '英国' },
  'SAD': { brand: '捷豹', country: '英国' },
  'SCC': { brand: '迈凯伦', country: '英国' },
  'SAR': { brand: '路虎', country: '英国' },
  'ZAR': { brand: '阿尔法·罗密欧', country: '意大利' },
  'ZFF': { brand: '法拉利', country: '意大利' },
  'ZAM': { brand: '玛莎拉蒂', country: '意大利' },
  'ZLA': { brand: '兰博基尼', country: '意大利' },
  'VF1': { brand: '雷诺', country: '法国' },
  'VF3': { brand: '标致', country: '法国' },
  'VF7': { brand: '雪铁龙', country: '法国' },
  'VFA': { brand: 'DS', country: '法国' },
  'YS3': { brand: '萨博', country: '瑞典' },
  'YV1': { brand: '沃尔沃', country: '瑞典' },
};

// VDS 车型解码表（第4-8位）- 按 WMI 分组
const VDS_MAP: Record<string, Record<string, string>> = {
  // 一汽大众 (LFV)
  'LFV': {
    '162': '捷达', '16G': '捷达', '16K': '捷达', '16V': '捷达',
    '312': '宝来', '31A': '宝来', '31B': '宝来', '31R': '宝来', '31S': '宝来',
    '3A2': '速腾', '3A3': '速腾', '3A4': '速腾', '3A5': '速腾',
    '32A': '速腾', '32B': '速腾', '32C': '速腾', '32D': '速腾',
    '362': '迈腾', '363': '迈腾', '36A': '迈腾', '36B': '迈腾', '36C': '迈腾',
    '371': 'CC', '372': 'CC', '37A': 'CC',
    '562': '高尔夫', '563': '高尔夫', '56A': '高尔夫', '56B': '高尔夫',
    '612': '开迪',
    '712': '宝来', '71A': '宝来', '71B': '宝来',
    '912': '蔚领',
  },
  // 上汽大众 (LSV)
  'LSV': {
    '142': '桑塔纳', '143': '桑塔纳',
    '162': 'Polo', '16A': 'Polo',
    '182': '朗逸', '18A': '朗逸', '18B': '朗逸',
    '242': '帕萨特', '24A': '帕萨特',
    '312': '途观', '31A': '途观',
    '562': '途安',
  },
  // 一汽丰田 (LFM)
  'LFM': {
    '152': '威驰', '15A': '威驰',
    '182': '卡罗拉', '18A': '卡罗拉',
    '252': '锐志',
    '312': '皇冠',
    '412': 'RAV4', '41A': 'RAV4',
    '642': '普拉多',
  },
  // 广汽丰田 (LPA)
  'LPA': {
    '152': '雅力士',
    '182': '凯美瑞', '18A': '凯美瑞',
    '412': '汉兰达', '41A': '汉兰达',
  },
  // 东风本田 (LDC)
  'LDC': {
    '182': '思域', '18A': '思域',
    '252': '思铂睿',
    '412': 'CR-V', '41A': 'CR-V',
  },
  // 广汽本田 (LHC)
  'LHC': {
    '182': '飞度', '18A': '飞度',
    '252': '雅阁', '25A': '雅阁',
    '412': '缤智',
  },
  // 东风日产 (LBH)
  'LBH': {
    '122': '阳光',
    '162': '骊威',
    '182': '骐达', '18A': '骐达',
    '252': '天籁', '25A': '天籁',
    '312': '轩逸', '31A': '轩逸',
    '412': '逍客',
    '622': '奇骏',
  },
  // 北京现代 (LJD)
  'LJD': {
    '122': '瑞纳',
    '162': '伊兰特',
    '182': '悦动',
    '252': '索纳塔',
    '312': '途胜',
  },
  // 华晨宝马 (LBV)
  'LBV': {
    '152': '1系',
    '182': '3系', '18A': '3系',
    '252': '5系', '25A': '5系',
  },
  // 长安福特 (LVS)
  'LVS': {
    '122': '嘉年华',
    '162': '福克斯',
    '252': '蒙迪欧',
    '312': '翼虎',
    '562': '锐界',
  },
  // 东风悦达起亚 (LGB)
  'LGB': {
    '122': '锐欧',
    '162': '赛拉图',
    '182': '福瑞迪',
    '252': 'K5',
    '312': '智跑',
  },
};

const YEAR_CODE: Record<string, string> = {
  'A': '2010', 'B': '2011', 'C': '2012', 'D': '2013', 'E': '2014',
  'F': '2015', 'G': '2016', 'H': '2017', 'J': '2018', 'K': '2019',
  'L': '2020', 'M': '2021', 'N': '2022', 'P': '2023', 'R': '2024',
  'S': '2025', 'T': '2026', 'V': '2027', 'W': '2028', 'X': '2029',
  'Y': '2030', '1': '2031', '2': '2032', '3': '2033', '4': '2034',
  '5': '2035', '6': '2036', '7': '2037', '8': '2038', '9': '2039',
};

@Injectable()
export class VinDecoderService {
  private readonly logger = new Logger(VinDecoderService.name);

  constructor(private http: HttpService) {}

  async decodeVin(vin: string): Promise<VinInfo | null> {
    const normalizedVin = vin.toUpperCase().trim();
    
    if (!this.isValidVin(normalizedVin)) {
      this.logger.warn(`Invalid VIN format: ${vin}`);
      return null;
    }

    this.logger.log(`Decoding VIN: ${normalizedVin}`);

    try {
      const nhtsaResult = await this.decodeWithNhtsa(normalizedVin);
      if (nhtsaResult) {
        this.logger.log(`NHTSA decode success: ${nhtsaResult.brand} ${nhtsaResult.model}`);
        return nhtsaResult;
      }
    } catch (error) {
      this.logger.warn(`NHTSA API failed: ${error.message}`);
    }

    const localResult = this.decodeWithLocalWmi(normalizedVin);
    if (localResult) {
      this.logger.log(`Local WMI decode: ${localResult.brand}`);
      return localResult;
    }

    this.logger.warn(`Could not decode VIN: ${normalizedVin}`);
    return null;
  }

  private isValidVin(vin: string): boolean {
    const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/;
    return vinRegex.test(vin);
  }

  private async decodeWithNhtsa(vin: string): Promise<VinInfo | null> {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${vin}?format=json`;
    
    const response = await firstValueFrom(
      this.http.get(url, { timeout: 10000 })
    );

    const data = response.data?.Results?.[0];
    if (!data) return null;

    if (data.ErrorCode !== '0' && !data.Make) {
      return null;
    }

    return {
      brand: data.Make || '',
      model: data.Model || '',
      year: data.ModelYear || '',
      engineType: data.DisplacementL ? `${data.DisplacementL}L ${data.EngineCylinders || ''}缸` : '',
      manufacturer: data.PlantCity ? `${data.PlantCity}, ${data.PlantCountry || ''}` : '',
      country: data.PlantCountry || '',
    };
  }

  private decodeWithLocalWmi(vin: string): VinInfo | null {
    const wmi = vin.substring(0, 3);
    const vds = vin.substring(3, 8);
    
    const wmiInfo = WMI_MAP[wmi];
    if (!wmiInfo) {
      return null;
    }

    const yearCode = vin.charAt(9);
    const year = YEAR_CODE[yearCode] || '';

    // 尝试从 VDS 解码车型
    let model = '';
    const vdsMap = VDS_MAP[wmi];
    if (vdsMap) {
      // 尝试匹配 VDS 的不同长度前缀
      for (let len = 3; len >= 2; len--) {
        const prefix = vds.substring(0, len);
        if (vdsMap[prefix]) {
          model = vdsMap[prefix];
          break;
        }
      }
      
      // 如果还没匹配到，尝试模糊匹配
      if (!model) {
        for (const [key, value] of Object.entries(vdsMap)) {
          if (vds.startsWith(key.substring(0, 2))) {
            model = value;
            break;
          }
        }
      }
    }

    return {
      brand: wmiInfo.brand,
      model: model,
      year: year,
      engineType: '',
      manufacturer: '',
      country: wmiInfo.country,
    };
  }
}
