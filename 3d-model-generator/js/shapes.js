import * as THREE from 'three';

// 1 Three.js 단위 = 1mm 로 취급 (STL 내보내기 시 그대로 mm 스케일 유지)
export function buildGeometry(part) {
  const d = part.dims;
  switch (part.shape) {
    case 'box':
      return new THREE.BoxGeometry(d.width, d.height, d.depth);
    case 'cylinder':
      return new THREE.CylinderGeometry(d.radius, d.radius, d.height, 48);
    case 'cone':
      return new THREE.CylinderGeometry(0, d.radius, d.height, 48);
    case 'sphere':
      return new THREE.SphereGeometry(d.radius, 32, 24);
    case 'tube': {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, d.radius, 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.absarc(0, 0, Math.max(d.radius - d.wallThickness, 0.2), 0, Math.PI * 2, true);
      shape.holes.push(hole);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: d.height, bevelEnabled: false, curveSegments: 48 });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, d.height / 2, 0);
      return geo;
    }
    case 'torus':
      return new THREE.TorusGeometry(d.radius, d.tubeRadius, 16, 64);
    default:
      return new THREE.BoxGeometry(10, 10, 10);
  }
}

export const SHAPE_FIELDS = {
  box: [
    { key: 'width', label: '가로(mm)', default: 30 },
    { key: 'height', label: '높이(mm)', default: 20 },
    { key: 'depth', label: '깊이(mm)', default: 15 },
  ],
  cylinder: [
    { key: 'radius', label: '반지름(mm)', default: 10 },
    { key: 'height', label: '높이(mm)', default: 30 },
  ],
  cone: [
    { key: 'radius', label: '밑면 반지름(mm)', default: 12 },
    { key: 'height', label: '높이(mm)', default: 25 },
  ],
  sphere: [{ key: 'radius', label: '반지름(mm)', default: 12 }],
  tube: [
    { key: 'radius', label: '바깥 반지름(mm)', default: 10 },
    { key: 'wallThickness', label: '벽 두께(mm)', default: 2 },
    { key: 'height', label: '높이(mm)', default: 30 },
  ],
  torus: [
    { key: 'radius', label: '전체 반지름(mm)', default: 15 },
    { key: 'tubeRadius', label: '단면 반지름(mm)', default: 4 },
  ],
};

export const SHAPE_LABELS = {
  box: '박스 / 브라켓',
  cylinder: '원통 / 축',
  cone: '원뿔',
  sphere: '구',
  tube: '파이프 / 튜브',
  torus: '도넛 / 링',
};

// 오버행이 큰 형태인지 간단히 판별해 서포트 필요 여부를 추정 (실측 아님, 참고용 휴리스틱)
export function estimateSupportNeed(part) {
  const d = part.dims;
  if (part.shape === 'cone') {
    if (d.height > d.radius * 1.5) {
      return { needsSupport: true, reason: '뾰족한 원뿔 형태 - 위로 갈수록 좁아져 오버행이 큽니다.' };
    }
  }
  if (part.shape === 'torus') {
    return { needsSupport: true, reason: '도넛 형태의 윗부분은 오버행이라 서포트가 필요할 수 있습니다.' };
  }
  if (part.shape === 'tube' && d.wallThickness < 1.2) {
    return { needsSupport: false, reason: '벽이 얇아 출력 실패 위험이 있으니 벽 두께를 1.2mm 이상 권장합니다.' };
  }
  return { needsSupport: false, reason: '' };
}

// 사진의 실루엣(배경과 다른 영역)을 감지해 가로세로 비율을 추정하는 간단한 휴리스틱.
// 실제 3D 형상 복원이 아니라 "치수 비율"을 눈대중보다 낫게 잡아주는 보조 도구입니다.
export function analyzePhotoAspect(imageEl) {
  const canvas = document.createElement('canvas');
  const maxSize = 300;
  const scale = Math.min(1, maxSize / Math.max(imageEl.naturalWidth, imageEl.naturalHeight));
  canvas.width = Math.max(1, Math.round(imageEl.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(imageEl.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageEl, 0, 0, canvas.width, canvas.height);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // 네 모서리 평균색을 배경색으로 가정
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  let bg = [0, 0, 0];
  corners.forEach(([x, y]) => {
    const i = (y * width + x) * 4;
    bg[0] += data[i] / corners.length;
    bg[1] += data[i + 1] / corners.length;
    bg[2] += data[i + 2] / corners.length;
  });

  const threshold = 32;
  let minX = width, maxX = 0, minY = height, maxY = 0;
  let foundAny = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const dr = data[i] - bg[0];
      const dg = data[i + 1] - bg[1];
      const db = data[i + 2] - bg[2];
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist > threshold) {
        foundAny = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!foundAny || maxX - minX < 4 || maxY - minY < 4) {
    return { aspect: imageEl.naturalWidth / imageEl.naturalHeight, confident: false };
  }
  const boxW = maxX - minX;
  const boxH = maxY - minY;
  return { aspect: boxW / boxH, confident: true };
}
