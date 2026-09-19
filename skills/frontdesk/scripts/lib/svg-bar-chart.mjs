// 의존성 없이 README에 바로 임베드할 수 있는 가로 막대 차트 SVG를 생성한다.
// (차트 라이브러리를 새로 설치하는 대신 순수 문자열 템플릿으로 충분하다 — ponytail식 사다리 3단계: "표준 라이브러리에 있는가" 이전에 "이렇게 간단한 건 그냥 짜는 게 낫다".)
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function barChart({ title, subtitle, bars, width = 720, unit = "%", maxValue }) {
  const leftPad = 220;
  const rightPad = 70;
  const barHeight = 34;
  const barGap = 16;
  const topPad = title ? 64 : 24;
  const bottomPad = 24;
  const chartWidth = width - leftPad - rightPad;
  const max = maxValue ?? Math.max(...bars.map((b) => b.value)) * 1.15;
  const height = topPad + bars.length * (barHeight + barGap) + bottomPad;

  const barsSvg = bars
    .map((b, i) => {
      const y = topPad + i * (barHeight + barGap);
      const w = Math.max(2, (b.value / max) * chartWidth);
      const color = b.color || "#4f46e5";
      return `
    <text x="${leftPad - 12}" y="${y + barHeight / 2 + 5}" text-anchor="end" font-size="15" fill="#1f2937" font-family="Segoe UI, Arial, sans-serif">${esc(b.label)}</text>
    <rect x="${leftPad}" y="${y}" width="${chartWidth}" height="${barHeight}" fill="#e5e7eb" rx="4" />
    <rect x="${leftPad}" y="${y}" width="${w}" height="${barHeight}" fill="${color}" rx="4" />
    <text x="${leftPad + w + 10}" y="${y + barHeight / 2 + 5}" font-size="15" fill="#111827" font-family="Segoe UI, Arial, sans-serif" font-weight="600">${esc(b.value)}${unit}</text>`;
    })
    .join("");

  const titleSvg = title
    ? `<text x="24" y="30" font-size="19" fill="#111827" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${esc(title)}</text>` +
      (subtitle ? `<text x="24" y="50" font-size="13" fill="#6b7280" font-family="Segoe UI, Arial, sans-serif">${esc(subtitle)}</text>` : "")
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
  ${titleSvg}
  ${barsSvg}
</svg>`;
}
