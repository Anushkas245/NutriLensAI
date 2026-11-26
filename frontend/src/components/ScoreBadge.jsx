export function getVerdictStyle(verdict, grade) {
  if (grade === 'A' || verdict?.includes('Clean')) {
    return {
      bg: 'bg-[#E9F4EC]',
      border: 'border-[#BFE0C7]',
      text: 'text-[#1E5631]',
      ring: '#3E8E58',
      pill: 'bg-[#DFF0E4] text-[#1D5330]',
    };
  }
  if (grade === 'B' || verdict?.includes('Moderate')) {
    return {
      bg: 'bg-[#F3F8EE]',
      border: 'border-[#D1E3C2]',
      text: 'text-[#396227]',
      ring: '#6A994E',
      pill: 'bg-[#EAF3E1] text-[#396227]',
    };
  }
  if (grade === 'C' || verdict?.includes('Limit')) {
    return {
      bg: 'bg-[#FFF8EC]',
      border: 'border-[#F2DAB0]',
      text: 'text-[#8C5A12]',
      ring: '#D48A29',
      pill: 'bg-[#FDF0D9] text-[#8C5A12]',
    };
  }
  if (grade === 'D' || verdict?.includes('Ultra-Processed') || verdict?.includes('Concern')) {
    return {
      bg: 'bg-[#FDF3F1]',
      border: 'border-[#F0CBC4]',
      text: 'text-[#96382C]',
      ring: '#C85546',
      pill: 'bg-[#FBE6E3] text-[#96382C]',
    };
  }
  return {
    bg: 'bg-[#F4F6F4]',
    border: 'border-[#DCE3DD]',
    text: 'text-[#52655A]',
    ring: '#8FA196',
    pill: 'bg-[#EAEEEB] text-[#52655A]',
  };
}

export function getNovaStyle(group) {
  switch (group) {
    case 1:
      return 'bg-[#E7F4EA] text-[#1F5932] border-[#C3E3CB]';
    case 2:
      return 'bg-[#F0F6EC] text-[#3B5F32] border-[#D5E4CC]';
    case 3:
      return 'bg-[#FFF7E8] text-[#8A5810] border-[#F2D8A7]';
    case 4:
      return 'bg-[#FDF1EF] text-[#96382C] border-[#F0CAC3]';
    default:
      return 'bg-[#F2F5F2] text-[#5E7266] border-[#DCE4DD]';
  }
}

export function ScoreRing({ score, grade, verdict, size = 'md' }) {
  const style = getVerdictStyle(verdict, grade);
  const dim = size === 'lg' ? 108 : 76;
  const radius = size === 'lg' ? 44 : 30;
  const stroke = size === 'lg' ? 8 : 6;
  const circumference = 2 * Math.PI * radius;
  const progress = score != null ? (score / 100) * circumference : 0;

  return (
    <div className="flex items-center gap-3.5">
      <div className="relative flex items-center justify-center" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="-rotate-90">
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke="#E7EFE8"
            strokeWidth={stroke}
          />
          {score != null && (
            <circle
              cx={dim / 2}
              cy={dim / 2}
              r={radius}
              fill="none"
              stroke={style.ring}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-['Plus_Jakarta_Sans'] font-extrabold tabular-nums text-[#143326] ${size === 'lg' ? 'text-2xl' : 'text-lg'}`}>
            {score != null ? score : '—'}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6A7D72]">
            {score != null ? '/ 100' : 'N/A'}
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          {grade && grade !== 'N/A' && (
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-extrabold ${style.pill}`}>
              {grade}
            </span>
          )}
          <span className={`text-sm font-bold ${style.text}`}>{verdict || 'Incomplete Data'}</span>
        </div>
        <p className="mt-0.5 text-xs text-[#6A7D72]">
          {score != null ? 'Deterministic label score' : 'Insufficient core data'}
        </p>
      </div>
    </div>
  );
}
