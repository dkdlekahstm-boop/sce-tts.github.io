import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { MATERIAL_PRESETS, MATERIAL_ORDER } from './materials.js';
import { GENERAL_PRECAUTIONS, buildPrecautionText } from './precautions.js';
import { buildGeometry, SHAPE_FIELDS, SHAPE_LABELS, estimateSupportNeed, analyzePhotoAspect } from './shapes.js';
import { generateFromText, generateFromImage, fetchModelAsBlob } from './ai.js';

const state = {
  parts: [],
  material: 'PLA',
  overridden: {},
};
let partIdCounter = 0;

// ---------- Three.js 씬 ----------
const viewerEl = document.getElementById('viewer');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeef0f3);

const camera = new THREE.PerspectiveCamera(45, viewerEl.clientWidth / viewerEl.clientHeight, 0.1, 5000);
camera.position.set(120, 100, 160);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(viewerEl.clientWidth, viewerEl.clientHeight);
viewerEl.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 20, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(100, 200, 100);
scene.add(dirLight);

const grid = new THREE.GridHelper(200, 20, 0x999999, 0xcccccc);
scene.add(grid);
scene.add(new THREE.AxesHelper(30));

const partsGroup = new THREE.Group();
scene.add(partsGroup);

function resizeViewer() {
  camera.aspect = viewerEl.clientWidth / viewerEl.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(viewerEl.clientWidth, viewerEl.clientHeight);
}
window.addEventListener('resize', resizeViewer);

(function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
})();

// ---------- 부품 모델 ----------
function defaultDims(shape) {
  const dims = {};
  SHAPE_FIELDS[shape].forEach((f) => (dims[f.key] = f.default));
  return dims;
}

function createPart() {
  partIdCounter += 1;
  return {
    id: partIdCounter,
    name: `부품 ${partIdCounter}`,
    description: '',
    shape: 'box',
    dims: defaultDims('box'),
    offset: { x: 0, y: 0, z: 0 },
    photoDataUrl: null,
    useAI: false,
    aiTargetSize: 50,
    aiModelUrls: null,
    aiStatus: '',
    object3d: null, // 씬에 들어간 THREE.Object3D (Mesh 또는 로드된 GLTF)
    exportGeometry: null, // STL 내보내기에 쓸 THREE.BufferGeometry (parametric일 때만)
    needsSupport: false,
    supportReason: '',
  };
}

function rebuildPartMesh(part) {
  if (part.object3d) {
    partsGroup.remove(part.object3d);
    part.object3d = null;
  }
  const geometry = buildGeometry(part);
  const material = new THREE.MeshStandardMaterial({ color: 0x4c9c2c, metalness: 0.1, roughness: 0.7 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(part.offset.x, part.offset.y, part.offset.z);
  partsGroup.add(mesh);
  part.object3d = mesh;
  part.exportGeometry = geometry;

  const support = estimateSupportNeed(part);
  part.needsSupport = support.needsSupport;
  part.supportReason = support.reason;
}

function updatePartOffset(part) {
  if (part.object3d) {
    part.object3d.position.set(part.offset.x, part.offset.y, part.offset.z);
  }
}

// ---------- 부품 카드 UI ----------
const partsListEl = document.getElementById('parts-list');

function renderDimsFields(part, container) {
  container.innerHTML = '';
  SHAPE_FIELDS[part.shape].forEach((f) => {
    const label = document.createElement('label');
    label.textContent = f.label;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.5';
    input.value = part.dims[f.key];
    input.addEventListener('input', () => {
      part.dims[f.key] = parseFloat(input.value) || 0;
      rebuildPartMesh(part);
      refreshSupportFlag(part);
    });
    label.appendChild(input);
    container.appendChild(label);
  });
}

function refreshSupportFlag(part) {
  const flagEl = document.querySelector(`[data-support-flag="${part.id}"]`);
  if (!flagEl) return;
  if (part.needsSupport || part.supportReason) {
    flagEl.hidden = false;
    flagEl.textContent = `⚠ ${part.supportReason}`;
  } else {
    flagEl.hidden = true;
  }
}

function renderPartCard(part) {
  const card = document.createElement('div');
  card.className = 'part-card';
  card.dataset.partId = String(part.id);

  card.innerHTML = `
    <div class="part-card-header">
      <input type="text" class="part-name" value="${escapeHtml(part.name)}" />
      <button class="remove-btn">삭제</button>
    </div>
    <div class="field-row">
      <label style="flex:1">설명 (사진이 없을 때 이 설명대로 형태/치수를 잡습니다)
        <textarea class="part-desc" placeholder="예: 손잡이가 달린 원통형 컵, 지름 8cm 높이 10cm">${escapeHtml(part.description)}</textarea>
      </label>
    </div>
    <div class="field-row">
      <label>형태
        <select class="part-shape">
          ${Object.keys(SHAPE_LABELS).map((k) => `<option value="${k}" ${k === part.shape ? 'selected' : ''}>${SHAPE_LABELS[k]}</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="dims-fields"></div>
    <div class="field-row">
      <label>위치 X(mm) <input type="number" class="offset-x" value="${part.offset.x}" /></label>
      <label>위치 Y(mm) <input type="number" class="offset-y" value="${part.offset.y}" /></label>
      <label>위치 Z(mm) <input type="number" class="offset-z" value="${part.offset.z}" /></label>
    </div>
    <div class="photo-row">
      <input type="file" accept="image/*" class="part-photo" />
      <img class="photo-thumb" alt="참고 사진 미리보기" />
      <span class="hint photo-hint"></span>
    </div>
    <div class="ai-controls">
      <label><input type="checkbox" class="use-ai" /> AI로 생성 (Meshy API 키 필요)</label>
      <label>목표 크기(mm) <input type="number" class="ai-target-size" value="${part.aiTargetSize}" style="width:70px" /></label>
      <button class="primary-btn ai-run-btn" disabled>AI 생성 실행</button>
      <span class="ai-status"></span>
    </div>
    <div class="support-flag" data-support-flag="${part.id}" hidden></div>
  `;

  partsListEl.appendChild(card);

  const dimsContainer = card.querySelector('.dims-fields');
  renderDimsFields(part, dimsContainer);

  card.querySelector('.part-name').addEventListener('input', (e) => {
    part.name = e.target.value;
  });
  card.querySelector('.part-desc').addEventListener('input', (e) => {
    part.description = e.target.value;
  });
  card.querySelector('.part-shape').addEventListener('change', (e) => {
    part.shape = e.target.value;
    part.dims = defaultDims(part.shape);
    renderDimsFields(part, dimsContainer);
    rebuildPartMesh(part);
    refreshSupportFlag(part);
  });
  card.querySelector('.offset-x').addEventListener('input', (e) => {
    part.offset.x = parseFloat(e.target.value) || 0;
    updatePartOffset(part);
  });
  card.querySelector('.offset-y').addEventListener('input', (e) => {
    part.offset.y = parseFloat(e.target.value) || 0;
    updatePartOffset(part);
  });
  card.querySelector('.offset-z').addEventListener('input', (e) => {
    part.offset.z = parseFloat(e.target.value) || 0;
    updatePartOffset(part);
  });
  card.querySelector('.remove-btn').addEventListener('click', () => {
    if (part.object3d) partsGroup.remove(part.object3d);
    state.parts = state.parts.filter((p) => p.id !== part.id);
    card.remove();
  });

  const photoInput = card.querySelector('.part-photo');
  const photoThumb = card.querySelector('.photo-thumb');
  const photoHint = card.querySelector('.photo-hint');
  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      part.photoDataUrl = reader.result;
      photoThumb.src = reader.result;
      photoThumb.style.display = 'inline-block';
      const img = new Image();
      img.onload = () => {
        const result = analyzePhotoAspect(img);
        applyAspectToDims(part, result.aspect);
        renderDimsFields(part, dimsContainer);
        rebuildPartMesh(part);
        photoHint.textContent = result.confident
          ? `사진 비율 분석 완료 (가로:세로 ≈ ${result.aspect.toFixed(2)}:1) - 치수는 참고용이니 직접 조정하세요.`
          : '사진에서 배경과 구분이 어려워 원본 이미지 비율을 사용했습니다. 치수를 직접 조정하세요.';
      };
      img.src = reader.result;
      updateAiButtonState(card, part);
    };
    reader.readAsDataURL(file);
  });

  card.querySelector('.use-ai').addEventListener('change', (e) => {
    part.useAI = e.target.checked;
    updateAiButtonState(card, part);
  });
  card.querySelector('.ai-target-size').addEventListener('input', (e) => {
    part.aiTargetSize = parseFloat(e.target.value) || 50;
  });
  card.querySelector('.ai-run-btn').addEventListener('click', () => runAiGeneration(part, card));

  updateAiButtonState(card, part);
}

function applyAspectToDims(part, aspect) {
  // 사진 비율(가로:세로)을 형태별 치수에 대략 반영
  if (part.shape === 'box') {
    const height = part.dims.height || 20;
    part.dims.width = Math.round(height * aspect * 10) / 10;
  } else if (part.shape === 'cylinder' || part.shape === 'cone' || part.shape === 'tube') {
    const height = part.dims.height || 30;
    part.dims.radius = Math.round((height / 2 / aspect) * 10) / 10;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getApiKey() {
  return document.getElementById('ai-api-key').value.trim();
}

function updateAiButtonState(card, part) {
  const btn = card.querySelector('.ai-run-btn');
  const hasKey = getApiKey().length > 0;
  btn.disabled = !(part.useAI && hasKey);
}

async function runAiGeneration(part, card) {
  const apiKey = getApiKey();
  const statusEl = card.querySelector('.ai-status');
  if (!apiKey) {
    statusEl.textContent = 'API 키를 먼저 입력하세요.';
    return;
  }
  statusEl.textContent = '요청 중...';
  try {
    let modelUrls;
    if (part.photoDataUrl) {
      modelUrls = await generateFromImage(part.photoDataUrl, apiKey, (task) => {
        statusEl.textContent = `이미지 기반 생성 중... (${task.progress ?? 0}%)`;
      });
    } else {
      const prompt = part.description?.trim();
      if (!prompt) {
        statusEl.textContent = '설명을 입력해야 텍스트 기반 AI 생성이 가능합니다.';
        return;
      }
      modelUrls = await generateFromText(prompt, apiKey, (task) => {
        statusEl.textContent = `설명 기반 생성 중... (${task.progress ?? 0}%)`;
      });
    }
    part.aiModelUrls = modelUrls;
    statusEl.textContent = '모델 불러오는 중...';
    await loadAiModelIntoScene(part, modelUrls.glb);
    statusEl.textContent = '✅ AI 생성 완료 (미리보기에 반영됨)';
  } catch (err) {
    console.error(err);
    statusEl.textContent = `❌ 실패: ${err.message}. 도형 조합 모델로 계속 진행할 수 있습니다.`;
  }
}

async function loadAiModelIntoScene(part, glbUrl) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(glbUrl);
  const group = gltf.scene;

  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = part.aiTargetSize / maxDim;
  group.scale.setScalar(scale);

  const center = new THREE.Vector3();
  box.getCenter(center);
  group.position.sub(center.multiplyScalar(scale));

  if (part.object3d) partsGroup.remove(part.object3d);
  group.position.add(new THREE.Vector3(part.offset.x, part.offset.y, part.offset.z));
  partsGroup.add(group);
  part.object3d = group;
  part.exportGeometry = null; // AI 모델은 export 시 group을 순회해서 병합
}

// ---------- 부품 추가 ----------
document.getElementById('add-part-btn').addEventListener('click', () => {
  const part = createPart();
  state.parts.push(part);
  rebuildPartMesh(part);
  renderPartCard(part);
});

document.getElementById('ai-api-key').addEventListener('input', () => {
  document.querySelectorAll('.part-card').forEach((card) => {
    const id = Number(card.dataset.partId);
    const part = state.parts.find((p) => p.id === id);
    if (part) updateAiButtonState(card, part);
  });
});

// ---------- 재질/프린터 설정 ----------
const materialSelect = document.getElementById('material-select');
MATERIAL_ORDER.forEach((key) => {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = MATERIAL_PRESETS[key].label;
  materialSelect.appendChild(opt);
});

const settingFields = {
  nozzle: document.getElementById('set-nozzle'),
  bed: document.getElementById('set-bed'),
  fan: document.getElementById('set-fan'),
  speed: document.getElementById('set-speed'),
  retractDist: document.getElementById('set-retract-dist'),
  retractSpeed: document.getElementById('set-retract-speed'),
  diameter: document.getElementById('set-diameter'),
};

function applyMaterialPreset(key) {
  const preset = MATERIAL_PRESETS[key];
  settingFields.nozzle.value = preset.nozzleDefault;
  settingFields.bed.value = preset.bedDefault;
  settingFields.fan.value = preset.fanPercent;
  settingFields.speed.value = Math.round((preset.printSpeed[0] + preset.printSpeed[1]) / 2);
  settingFields.retractDist.value = preset.retractDistance;
  settingFields.retractSpeed.value = preset.retractSpeed;

  settingFields.diameter.innerHTML = '';
  preset.diameterOptions.forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = `${d}mm`;
    settingFields.diameter.appendChild(opt);
  });

  document.getElementById('material-note').textContent = preset.notes;

  const dryingNote = document.getElementById('drying-note');
  if (preset.needsDrying) {
    dryingNote.hidden = false;
    dryingNote.textContent = `⚠ 이 재질은 습기에 약합니다. 출력 전 ${preset.dryingTemp}°C에서 ${preset.dryingHours}시간 이상 건조를 권장합니다.` +
      (preset.needsEnclosure ? ' 엔클로저(밀폐 챔버) 사용도 권장됩니다.' : '');
  } else {
    dryingNote.hidden = true;
  }
}

materialSelect.addEventListener('change', () => {
  state.material = materialSelect.value;
  applyMaterialPreset(state.material);
});
applyMaterialPreset(state.material);

// ---------- 주의사항 패널 ----------
const precautionContent = document.getElementById('precaution-content');
GENERAL_PRECAUTIONS.forEach((item) => {
  const div = document.createElement('div');
  div.className = 'precaution-item';
  div.innerHTML = `<h3>${item.title}</h3><p>${item.body}</p>`;
  precautionContent.appendChild(div);
});

// ---------- ZIP 내보내기 ----------
const exportStatus = document.getElementById('export-status');

function partToStlBlob(part) {
  const exporter = new STLExporter();
  if (part.exportGeometry) {
    const mesh = new THREE.Mesh(part.exportGeometry);
    const stlString = exporter.parse(mesh, { binary: false });
    return new Blob([stlString], { type: 'model/stl' });
  }
  if (part.object3d) {
    const stlString = exporter.parse(part.object3d, { binary: false });
    return new Blob([stlString], { type: 'model/stl' });
  }
  return null;
}

function sanitizeFileName(name) {
  return (name || 'part').replace(/[\\/:*?"<>|]/g, '_').trim() || 'part';
}

document.getElementById('export-btn').addEventListener('click', async () => {
  if (state.parts.length === 0) {
    exportStatus.textContent = '먼저 부품을 하나 이상 추가하세요.';
    return;
  }
  exportStatus.textContent = 'ZIP 생성 중...';
  try {
    const zip = new JSZip();
    const modelsFolder = zip.folder('models');
    const usedNames = new Set();

    for (const part of state.parts) {
      let fileName = sanitizeFileName(part.name);
      while (usedNames.has(fileName)) fileName += '_2';
      usedNames.add(fileName);

      const stlBlob = partToStlBlob(part);
      if (stlBlob) modelsFolder.file(`${fileName}.stl`, stlBlob);

      if (part.aiModelUrls?.glb) {
        try {
          const glbBlob = await fetchModelAsBlob(part.aiModelUrls.glb);
          modelsFolder.file(`${fileName}.glb`, glbBlob);
        } catch (err) {
          console.warn('glb 다운로드 실패:', err);
        }
      }
    }

    const preset = MATERIAL_PRESETS[state.material];
    const settingsForFile = {
      material: state.material,
      nozzleTempC: Number(settingFields.nozzle.value),
      bedTempC: Number(settingFields.bed.value),
      fanPercent: Number(settingFields.fan.value),
      printSpeedMmPerSec: Number(settingFields.speed.value),
      retractDistanceMm: Number(settingFields.retractDist.value),
      retractSpeedMmPerSec: Number(settingFields.retractSpeed.value),
      filamentDiameterMm: Number(settingFields.diameter.value),
      layerHeightMm: Number(document.getElementById('set-layer').value),
      infillPercent: Number(document.getElementById('set-infill').value),
      parts: state.parts.map((p) => ({
        name: p.name,
        shape: p.useAI ? 'ai-generated' : p.shape,
        dimensionsMm: p.useAI ? { targetMaxSize: p.aiTargetSize } : p.dims,
        offsetMm: p.offset,
        needsSupport: p.needsSupport,
        supportReason: p.supportReason,
      })),
    };

    zip.file('print-settings.json', JSON.stringify(settingsForFile, null, 2));
    zip.file(
      'print-settings.txt',
      Object.entries(settingsForFile)
        .filter(([k]) => k !== 'parts')
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')
    );
    zip.file('주의사항.txt', buildPrecautionText(state.material, preset, state.parts));
    zip.file(
      'README.txt',
      [
        '부품별 3D 모델 생성기로 내보낸 패키지',
        '='.repeat(40),
        `부품 개수: ${state.parts.length}`,
        '',
        ...state.parts.map((p, i) => `${i + 1}. ${p.name} (${SHAPE_LABELS[p.shape] || 'AI 생성'})${p.needsSupport ? ' - 서포트 권장' : ''}`),
        '',
        '각 부품의 조립 위치는 print-settings.json의 offsetMm 값을 참고하세요 (원점 기준 mm).',
        '슬라이서에서 각 STL을 불러온 뒤 offsetMm만큼 이동하면 미리보기와 동일하게 배치됩니다.',
      ].join('\n')
    );

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '3d-model-package.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    exportStatus.textContent = '✅ ZIP 다운로드 완료';
  } catch (err) {
    console.error(err);
    exportStatus.textContent = `❌ 내보내기 실패: ${err.message}`;
  }
});

// ---------- 초기 부품 1개 자동 추가 ----------
document.getElementById('add-part-btn').click();
