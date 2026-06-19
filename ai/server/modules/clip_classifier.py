"""CLIP 제로샷 사진 분류기 (AI-2 2b).

openai/clip-vit-base-patch32 로 사진을 장소·상황 카테고리로 분류한다.
무거운 의존성(torch/transformers)은 지연 로드하며, 미설치 시 is_available()=False
로 graceful 하게 비활성화되어 매칭 단계는 그대로 동작한다.
"""

import logging

logger = logging.getLogger(__name__)

MODEL_NAME = "openai/clip-vit-base-patch32"

SCENE_LABELS: dict[str, str] = {
    "음식": "a photo of food on a plate",
    "디저트/카페": "a photo of dessert, cake or coffee at a cafe",
    "음료": "a photo of a drink or beverage",
    "풍경/야외": "a photo of outdoor scenery or landscape",
    "인물": "a photo of a person or a selfie",
    "실내/공간": "a photo of an indoor space or interior",
    "상품/쇼핑": "a photo of a product or shopping items",
    "동물": "a photo of an animal or a pet",
    "야경/거리": "a photo of a city street or night view",
    "문서/스크린샷": "a screenshot, a document, or a picture of text",
}

# 블로그 재료로 부적합한 '잡사진' 카테고리 (대표사진/요약에서 제외)
JUNK_SCENES: set[str] = {"문서/스크린샷"}

_model = None
_processor = None
_device = None


def is_available() -> bool:
    """torch/transformers 설치 여부. 미설치면 분류를 건너뛴다."""
    import importlib.util

    return (
        importlib.util.find_spec("torch") is not None
        and importlib.util.find_spec("transformers") is not None
    )


def _load():
    """CLIP 모델·프로세서를 최초 1회 로드한다 (지연 초기화)."""
    global _model, _processor, _device
    if _model is None:
        import torch
        from transformers import CLIPModel, CLIPProcessor

        if torch.backends.mps.is_available():
            _device = "mps"
        elif torch.cuda.is_available():
            _device = "cuda"
        else:
            _device = "cpu"
        logger.info("CLIP 모델 로딩 (%s, device=%s)...", MODEL_NAME, _device)
        _model = CLIPModel.from_pretrained(MODEL_NAME).to(_device)
        _processor = CLIPProcessor.from_pretrained(MODEL_NAME)
    return _model, _processor, _device


def classify(images: list) -> list[tuple[str, float]]:
    """PIL 이미지 리스트를 받아 [(scene, confidence)] 를 반환한다.

    confidence 는 softmax 확률(0~1).
    """
    if not images:
        return []

    import torch

    model, processor, device = _load()
    labels = list(SCENE_LABELS.keys())
    prompts = list(SCENE_LABELS.values())

    inputs = processor(
        text=prompts, images=images, return_tensors="pt", padding=True
    ).to(device)
    with torch.no_grad():
        outputs = model(**inputs)
    probs = outputs.logits_per_image.softmax(dim=1)  # (이미지수, 라벨수)

    results = []
    for row in probs:
        idx = int(row.argmax())
        results.append((labels[idx], round(float(row[idx]), 4)))
    return results
