#!/usr/bin/env bash
# OCR 服务测试脚本

OCR_URL="${OCR_SERVICE_URL:-http://localhost:8080}"

echo "========== OCR 服务测试 =========="
echo "服务地址: $OCR_URL"

# 健康检查
echo ""
echo "[1/2] 健康检查..."
curl -sf "$OCR_URL/health" | python3 -m json.tool 2>/dev/null || echo "❌ 健康检查失败"

# 测试识别（使用一张示例图片）
echo ""
echo "[2/2] 测试车牌识别..."
echo "提示: 请将测试图片转换为 base64 后调用"
echo ""
echo "示例命令:"
echo "  # 将图片转换为 base64"
echo "  base64_image=\$(base64 -i test_plate.jpg)"
echo ""
echo "  # 调用识别接口"
echo "  curl -X POST $OCR_URL/recognize \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d \"{\\\"image_base64\\\": \\\"\$base64_image\\\"}\""
echo ""
echo "========== 测试完成 =========="
