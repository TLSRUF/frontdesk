// data/starter-pack.json에 있는 부서별 대표 스킬을 실제로 `npx skills add`로 설치한다.
//
// 안전 노트: skills CLI 자신도 "이 스킬들은 full agent permission으로 실행되니 쓰기 전에
// 검토하라"고 경고한다. 이 스크립트는 그 경고를 우회하지 않는다 — 기본 실행은 무엇을
// 설치할지 먼저 출력하고, --yes를 명시적으로 줘야 실제로 설치가 진행된다.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const yes = args.includes("--yes") || args.includes("-y");
const agentArg = args.find((a) => a.startsWith("--agent="));
const agent = agentArg ? agentArg.split("=")[1] : "claude-code";

const pack = JSON.parse(readFileSync("data/starter-pack.json", "utf8"));

console.log(`스타터팩 (${pack.granularity} 기준, ${pack.picks.length}개) — ${pack.note}\n`);
for (const p of pack.picks) {
  console.log(`  [${p.group}] ${p.group_name}`);
  console.log(`    ${p.name} (${p.installs.toLocaleString()} installs)`);
  console.log(`    ${p.install}`);
}

if (!yes) {
  console.log(`\n위 ${pack.picks.length}개 서드파티 저장소를 실제로 설치하려면 --yes를 붙여 다시 실행하세요:`);
  console.log(`  node scripts/install-starter-pack.mjs --yes`);
  console.log(`\n주의: 설치되는 스킬은 이 프로젝트가 검증한 게 아니라 각자의 저장소다. 설치 전 링크를 직접 확인하는 걸 권장한다.`);
  process.exit(0);
}

console.log(`\n설치를 시작합니다 (--agent=${agent})...\n`);
let ok = 0;
let failed = [];
for (const p of pack.picks) {
  const spec = p.install.replace(/^npx skills add /, "");
  try {
    execFileSync("npx", ["-y", "skills", "add", spec, "--agent", agent, "-y"], {
      encoding: "utf8",
      shell: true,
      stdio: "inherit"
    });
    ok++;
  } catch (err) {
    failed.push({ name: p.name, error: err.message.split("\n")[0] });
  }
}

console.log(`\n완료: ${ok}/${pack.picks.length}개 설치 성공`);
if (failed.length) {
  console.log(`실패:`);
  for (const f of failed) console.log(`  - ${f.name}: ${f.error}`);
}
