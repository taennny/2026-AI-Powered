from flask import Flask, request, jsonify
from flask_restx import Api, Resource, fields
from geopy.distance import geodesic
from dotenv import load_dotenv
import requests
import joblib
import pandas as pd
import os

load_dotenv()
KAKAO_API_KEY = os.getenv("KAKAO_API_KEY")

app = Flask(__name__)
api = Api(app, version='1.0', title='Roame AI API',
    description='GPS 분석 및 장소 매칭 API',
    doc='/swagger'
)

ns = api.namespace('api/ai', description='AI 분석')


# 모델 로드
model = joblib.load('models/stay_detection_model.pkl')
scaler = joblib.load('models/scaler.pkl')

def detect_stays(gps_logs):
    df = pd.DataFrame(gps_logs)
    df['time'] = pd.to_datetime(df['time'])

    distances = []
    for i in range(len(df) - 1):
        p1 = (df.loc[i, 'lat'], df.loc[i, 'lng'])
        p2 = (df.loc[i+1, 'lat'], df.loc[i+1, 'lng'])
        dist = geodesic(p1, p2).meters
        distances.append(dist)
    distances.append(0)

    df['distance_m'] = distances
    df['is_staying'] = df['distance_m'] < 50

    stays = []
    current_stay = None

    for i, row in df.iterrows():
        if row['is_staying']:
            if current_stay is None:
                current_stay = {
                    'start_time': row['time'],
                    'lat': row['lat'],
                    'lng': row['lng']
                }
            current_stay['end_time'] = row['time']
        else:
            if current_stay is not None:
                duration = (current_stay['end_time'] - current_stay['start_time']).seconds // 60
                if duration >= 3:
                    stays.append(current_stay)
                current_stay = None

    if current_stay is not None:
        duration = (current_stay['end_time'] - current_stay['start_time']).seconds // 60
        if duration >= 3:
            stays.append(current_stay)

    return stays

def get_place_info(lat, lng):
    headers = {"Authorization": f"KakaoAK {KAKAO_API_KEY}"}
    categories = ["FD6", "CE7", "AT4", "SW8"]
    for code in categories:
        params = {"x": lng, "y": lat, "radius": 300, "sort": "distance", "category_group_code": code}
        res = requests.get("https://dapi.kakao.com/v2/local/search/category.json", headers=headers, params=params)
        data = res.json()
        if data.get('documents') and len(data['documents']) > 0:
            place = data['documents'][0]
            return {
                "place_name": place['place_name'],
                "category": place['category_name'],
                "place_id": place['id'],
                "address": place['address_name']
            }
    return {"place_name": "알 수 없음", "category": "", "place_id": "", "address": ""}

analyze_input = api.model('AnalyzeInput', {
    'user_id': fields.String(required=True),
    'date': fields.String(required=True),
    'gps_logs': fields.List(fields.Raw, required=True)
})

@ns.route('/analyze')
class Analyze(Resource):
    @ns.expect(analyze_input)
    def post(self):
        try:
            data = request.json
            gps_logs = data.get('gps_logs', [])

            if not gps_logs:
                return {"error": "gps_logs가 비어있어요"}, 400

            stays = detect_stays(gps_logs)
            places = []
            for stay in stays:
                place_info = get_place_info(stay['lat'], stay['lng'])
                places.append({
                    "place_name": place_info['place_name'],
                    "category": place_info['category'],
                    "place_id": place_info['place_id'],
                    "arrived_at": stay['start_time'].isoformat(),
                    "left_at": stay['end_time'].isoformat(),
                    "duration_min": (stay['end_time'] - stay['start_time']).seconds // 60,
                    "lat": stay['lat'],
                    "lng": stay['lng']
                })

            return {"places": places}, 200

        except Exception as e:
            return {"error": str(e)}, 500

@app.route('/health')
def health():
    return {"status": "ok"}, 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)