# 车牌识别 OCR 服务

基于 PaddleOCR 的自建中文车牌识别服务。

## 特性

- 支持中国所有省份车牌识别
- 支持蓝牌、绿牌（新能源）、黄牌等
- 轻量级部署，CPU 即可运行
- RESTful API 接口
- Docker 一键部署

## 快速开始

### 方式一：Docker 部署（推荐）

```bash
# 进入 OCR 服务目录
cd ocr-service

# 一键部署
chmod +x deploy.sh
./deploy.sh
```

### 方式二：本地运行

```bash
# 安装依赖
pip install -r requirements.txt

# 启动服务
python app.py
```

## API 接口

### 识别车牌

**POST** `/recognize`

请求体：
```json
{
  "image_base64": "图片的base64编码"
}
```

响应：
```json
{
  "plate_no": "云G88888",
  "confidence": 0.95,
  "raw_texts": ["云G88888", "其他识别文本"]
}
```

### 健康检查

**GET** `/health`

响应：
```json
{
  "status": "ok",
  "model_loaded": true
}
```

## 部署到生产环境

### 1. 服务器要求

- CPU: 2核+
- 内存: 2GB+
- 磁盘: 5GB+（模型文件约 2GB）
- Docker: 20.10+

### 2. 部署步骤

```bash
# 上传 ocr-service 目录到服务器
scp -r ocr-service user@server:/opt/

# SSH 登录服务器
ssh user@server

# 进入目录
cd /opt/ocr-service

# 构建并启动
docker compose up -d --build

# 查看日志
docker compose logs -f
```

### 3. 配置 Nginx 反向代理（可选）

```nginx
server {
    listen 80;
    server_name ocr.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 4. 配置主项目调用

在主项目的 `.env` 中添加：

```bash
# OCR 服务地址
OCR_SERVICE_URL=http://your-ocr-server:8080
```

## 模型说明

服务使用 PaddleOCR 默认模型，首次启动会自动下载：

- 检测模型: `ch_PP-OCRv4_det`
- 识别模型: `ch_PP-OCRv4_rec`
- 方向分类: `ch_ppocr_mobile_v2.0_cls`

## 性能优化

### GPU 加速（可选）

如果有 NVIDIA GPU，可以使用 GPU 版本加速：

1. 安装 NVIDIA Container Toolkit
2. 修改 `docker-compose.yml`：

```yaml
services:
  ocr:
    # ... 其他配置
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

### 模型优化

可以使用轻量级模型提升速度：

```python
# 在 app.py 中修改
ocr_model = PaddleOCR(
    use_angle_cls=True,
    lang='ch',
    det_model_dir='path/to/lightweight_det_model',
    rec_model_dir='path/to/lightweight_rec_model',
)
```

## 常见问题

### Q: 识别准确率不高？

A: 确保图片清晰，车牌区域占图片比例适中。可以调整拍摄角度和距离。

### Q: 服务启动慢？

A: 首次启动需要下载模型（约 2GB），后续启动会快很多。

### Q: 内存不足？

A: 可以使用轻量级模型，或增加服务器内存。

## 许可证

本项目使用 PaddleOCR，遵循 Apache 2.0 协议。
