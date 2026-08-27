export const DEFAULT_SUBJECTS = [
  { name: "국어", weakness: 3 },
  { name: "수학", weakness: 3 },
];

export const TRIGGERS = [
  { id: "phone", label: "📱 스마트폰이 자꾸 눈에 들어와서" },
  { id: "youtube", label: "▶️ 유튜브/영상 보다가 시간이 감" },
  { id: "tired", label: "😴 피곤해서 시작할 힘이 없음" },
  { id: "overwhelmed", label: "🌀 뭐부터 할지 막막해서" },
  { id: "boring", label: "🥱 재미가 없어서" },
  { id: "distracted", label: "🌪️ 딴생각/딴짓에 자꾸 빠짐" },
];

export const TRIGGER_TIPS = {
  phone: "타이머를 켜기 전에 스마트폰을 다른 방이나 서랍에 넣어두세요. 눈에 보이기만 해도 뇌는 계속 신경을 씁니다 (주의 자원 소모).",
  youtube: "쉬는 시간에 볼 영상을 미리 1개만 정해두세요. '아무거나 보다가 1시간'을 막아주는 가장 확실한 방법이에요.",
  tired: "시작 전 제자리에서 30초 스트레칭 + 물 한 잔. 몸을 깨우면 뇌도 같이 깨어납니다.",
  overwhelmed: "지금 할 일을 '책과 노트 펴기'까지만 쪼개서 생각하세요. 그다음은 관성이 대신 이어줍니다 (2분 규칙).",
  boring: "이 세션이 끝나면 정해둔 오늘의 보상이 기다리고 있다는 걸 화면 위 보상 카드로 확인하세요.",
  distracted: "책상 위에 지금 세션과 관련 없는 물건을 전부 치우세요. 시야에 있는 것만으로도 주의가 빠져나갑니다.",
};

export const ATOMIC_ACTIONS = [
  "타이머만 누르고 책과 노트를 펴세요. 그거면 이미 시작한 겁니다.",
  "의자에 앉아서 오늘 배울 페이지만 펼쳐두세요. 나머지는 저절로 이어집니다.",
  "지난 시간에 배운 걸 한 문장으로 말해보고 시작하세요 (10초면 충분).",
];

export const ENCOURAGEMENTS = [
  "완벽하게 하려고 하지 않아도 돼요. 시작한 것만으로 이미 잘하고 있어요.",
  "어제보다 1분만 더 집중해도 뇌 회로는 그만큼 더 단단해져요.",
  "잊혀지는 건 자연스러운 거예요. 그래서 오늘 다시 떠올리는 게 의미 있어요.",
  "작은 체크 하나하나가 쌓여서 큰 실력이 됩니다.",
  "지금 이 순간 시작하는 게 가장 어려운 부분이에요. 이미 넘었어요.",
  "쉬는 것도 루틴의 일부예요. 뇌는 쉴 때 오늘 배운 걸 정리합니다.",
];

export const BADGES = [
  { id: "first_session", label: "🌱 첫 세션 완료", check: (p) => p.totalSessions >= 1 },
  { id: "streak_3", label: "🔥 3일 연속", check: (p) => p.streak >= 3 },
  { id: "streak_7", label: "⚡ 7일 연속", check: (p) => p.streak >= 7 },
  { id: "streak_30", label: "👑 30일 연속", check: (p) => p.streak >= 30 },
  { id: "review_10", label: "📚 복습 10회 달성", check: (p) => p.totalReviews >= 10 },
  { id: "level_5", label: "🚀 레벨 5 달성", check: (p) => levelFromXP(p.totalXP) >= 5 },
];

export function levelFromXP(xp) {
  return Math.max(1, Math.floor(Math.sqrt(xp / 50)) + 1);
}

export function xpForLevel(level) {
  return Math.pow(level - 1, 2) * 50;
}

export const RESEARCH = [
  {
    title: "망각곡선 (Forgetting Curve)",
    source: "Ebbinghaus, 1885",
    mechanism: "새로 배운 정보는 재인출 없이는 첫 24시간 내에 접근성이 급격히 떨어집니다. '잊는다'는 건 흔적이 지워지는 게 아니라 인출 경로가 약해지는 것에 가깝습니다.",
    applied: "복습 퀘스트 탭에서 학습 직후·1일·3일·7일·16일 간격으로 다시 떠올리도록 자동 스케줄링해요.",
  },
  {
    title: "간격 반복 (Spaced Repetition)",
    source: "Cepeda et al., 2006, Psychological Bulletin",
    mechanism: "같은 총 학습량이라도 몰아서 하는 것보다 시간 간격을 두고 분산할 때 장기 기억으로 전이가 더 잘 일어납니다.",
    applied: "매일 밤 취침 전 5~10분 '복습 슬롯'을 고정 배치하고, 등록한 개념을 늘어나는 간격으로 다시 보여줘요.",
  },
  {
    title: "인출 연습 / 테스트 효과 (Retrieval Practice)",
    source: "Roediger & Karpicke, 2006, Psychological Science",
    mechanism: "정보를 다시 읽는 것보다 머릿속에서 능동적으로 끄집어내는 행위 자체가 기억 흔적을 더 강하게 만듭니다.",
    applied: "모든 세션의 '인출 테스트' 단계는 읽기가 아니라 백지에 쓰기/셀프 퀴즈를 하도록 설계했어요.",
  },
  {
    title: "인터리빙 (Interleaving)",
    source: "Rohrer & Taylor, 2007, Instructional Science",
    mechanism: "같은 유형을 몰아 푸는 것보다 다른 과목·유형을 섞어서 공부하면 변별력이 늘어 장기적으로 더 잘 남습니다.",
    applied: "하루 루틴을 짤 때 약점 과목 비중은 높이되, 같은 과목이 연속되지 않도록 자동으로 섞어 배치해요.",
  },
  {
    title: "작업기억과 청킹 (Working Memory & Chunking)",
    source: "Miller, 1956 / Cowan, 2001",
    mechanism: "작업기억은 한 번에 4±1개의 정보 묶음만 유지할 수 있는 좁은 병목입니다. 의미 단위로 묶으면 담기는 정보량이 늘어납니다.",
    applied: "한 세션당 새 개념은 1~2개로 제한하고, 학습 단계 시간을 전체 세션 길이에 비례해 압축했어요.",
  },
  {
    title: "수면과 기억 공고화",
    source: "Diekelmann & Born, 2010, Nature Reviews Neuroscience",
    mechanism: "수면 중 해마에 저장된 정보가 대뇌피질로 재생되며 장기기억으로 옮겨집니다. 수면 부족은 이 전이를 직접 방해합니다.",
    applied: "취침 시간을 반드시 입력받고, 마지막 복습 슬롯을 취침 직전에 배치해요. 벼락치기보다 이 슬롯을 우선하도록 설계했어요.",
  },
  {
    title: "도파민과 진행 신호",
    source: "Schultz, 1998 (예측 오류 이론)",
    mechanism: "도파민은 보상 자체보다 '보상을 예측하는 과정'과 명확한 진행 표시에 더 강하게 반응합니다.",
    applied: "XP 바, 레벨, 스트릭, 뱃지로 눈에 보이는 진행 신호를 계속 제공해요.",
  },
  {
    title: "자기결정이론 (Self-Determination Theory)",
    source: "Deci & Ryan, 1985",
    mechanism: "자율성(스스로 선택), 유능감(할 수 있다는 감각), 관계성 세 가지가 채워질 때 내재적 동기가 유지됩니다.",
    applied: "과목·보상·세션 길이를 직접 선택하게 하고(자율성), 세션을 잘게 쪼개 성취를 자주 느끼게 했어요(유능감).",
  },
  {
    title: "포그 행동 모델 (Fogg Behavior Model, B=MAP)",
    source: "Fogg, 2009",
    mechanism: "행동은 동기(Motivation), 실행 난이도(Ability), 계기(Prompt)가 동시에 충분할 때 일어납니다. 동기가 낮아도 난이도를 낮추고 명확한 계기를 주면 행동이 시작됩니다.",
    applied: "각 세션에 '2분짜리 시작 행동'을 붙여 진입 장벽(Ability)을 낮추고, 시간·장소가 명시된 실행 의도 문장을 계기로 제공해요.",
  },
  {
    title: "실행 의도 (Implementation Intentions)",
    source: "Gollwitzer, 1999",
    mechanism: "'언제, 어디서, 무엇을 할지'를 구체적으로 미리 정해두면 실제로 그 행동을 실행할 확률이 크게 올라갑니다.",
    applied: "모든 세션 카드에 '몇 시에, 어디서, 무엇을 한다' 형태의 문장을 자동으로 생성해요.",
  },
  {
    title: "템테이션 번들링 (Temptation Bundling)",
    source: "Milkman, Minson & Volpp, 2014",
    mechanism: "해야 하지만 하기 싫은 일과, 하고 싶지만 급하지 않은 즐거움을 묶으면 실행률이 올라갑니다.",
    applied: "오늘의 루틴을 다 마쳐야 열리는 '오늘의 보상' 카드로 즐거운 활동을 학습 완료와 묶었어요.",
  },
  {
    title: "습관 형성 소요 기간",
    source: "Lally et al., 2010, European Journal of Social Psychology",
    mechanism: "새 습관이 자동화되기까지 평균 66일(개인차 18~254일) 걸립니다. 하루 이틀 끊긴다고 처음부터 다시 시작하는 게 아닙니다.",
    applied: "스트릭이 끊겨도 이전 기록은 배지로 남고, 총 XP는 초기화되지 않도록 설계했어요.",
  },
  {
    title: "미루기의 시간할인 모델 (Temporal Motivation Theory)",
    source: "Steel, 2007, Psychological Bulletin",
    mechanism: "보상이 멀고 불확실할수록, 과제가 어렵고 재미없을수록 미루는 경향이 커집니다. 기한을 가깝고 구체적으로 쪼개면 미루기가 줄어듭니다.",
    applied: "'국어 마스터하기' 같은 먼 목표 대신 25~40분짜리 세션 단위로 쪼개고, 각 세션에 즉시 확인 가능한 체크리스트를 붙였어요.",
  },
];
