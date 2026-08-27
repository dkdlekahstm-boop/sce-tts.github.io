// Meshy AI(https://www.meshy.ai) REST API를 브라우저에서 직접 호출하는 선택적 연동.
// - API 키는 로컬 브라우저(localStorage)에만 저장되며, Meshy API 서버로만 전송됩니다.
// - 이 기능은 외부 서비스 상태/요금제/CORS 정책에 의존하므로 실패할 수 있습니다.
//   실패 시 파라메트릭(도형 조합) 모델링으로 계속 진행할 수 있습니다.

const API_BASE = 'https://api.meshy.ai/openapi/v1';

async function pollTask(url, apiKey, onProgress, timeoutMs = 10 * 60 * 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`Meshy 상태 조회 실패 (HTTP ${res.status})`);
    }
    const task = await res.json();
    if (onProgress) onProgress(task);
    if (task.status === 'SUCCEEDED') return task;
    if (task.status === 'FAILED' || task.status === 'CANCELED') {
      throw new Error(`Meshy 작업 실패: ${task.task_error?.message || task.status}`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('Meshy 작업이 제한 시간 내에 끝나지 않았습니다.');
}

export async function generateFromText(prompt, apiKey, onProgress) {
  const createRes = await fetch(`${API_BASE}/text-to-3d`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mode: 'preview',
      prompt,
      art_style: 'realistic',
      should_remesh: true,
    }),
  });
  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Meshy text-to-3d 요청 실패 (HTTP ${createRes.status}): ${body}`);
  }
  const { result: taskId } = await createRes.json();
  const task = await pollTask(`${API_BASE}/text-to-3d/${taskId}`, apiKey, onProgress);
  return task.model_urls;
}

export async function generateFromImage(dataUrl, apiKey, onProgress) {
  const createRes = await fetch(`${API_BASE}/image-to-3d`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_url: dataUrl,
      should_remesh: true,
    }),
  });
  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Meshy image-to-3d 요청 실패 (HTTP ${createRes.status}): ${body}`);
  }
  const { result: taskId } = await createRes.json();
  const task = await pollTask(`${API_BASE}/image-to-3d/${taskId}`, apiKey, onProgress);
  return task.model_urls;
}

export async function fetchModelAsBlob(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`모델 파일 다운로드 실패 (HTTP ${res.status})`);
  return res.blob();
}
