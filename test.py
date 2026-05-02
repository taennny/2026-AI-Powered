import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel

device = "mps" if torch.backends.mps.is_available() else "cpu"
print(f"현재 사용 중인 엔진: {device}")

model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

image = Image.open("source/IMG_0558.JPG")

# AI에게 던질 객관식 보기 (후보군)
labels = [
    "A photo of a dessert cafe", 
    "A photo of a Korean restaurant", 
    "A photo of a convenience store",
    "A photo of an outdoor park"
]

inputs = processor(text=labels, images=image, return_tensors="pt", padding=True).to(device)

outputs = model(**inputs)

probs = outputs.logits_per_image.softmax(dim=1)[0].tolist()
print("\n=== 장소 추론 결과 ===")
for label, prob in zip(labels, probs):
    print(f"- {label}: {prob:.1%}")