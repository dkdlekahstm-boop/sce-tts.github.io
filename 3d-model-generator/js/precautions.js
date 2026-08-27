export const GENERAL_PRECAUTIONS = [
  {
    title: '베드 레벨링 & 첫 레이어',
    body:
      '출력 시작 전 베드 레벨링(수평 맞추기)을 확인하세요. 첫 레이어가 얇게 눌려 고르게 깔리지 않으면 ' +
      '출력 도중 부품이 베드에서 떨어지는 실패로 이어집니다. 유리판이라면 이소프로필알코올(IPA)로 닦고, ' +
      '필요하면 글루스틱/헤어스프레이/전용 접착 시트로 접착력을 보강하세요.',
  },
  {
    title: '휨(Warping) 방지',
    body:
      '재질의 수축률이 클수록(ABS, ASA, Nylon 등) 모서리가 들뜨는 휨이 잘 생깁니다. 베드 온도를 권장 범위로 ' +
      '유지하고, 브림(Brim)이나 라프트(Raft)를 추가하거나, 엔클로저로 주변 온도를 일정하게 유지하면 줄어듭니다.',
  },
  {
    title: '오버행 & 서포트',
    body:
      '수평 대비 45도 이상 크게 기울어진 돌출부, 다리 구조, 뾰족한 역원뿔 형태는 서포트(지지대) 없이 출력하면 ' +
      '아래로 처지거나 실 형태로 늘어질 수 있습니다. 이 도구에서 "서포트 권장" 표시가 붙은 부품은 슬라이서에서 ' +
      '서포트를 켜고 출력하세요.',
  },
  {
    title: '필라멘트 보관 & 건조',
    body:
      'PETG, Nylon, TPU, PC 등 흡습성이 강한 재질은 공기 중 수분을 빨아들이면 출력 중 "치지직" 소리와 함께 ' +
      '기포가 생기고 층간 강도가 떨어집니다. 사용하지 않을 때는 실리카겔과 함께 밀폐 보관하고, 오래 방치했다면 ' +
      '출력 전에 재질별 권장 온도/시간으로 필라멘트를 건조하세요.',
  },
  {
    title: '환기',
    body:
      'ABS, ASA, PC 등은 출력 중 미세 입자와 냄새가 발생할 수 있습니다. 환기가 잘 되는 공간에서 출력하거나 ' +
      '엔클로저 + 배기 필터를 사용하세요.',
  },
  {
    title: '냉각팬 설정',
    body:
      'PLA 계열은 냉각팬을 강하게(거의 100%) 사용해야 디테일과 오버행이 잘 유지됩니다. 반대로 ABS/ASA/PC처럼 ' +
      '층간 접착이 중요한 고온 재질은 냉각팬을 끄거나 최소로 줄여야 갈라짐(레이어 분리)을 막을 수 있습니다.',
  },
  {
    title: '조립형 부품 출력 시',
    body:
      '여러 부품을 조립해서 하나의 결과물을 만드는 경우, 같은 재질/같은 프린터로 한 번에 뽑는 것을 권장합니다. ' +
      '재질이 다르면 수축률 차이로 조립 공차가 안 맞을 수 있으니, 끼워맞춤이 있는 부품은 0.1~0.2mm 정도의 ' +
      '여유(공차)를 두고 설계하세요.',
  },
  {
    title: '출력물 분리 및 후처리',
    body:
      '출력이 끝나면 베드가 충분히 식은 뒤에 분리하세요(뜨거운 상태에서 무리하게 떼면 변형됩니다). ' +
      '서포트 제거 시 날카로운 니퍼/커터를 사용할 때 손 다치지 않도록 주의하고, 표면 정리 시 분진 마스크를 ' +
      '착용하는 것이 좋습니다.',
  },
];

export function buildPrecautionText(materialKey, materialPreset, parts) {
  const lines = [];
  lines.push('3D 프린팅 주의사항');
  lines.push('='.repeat(40));
  lines.push('');
  lines.push(`선택한 재질: ${materialPreset.label}`);
  lines.push(materialPreset.notes);
  lines.push('');
  lines.push(`- 노즐 온도: ${materialPreset.nozzleDefault}°C (권장 범위 ${materialPreset.nozzleTemp[0]}~${materialPreset.nozzleTemp[1]}°C)`);
  lines.push(`- 베드 온도: ${materialPreset.bedDefault}°C (권장 범위 ${materialPreset.bedTemp[0]}~${materialPreset.bedTemp[1]}°C)`);
  lines.push(`- 냉각팬: ${materialPreset.fanPercent}%`);
  lines.push(`- 출력 속도: ${materialPreset.printSpeed[0]}~${materialPreset.printSpeed[1]} mm/s`);
  lines.push(`- 리트랙션: 거리 ${materialPreset.retractDistance}mm / 속도 ${materialPreset.retractSpeed}mm/s`);
  if (materialPreset.needsDrying) {
    lines.push(`- 건조 필요: ${materialPreset.dryingTemp}°C에서 ${materialPreset.dryingHours}시간 이상 (흡습성 재질)`);
  } else {
    lines.push('- 건조: 보통 불필요하지만 장기 보관했다면 건조 권장');
  }
  if (materialPreset.needsEnclosure) {
    lines.push('- 엔클로저(밀폐형 챔버) 사용을 강력 권장합니다.');
  }
  lines.push('');

  const supportParts = parts.filter((p) => p.needsSupport);
  if (supportParts.length) {
    lines.push('서포트(지지대) 권장 부품:');
    supportParts.forEach((p) => lines.push(`  - ${p.name}: ${p.supportReason || '오버행/돌출 구조 감지'}`));
    lines.push('');
  }

  lines.push('일반 주의사항');
  lines.push('-'.repeat(40));
  GENERAL_PRECAUTIONS.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.title}`);
    lines.push(`   ${item.body}`);
    lines.push('');
  });

  lines.push('※ 위 수치는 일반적인 권장 범위를 기준으로 한 출발점입니다.');
  lines.push('   실제 사용하는 필라멘트 제조사의 스펙시트와 프린터 매뉴얼을 우선하세요.');

  return lines.join('\n');
}
