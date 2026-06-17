"""
车店云管家 - 车牌识别 OCR 服务
基于 PaddleOCR 的自建车牌识别服务
"""

import re
import base64
import io
import logging
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import numpy as np

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 全局 OCR 模型
ocr_model = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理 - 启动时加载模型"""
    global ocr_model
    logger.info("正在加载 PaddleOCR 模型...")
    
    from paddleocr import PaddleOCR
    
    ocr_model = PaddleOCR(
        use_angle_cls=True,
        lang='ch',
        show_log=False,
        # 使用轻量级模型，速度更快
        det_model_dir=None,  # 使用默认模型
        rec_model_dir=None,
    )
    
    logger.info("PaddleOCR 模型加载完成")
    yield
    logger.info("OCR 服务关闭")


app = FastAPI(
    title="车店云管家 - 车牌识别服务",
    description="基于 PaddleOCR 的中文车牌识别 API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PlateRecognizeRequest(BaseModel):
    """车牌识别请求"""
    image_base64: str


class PlateRecognizeResponse(BaseModel):
    """车牌识别响应"""
    plate_no: Optional[str] = None
    confidence: float = 0.0
    raw_texts: list = []


# 中国车牌号正则表达式（支持带·分隔符的格式）
PLATE_REGEX = re.compile(
    r'[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤川青藏琼宁]'
    r'[A-Z]'
    r'[·\s]?'
    r'[A-Z0-9]{5,6}'
)

# VIN 码正则表达式（17位，不含 I/O/Q）
VIN_REGEX = re.compile(
    r'[A-HJ-NPR-Z0-9]{17}'
)


def extract_plate_from_texts(texts: list) -> Optional[tuple]:
    """
    从 OCR 识别的文本中提取车牌号
    返回: (plate_no, confidence) 或 None
    """
    for text in texts:
        # 清理文本
        cleaned = text.strip().upper()
        
        # 直接匹配车牌格式
        match = PLATE_REGEX.search(cleaned)
        if match:
            return (match.group(), 0.95)
        
        # 尝试修复常见 OCR 错误
        # 例如：把 0 识别为 O，把 8 识别为 B 等
        fixed = cleaned
        # 移除分隔符
        fixed = fixed.replace('·', '').replace(' ', '')
        fixed = fixed.replace('O', '0').replace('o', '0')
        fixed = fixed.replace('I', '1').replace('l', '1')
        fixed = fixed.replace('Z', '2').replace('z', '2')
        fixed = fixed.replace('S', '5').replace('s', '5')
        fixed = fixed.replace('B', '8').replace('b', '8')
        
        match = PLATE_REGEX.search(fixed)
        if match:
            return (match.group(), 0.80)
    
    return None


def extract_vin_from_texts(texts: list) -> Optional[tuple]:
    """
    从 OCR 识别的文本中提取 VIN 码
    返回: (vin, confidence) 或 None
    """
    for text in texts:
        # 清理文本
        cleaned = text.strip().upper()
        
        # 移除常见干扰字符
        cleaned = cleaned.replace(' ', '').replace('-', '').replace('.', '')
        
        # 直接匹配 VIN 格式（17位）
        match = VIN_REGEX.search(cleaned)
        if match and len(match.group()) == 17:
            return (match.group(), 0.95)
    
    # 尝试拼接多行文本匹配 VIN
    combined = ''.join([t.strip().upper().replace(' ', '').replace('-', '') for t in texts])
    match = VIN_REGEX.search(combined)
    if match and len(match.group()) == 17:
        return (match.group(), 0.85)
    
    return None


def image_base64_to_numpy(image_base64: str) -> np.ndarray:
    """将 base64 图片转换为 numpy 数组"""
    # 移除 data:image/xxx;base64, 前缀
    if ',' in image_base64:
        image_base64 = image_base64.split(',')[1]
    
    # 解码 base64
    image_bytes = base64.b64decode(image_base64)
    
    # 使用 PIL 打开图片
    image = Image.open(io.BytesIO(image_bytes))
    
    # 转换为 RGB（如果是 RGBA）
    if image.mode == 'RGBA':
        image = image.convert('RGB')
    
    # 转换为 numpy 数组
    return np.array(image)


@app.post("/recognize", response_model=PlateRecognizeResponse)
async def recognize_plate(request: PlateRecognizeRequest):
    """
    识别车牌号
    
    接收 base64 编码的图片，返回识别到的车牌号
    """
    global ocr_model
    
    if ocr_model is None:
        raise HTTPException(status_code=503, detail="OCR 模型未加载")
    
    try:
        logger.info(f"收到识别请求，base64 长度: {len(request.image_base64)}")
        
        # 将 base64 转换为 numpy 数组
        image_np = image_base64_to_numpy(request.image_base64)
        logger.info(f"图片尺寸: {image_np.shape}")
        
        # 使用 PaddleOCR 识别
        result = ocr_model.ocr(image_np, cls=True)
        
        logger.info(f"OCR 原始结果: {result}")
        
        # 提取所有识别到的文本
        all_texts = []
        if result and result[0]:
            for line in result[0]:
                text = line[1][0]
                confidence = line[1][1]
                all_texts.append(text)
                logger.info(f"OCR 识别: {text} (置信度: {confidence:.2f})")
        
        # 从文本中提取车牌号
        plate_result = extract_plate_from_texts(all_texts)
        
        if plate_result:
            plate_no, confidence = plate_result
            logger.info(f"车牌识别成功: {plate_no} (置信度: {confidence:.2f})")
            return PlateRecognizeResponse(
                plate_no=plate_no,
                confidence=confidence,
                raw_texts=all_texts,
            )
        else:
            logger.info(f"未识别到车牌号，原始文本: {all_texts}")
            return PlateRecognizeResponse(
                plate_no=None,
                confidence=0.0,
                raw_texts=all_texts,
            )
    
    except Exception as e:
        logger.error(f"车牌识别失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"识别失败: {str(e)}")


@app.post("/recognize-vin", response_model=PlateRecognizeResponse)
async def recognize_vin(request: PlateRecognizeRequest):
    """
    识别 VIN 码
    
    接收 base64 编码的图片，返回识别到的 VIN 码
    """
    global ocr_model
    
    if ocr_model is None:
        raise HTTPException(status_code=503, detail="OCR 模型未加载")
    
    try:
        logger.info(f"收到 VIN 识别请求，base64 长度: {len(request.image_base64)}")
        
        image_np = image_base64_to_numpy(request.image_base64)
        logger.info(f"图片尺寸: {image_np.shape}")
        
        result = ocr_model.ocr(image_np, cls=True)
        logger.info(f"OCR 原始结果: {result}")
        
        all_texts = []
        if result and result[0]:
            for line in result[0]:
                text = line[1][0]
                confidence = line[1][1]
                all_texts.append(text)
                logger.info(f"OCR 识别: {text} (置信度: {confidence:.2f})")
        
        vin_result = extract_vin_from_texts(all_texts)
        
        if vin_result:
            vin, confidence = vin_result
            logger.info(f"VIN 识别成功: {vin} (置信度: {confidence:.2f})")
            return PlateRecognizeResponse(
                plate_no=vin,
                confidence=confidence,
                raw_texts=all_texts,
            )
        else:
            logger.info(f"未识别到 VIN 码，原始文本: {all_texts}")
            return PlateRecognizeResponse(
                plate_no=None,
                confidence=0.0,
                raw_texts=all_texts,
            )
    
    except Exception as e:
        logger.error(f"VIN 识别失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"识别失败: {str(e)}")


@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "ok",
        "model_loaded": ocr_model is not None,
    }


@app.get("/")
async def root():
    """服务信息"""
    return {
        "service": "车店云管家 - OCR 识别服务",
        "version": "1.0.0",
        "model": "PaddleOCR",
        "endpoints": {
            "recognize_plate": "POST /recognize",
            "recognize_vin": "POST /recognize-vin",
            "health": "GET /health",
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
