# 서울 3D 아틀라스

OpenStreetMap 벡터타일 + SRTM 표고로 만든 인터랙티브 미니어처 도시. Three.js 직접 렌더.

```
python3 -m http.server 8747   # → http://localhost:8747
```

## 구성

| 파일 | 역할 |
|---|---|
| `tools/build-city.mjs` | z14 벡터타일 374장 → 경량 씬 데이터 (한 번만 실행) |
| `app.js` | 지형·건물·나무·물·도로 렌더 |
| `landmarks.js` | 랜드마크 캐리커쳐 13개 |
| `index.html` | UI, 이름표 오버레이 |

## 데이터 만들기

```
npm i
node tools/build-city.mjs seoul
```

- `data/seoul.buildings.bin` 2.8MB — 건물 24만 동, 인스턴스당 `[x, y, w, d, 각도, 높이]` Int16
- `data/seoul.trees.bin` 2.5MB — 나무 43만 그루 (렌더 시 42% 솎음)
- `data/seoul.json` 4.1MB — 물·녹지·도로 폴리곤

건물 윤곽은 PCA 주축 기준 외접 사각형 하나로 축약한다. 인스턴싱 드로우콜 1회로 도시 전체가 그려지고, 원본 대비 데이터가 10배 가볍다.

## 다른 도시

`tools/build-city.mjs`의 `CITIES`에 중심좌표와 bbox만 추가하면 된다 (busan·newyork·paris 프리셋 포함). 타일과 표고는 전 세계 커버. 랜드마크 캐리커쳐만 도시별로 손으로 만든다.

## 알아둘 것

- 지형·건물 높이 3× 과장 (`EXAG`)
- DEM(30m)으로는 강바닥이 뭉개져 물이 묻히므로, 물 폴리곤을 마스크로 구워 그 아래 지형을 파낸다
- 서울 bbox 기준 첫 로드 약 10초 (표고 타일 + 데이터)

## 출처

OpenFreeMap / OpenMapTiles · © OpenStreetMap contributors (ODbL) · 2026-08-30 스냅샷 / AWS Terrain Tiles (Mapzen)
