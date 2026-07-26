#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  auditReportCss,
  auditVisualCss,
  renderAuditVisuals,
  sourceDocumentAudit,
  sourceVisualAudit,
  sourceVisualInventory,
  visualCorrections,
  visualManifest,
} from "./gold-audit-visuals.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const caseDir = path.join(repoRoot, "docs", "case-studies");
const evidencePath = path.join(caseDir, "zhikuncode-codex-gold-monitor-evidence.json");
const outputPath = path.join(caseDir, "zhikuncode-codex-gold-monitor-audit.html");
const privateLogPath = path.join(caseDir, "zhikuncode黄金监控运行日志.log");
const publicLogExcerptRelativePath = "zhikuncode-gold-monitor-log-excerpts.txt";
const publicLogExcerptPath = path.join(caseDir, publicLogExcerptRelativePath);
const data = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
data.reportVersion = "1.5.2";
data.sourceVisualAudit = sourceVisualAudit;
data.visualCorrections = visualCorrections;
const runtimeVersionFinding = data.findings.find((finding) => finding.id === "F16");
if (runtimeVersionFinding) {
  runtimeVersionFinding.body = "审计参考提交 aa1b3173… 的源码能解释日志中的类、方法与结构化事件，但日志没有记录运行构建 Git SHA，不能证明运行二进制与该参考提交逐字节一致。";
}
const auditCommit = data.sourceCommits.zhikuncodeAuditReference;
const frozenFactsSha256 = "16a2650b21380b94838ad8a05251b1f8e77c84b927b4c0e6d02e458adacc48e9";
const cliArgs = process.argv.slice(2);
const readOption = (name) => {
  const index = cliArgs.indexOf(name);
  return index >= 0 ? cliArgs[index + 1] : null;
};
const verifyPrivateSources = cliArgs.includes("--verify-private-sources");
const zhikunSourceReportPath = readOption("--zhikun-report");
const comparisonSourceReportPath = readOption("--comparison-report");

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

const publicLogSelections = [
  { title: "MCP 断线、退避重连与工具重新发现", lines: [[26, 34], [43, 43]], supports: ["E027", "E038"] },
  { title: "断路器恢复", lines: [[47, 47], [54, 55], [63, 63], [93, 93]], supports: ["E027", "E037", "E038"] },
  { title: "第一批四项结构化澄清", lines: [[101, 101], [107, 109], [113, 115], [119, 120], [127, 130]], supports: ["E025", "E027", "E037", "E038"] },
  { title: "模型过载结束首个 Run，用户人工切换后继续", lines: [[149, 151], [163, 163], [176, 176], [186, 190], [195, 195], [200, 201]], supports: ["E027", "E037", "E038"] },
  { title: "三个不同方向的研究子 Agent 重叠启动", lines: [[249, 252], [310, 313], [329, 332]], supports: ["E027", "E037", "E038"] },
  { title: "Session Grant 与 Bash 错误分类", lines: [[1248, 1252], [2159, 2159], [2162, 2162], [2299, 2299], [2302, 2302]], supports: ["E027", "E038"] },
  { title: "三个研究子 Agent 的文件产出与成功回流", lines: [[6576, 6576], [6703, 6703], [6740, 6740], [6812, 6812], [6855, 6855], [6888, 6888]], supports: ["E027", "E037"] },
  { title: "第二批澄清与 pending interaction 重放", lines: [[7037, 7037], [7049, 7050], [7076, 7076], [7083, 7083], [7086, 7086]], supports: ["E027", "E037", "E038"] },
  { title: "Plan Mode 进入与退出", lines: [[7211, 7211], [7261, 7261]], supports: ["E027", "E037", "E038"] },
  { title: "第三个主 Run、实现 Agent 与首批文件产物", lines: [[7349, 7349], [7356, 7356], [7513, 7515], [7774, 7774], [7791, 7791], [7860, 7860], [7903, 7903], [7947, 7947], [8034, 8034], [10801, 10802]], supports: ["E027", "E037"] },
  { title: "修复 Agent、文件版本追踪与第二次轮次上限", lines: [[12546, 12550], [12926, 12927], [14252, 14253]], supports: ["E027", "E037", "E038"] },
  { title: "VerifyJourney 后继续返工", lines: [[15025, 15025], [15031, 15031], [15035, 15035], [15057, 15057], [15061, 15061], [15166, 15167]], supports: ["E027", "E037", "E038"] },
  { title: "上下文诊断、Brief、成功终止与消息完成", lines: [[16794, 16796], [16988, 16988], [16995, 16996], [17020, 17025]], supports: ["E027", "E037", "E038"] },
  { title: "完成后的会话重新绑定与状态恢复", lines: [[17084, 17090]], supports: ["E027", "E037", "E038"] },
];

const redactLogLine = (line) => line
  .replaceAll(/\/Users\/[^/\s]+\/Desktop\/code\/zhikun\/zhikuncode/g, "<WORKSPACE>")
  .replaceAll(/\/Users\/[^/\s]+\/[^\s,)\]}]+/g, "<LOCAL_PATH>")
  .replaceAll(/\/var\/folders\/[^\s,)\]}]+/g, "<TEMP_PATH>")
  .replaceAll(/\/tmp\/[^\s,)\]}]+/g, "<TEMP_PATH>")
  .replaceAll(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<UUID>")
  .replaceAll(/\bagent-[0-9a-f]{8}\b/gi, "agent-<ID>")
  .replaceAll(/\bcall_[0-9a-f]+\b/gi, "call_<ID>")
  .replaceAll(/\btransport-[0-9a-f-]+\b/gi, "transport-<ID>")
  .replaceAll(/\btransportId=[^,\s]+/gi, "transportId=<ID>")
  .replaceAll(/\btransport=[^,\s]+/gi, "transport=<ID>")
  .replaceAll(/\bcallId=[^,\s]+/gi, "callId=<ID>");

const buildPublicLogExcerpt = () => {
  const privateArtifact = data.artifacts.find((artifact) => artifact.type === "private-log");
  const publicArtifact = data.artifacts.find((artifact) => artifact.type === "public-log-excerpt");
  assert(privateArtifact, "private log artifact is missing");
  assert(publicArtifact, "public log excerpt artifact is missing");

  if (fs.existsSync(privateLogPath)) {
    const rawBytes = fs.readFileSync(privateLogPath);
    const rawText = rawBytes.toString("utf8");
    const rawLines = rawText.split(/\r?\n/);
    if (rawLines.at(-1) === "") rawLines.pop();
    assert(rawBytes.length === privateArtifact.bytes, "private log byte count does not match frozen evidence");
    assert(rawLines.length === privateArtifact.lines, "private log line count does not match frozen evidence");
    assert(sha256(rawBytes) === privateArtifact.sha256, "private log SHA-256 does not match frozen evidence");

    const count = (pattern) => rawLines.filter((line) => pattern.test(line)).length;
    const mainToolCalls = rawLines
      .filter((line) => line.includes("zhiku-ws-query-") && line.includes("flushToolBlock: toolId=") && line.includes("toolName="))
      .map((line) => {
        const match = line.match(/toolId=([^,]+), toolName=([^, ]+)/);
        assert(match, "unable to parse a main coordinator tool call");
        return { id: match[1], tool: match[2] };
      });
    const mainToolIds = new Set(mainToolCalls.map((call) => call.id));
    const mainFailures = rawLines.flatMap((line) => {
      const match = line.match(/Evaluating cascade: tool=([^,]+), toolUseId=([^,]+).*failureCode=([^,]+)/);
      return match && mainToolIds.has(match[2]) ? [{ tool: match[1], id: match[2], code: match[3] }] : [];
    });
    const toolCounts = mainToolCalls.reduce((counts, call) => {
      counts[call.tool] = (counts[call.tool] || 0) + 1;
      return counts;
    }, {});
    const assertLogLine = (lineNumber, pattern, label) => {
      const line = rawLines[lineNumber - 1] || "";
      assert(pattern.test(line), `${label} not found at frozen log L${lineNumber}`);
    };
    assertLogLine(63, /Circuit breaker: OPEN → HALF_OPEN/, "circuit breaker recovery");
    assertLogLine(93, /Circuit breaker: HALF_OPEN → CLOSED/, "circuit breaker close");
    assertLogLine(101, /sending question 1\/4: '你说的"监控国家对黄金回购/, "first clarification question");
    assertLogLine(109, /sending question 2\/4: '金价方面你想看哪些品种？'/, "second clarification question");
    assertLogLine(115, /sending question 3\/4: '银行积存金价格/, "third clarification question");
    assertLogLine(120, /sending question 4\/4: '你希望这个监控工具以什么形式呈现？/, "fourth clarification question");
    assertLogLine(149, /Model HTTP response: code=429/, "Kimi K3 HTTP 429");
    assertLogLine(187, /WS set_model: .*model=glm-5\.2/, "manual model switch");
    assertLogLine(7037, /sending question 1\/2: '既然银行积存金实时报价抓不到/, "second-batch first question");
    assertLogLine(7049, /type=ELICITATION, status=ANSWERED/, "second-batch first answer");
    assertLogLine(7050, /sending question 2\/2: '这个监控工具的代码放哪里？'/, "second-batch second question");
    assertLogLine(7076, /Replayed 1 pending interactions/, "pending interaction replay");
    assertLogLine(7083, /type=ELICITATION, status=ANSWERED/, "second-batch second answer");
    assertLogLine(7086, /Tool AskUserQuestion completed/, "second-batch AskUserQuestion completion");
    assertLogLine(16995, /turn=44 outcome=NO_GAIN .*positiveCount=0 .*netCharsFreed=0/, "turn 44 no-gain context collapse");
    assertLogLine(17023, /push\(message_complete\)/, "final message completion");
    assert(count(/Tool AskUserQuestion completed/) === 2, "expected two AskUserQuestion completions");
    assert(count(/type=ELICITATION/) === 6, "expected six ELICITATION decisions");
    assert(count(/type=PERMISSION/) === 83, "expected 83 PERMISSION decisions");
    assert(count(/Tool Agent completed/) === 5, "expected five Agent completions");
    assert(count(/Tool Agent completed.*error=true/) === 2, "expected two failed Agent completions");
    assert(mainToolCalls.length === 60, "expected 60 main coordinator tool calls");
    assert(toolCounts.Bash === 26 && toolCounts.Read === 13 && toolCounts.Edit === 6 && toolCounts.Agent === 5, "main tool distribution drifted");
    assert(mainFailures.length === 6, "expected six main coordinator tool failures");
    assert(mainFailures.filter((failure) => failure.code === "SUBAGENT_MAX_TURNS").length === 2, "expected two max-turn failures");
    assert(mainFailures.filter((failure) => failure.code === "MESSAGE_AGENT_NOT_FOUND").length === 1, "expected one SendMessage failure");
    assert(mainFailures.filter((failure) => failure.code === "BASH_NON_RETRYABLE").length === 3, "expected three Bash failures");
    assert(data.toolFingerprint.length === mainToolCalls.length, "tool fingerprint length does not match frozen log");
    const mainFailureById = new Map(mainFailures.map((failure) => [failure.id, failure]));
    for (const [index, call] of mainToolCalls.entries()) {
      const fingerprint = data.toolFingerprint[index];
      assert(fingerprint.index === index + 1, `tool fingerprint index drift at ${index + 1}`);
      assert(fingerprint.tool === call.tool, `tool fingerprint tool drift at ${index + 1}`);
      const failure = mainFailureById.get(call.id);
      assert((fingerprint.status === "error") === Boolean(failure), `tool fingerprint result drift at ${index + 1}`);
      if (failure) {
        const expectedDetail =
          failure.code === "SUBAGENT_MAX_TURNS" ? "SUBAGENT_MAX_TURNS" :
            failure.code === "MESSAGE_AGENT_NOT_FOUND" ? "Agent not found" : "exit 1";
        assert(fingerprint.detail === expectedDetail, `tool fingerprint failure detail drift at ${index + 1}`);
      }
    }

    const summary = [
      "ZhikunCode 黄金监控任务 · 脱敏关键运行日志摘录",
      "================================================",
      "",
      `原始日志 SHA-256: ${privateArtifact.sha256}`,
      `原始日志规模: ${privateArtifact.lines} 行 / ${privateArtifact.bytes} 字节`,
      "任务日期: 2026-07-23 · Asia/Shanghai",
      "公开范围: 仅发布支撑报告关键结论的原始行；不发布完整日志。",
      "脱敏规则: UUID、会话/Run/Interaction/ToolUse 标识、本机绝对路径、临时目录。",
      "计数校验: AskUserQuestion=2；ELICITATION=6；PERMISSION=83；Agent=5（其中 max-turns 为2）；主协调器工具调用=60（54 正常 / 6 错误）。",
      "工具分布: Bash=26；Read=13；Edit=6；Agent=5；其他控制与验证工具=10。",
      "主链错误: SUBAGENT_MAX_TURNS=2；MESSAGE_AGENT_NOT_FOUND=1；BASH_NON_RETRYABLE=3。",
      "说明: PERMISSION=83 是控制面决策记录数量，不等同于 83 次人工弹窗或点击。",
      "",
    ];
    const excerptLines = [...summary];
    for (const selection of publicLogSelections) {
      excerptLines.push(`## ${selection.title}`);
      for (const [start, end] of selection.lines) {
        assert(start >= 1 && end >= start && end <= rawLines.length, `invalid public log excerpt range L${start}–L${end}`);
        for (let lineNumber = start; lineNumber <= end; lineNumber += 1) {
          excerptLines.push(`L${lineNumber} ${redactLogLine(rawLines[lineNumber - 1])}`);
        }
      }
      excerptLines.push("");
    }
    fs.writeFileSync(publicLogExcerptPath, `${excerptLines.join("\n").trimEnd()}\n`);
  }

  assert(fs.existsSync(publicLogExcerptPath), "public log excerpt is missing");
  const excerptBytes = fs.readFileSync(publicLogExcerptPath);
  const excerptText = excerptBytes.toString("utf8");
  assert(!excerptText.includes("/Users/"), "public log excerpt leaks an absolute user path");
  assert(!excerptText.includes("/var/folders/"), "public log excerpt leaks a temporary path");
  assert(!/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(excerptText), "public log excerpt leaks a UUID");
  assert(!/\bBearer\s+[A-Za-z0-9._~-]{12,}/.test(excerptText), "public log excerpt leaks a bearer token");
  assert(!/\b(?:Cookie|Authorization)\s*:/i.test(excerptText), "public log excerpt leaks a request header");

  publicArtifact.sha256 = sha256(excerptBytes);
  publicArtifact.bytes = excerptBytes.length;
  publicArtifact.lines = excerptText.split(/\r?\n/).filter((line, index, lines) => index < lines.length - 1 || line !== "").length;
  publicArtifact.sourceSha256 = privateArtifact.sha256;
  publicArtifact.lineSegments = publicLogSelections.flatMap((selection) =>
    selection.lines.map(([start, end]) => ({ start, end })));
  publicArtifact.sectionCount = publicLogSelections.length;
  const publicSegmentsByEvidence = new Map();
  for (const selection of publicLogSelections) {
    for (const evidenceId of selection.supports) {
      const segments = publicSegmentsByEvidence.get(evidenceId) || [];
      segments.push(...selection.lines.map(([start, end]) => ({ start, end })));
      publicSegmentsByEvidence.set(evidenceId, segments);
    }
  }
  for (const [evidenceId, segments] of publicSegmentsByEvidence) {
    const evidence = data.evidence.find((item) => item.id === evidenceId);
    assert(evidence, `${evidenceId} is missing`);
    if (["E025", "E027", "E037"].includes(evidenceId)) evidence.publicPath = publicLogExcerptRelativePath;
    evidence.publicLogPath = publicLogExcerptRelativePath;
    evidence.publicVerification = "partial";
    evidence.publicExcerptLineSegments = segments;
    if (evidence.sourceTypes.includes("log")) evidence.lineSegments = segments;
  }
  const screenshotOnlyInteraction = data.evidence.find((item) => item.id === "E026");
  screenshotOnlyInteraction.publicExcerptLineSegments = [];
  delete screenshotOnlyInteraction.publicLogPath;
  fs.writeFileSync(evidencePath, `${JSON.stringify(data, null, 2)}\n`);
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");
const displayText = (value) => String(value ?? "").replaceAll(/\bGLM5\.2\b/g, "GLM-5.2");
const publicReasonRewrites = new Map([
  [
    "27分49秒完成数据源、界面、API、构建和线上发布，墙钟明确；但缺少与另外两套统一口径的 Token、主动执行时间和同环境测量，不把不可比项作为高分依据。",
    "27分49秒完成数据源、界面、API、构建和线上发布。由于没有统一口径的 Token、主动执行时间和同环境测量，本项只评价能够直接观察的墙钟时间。",
  ],
  [
    "产物包含响应式 React 仪表盘、服务端聚合 API、5 个并发上游任务、缓存、错误汇总和客户端轮询；六家银行状态与全球央行视图增加能力面，但四家银行为入口壳、央行数组为静态数据，因此不按展示模块数量授予更高分。",
    "产物包含响应式 React 仪表盘、服务端聚合 API、5 个并发上游任务、缓存、错误汇总和客户端轮询。页面列出六家银行和全球央行，但四家银行只有核验入口，央行数组也是静态数据；这些模块不能按完整动态功能计分。",
  ],
  [
    "覆盖国际/国内、六家银行名称与全球央行视图；但只有 2/6 家银行有公开报价，其余四家仅引导 App 核验。全球央行模块是固定客户端快照，页面刷新和 60 秒轮询均不会更新，未实现原需求要求的持续监控，因此按严重需求缺口计分。",
    "页面覆盖国际/国内金价、六家银行名称和全球央行视图，但只有 2/6 家银行有公开报价，其余四家仅引导 App 核验。全球央行模块是固定客户端快照，页面刷新和 60 秒轮询都不会更新，因此持续监控需求没有完整实现。",
  ],
  [
    "SGE 与 WGC 5月净额及国家榜主要值一致，无法验证的银行价没有伪造成交价；但全球央行数据硬编码，4月净额 +17 吨与 WGC 修订后 +19 吨不符，页面刷新不会拉取修订或新月份，数据会持续过期，因此按严重时效性与修订风险计分。",
    "SGE 与 WGC 5月净额及国家榜主要值一致，无法验证的银行价格也没有被写成真实成交价。但全球央行数据是硬编码的，4月净额 +17 吨与 WGC 修订后的 +19 吨不符，页面刷新不会拉取修订或新月份。",
  ],
  [
    "客户端与服务端分层、Promise.allSettled 并发隔离、HTTP 缓存、类型化响应和托管交付均可验证；但央行这一核心需求绕过服务端 API，直接硬编码在客户端且无法自动更新，是明显的架构断层；共享运行时 schema 缺失、四家银行只存在客户端壳，认证边界也限制交付适配。该问题已包含在本维度现有扣分中，不再重复追加专项扣分。",
    "客户端与服务端分层、Promise.allSettled 并发隔离、HTTP 缓存、类型化响应和托管交付均可验证。央行数据却绕过服务端 API，直接写在客户端且无法自动更新；此外缺少共享运行时 schema，四家银行只有客户端入口，线上认证也限制了访问。",
  ],
  [
    "TypeScript、并发隔离和缓存策略提供良好基础，构建成功；但 2/2 自动化测试失效，lint 有错误，仓库 typecheck 退出码为 2，不能视为绿色质量基线。",
    "项目使用 TypeScript、并发隔离和缓存策略，构建能够完成；但 2/2 自动化测试失败，lint 有错误，仓库 typecheck 退出码为 2，质量检查没有全部通过。",
  ],
]);

const publicNarrativeText = (value) => {
  const normalized = displayText(value)
    .replaceAll(/日志 usage 累计约14\.00M，非统一计费口径(?:，不能跨系统直接比较)?。/g, "")
    .replaceAll(/\s{2,}/g, " ")
    .trim();
  return publicReasonRewrites.get(normalized) ?? normalized;
};

const evidenceLink = (id) =>
  `<a class="evidence-ref" href="#evidence-${escapeHtml(id)}">${escapeHtml(id)}</a>`;

const evidenceLinks = (ids) => ids.map(evidenceLink).join(" ");
const sourceLink = (relativePath, label = path.basename(relativePath)) =>
  `<a href="https://github.com/zhikunqingtao/zhikuncode/blob/${escapeHtml(auditCommit)}/${escapeHtml(relativePath)}" target="_blank" rel="noopener noreferrer"><code>${escapeHtml(label)}</code> ↗</a>`;

const assert = (condition, message) => {
  if (!condition) throw new Error(`Audit validation failed: ${message}`);
};

const round1 = (value) => Math.round((value + 1e-9) * 10) / 10;
const calculateScore = (dimensions, key = "value") =>
  dimensions.reduce((total, dimension) => total + dimension.weight * dimension[key] / 10, 0);

const scoreById = Object.fromEntries(data.scores.map((score) => [score.systemId, score]));
const zhikunScore = scoreById.zhikun;
const codexScore = scoreById.codex;

const computed = Object.fromEntries(data.scores.map((score) => [
  score.systemId,
  {
    score: round1(calculateScore(score.dimensions)),
    min: round1(calculateScore(score.dimensions, "min")),
    max: round1(calculateScore(score.dimensions, "max")),
    weight: score.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0),
  },
]));

const validateData = () => {
  assert(data.evidence.length === 38, "expected exactly 38 evidence records");
  const expectedIds = Array.from({ length: 38 }, (_, index) => `E${String(index + 1).padStart(3, "0")}`);
  const actualIds = data.evidence.map((item) => item.id);
  assert(new Set(actualIds).size === actualIds.length, "evidence IDs must be unique");
  assert(JSON.stringify(actualIds) === JSON.stringify(expectedIds), "evidence IDs must be continuous E001–E038");

  assert(data.dimensions.length === 14, "expected exactly 14 dimensions");
  assert(data.scores.length === 2, "expected exactly two scored systems");
  for (const score of data.scores) {
    assert(score.dimensions.length === 14, `${score.systemId} must contain 14 dimensions`);
    assert(computed[score.systemId].weight === 100, `${score.systemId} weights must total 100`);
    assert(computed[score.systemId].score === score.declaredScore, `${score.systemId} score drift`);
    assert(computed[score.systemId].min === score.declaredMin, `${score.systemId} minimum drift`);
    assert(computed[score.systemId].max === score.declaredMax, `${score.systemId} maximum drift`);
  }
  assert(computed.zhikun.score === 68.3 && computed.codex.score === 68.4, "declared case totals changed");
  assert(computed.zhikun.min === 62.6 && computed.zhikun.max === 73.7, "ZhikunCode interval changed");
  assert(computed.codex.min === 63.2 && computed.codex.max === 73.6, "Codex interval changed");
  assert(data.clarificationQuestions.length === 4, "expected four first-batch clarification questions");
  assert(
    data.clarificationQuestions.reduce((sum, question) => sum + question.options.length, 0) === 14,
    "expected fourteen first-batch clarification options",
  );
  const expectedFirstBatchQuestions = [
    "你说的“监控国家对黄金回购的频率及整体金额趋势”，具体是指哪一个？（这决定了数据来源和更新频率）",
    "金价方面你想看哪些品种？",
    "银行积存金价格，你主要关心哪些银行？（各家银行的积存金报价和手续费不同）",
    "你希望这个监控工具以什么形式呈现？（我需要知道你电脑的使用习惯）",
  ];
  assert(
    JSON.stringify(data.clarificationQuestions.map((question) => question.question)) === JSON.stringify(expectedFirstBatchQuestions),
    "first-batch clarification questions do not match the frozen run",
  );
  assert(data.secondBatchClarifications.length === 2, "expected two second-batch clarification questions");
  assert(
    data.secondBatchClarifications[0].question === "既然银行积存金实时报价抓不到，仪表盘里这块怎么处理？（核心是看 Au99.99 基准价，因为各行积存金都跟着它走）",
    "second-batch first question text drift",
  );
  assert(data.secondBatchClarifications[1].question === "这个监控工具的代码放哪里？", "second-batch second question text drift");
  assert(data.secondBatchClarifications[0].questionLine === 7037, "second-batch first question line drift");
  assert(data.secondBatchClarifications[1].questionLine === 7050, "second-batch second question line drift");
  assert(data.secondBatchClarifications[0].answerLine === 7049, "second-batch first answer line drift");
  assert(data.secondBatchClarifications[1].answerLine === 7083 && data.secondBatchClarifications[1].completionLine === 7086, "second-batch second answer/completion line drift");
  assert(data.secondBatchClarifications[0].optionsStatus === "partial", "first second-batch question must remain partial");
  assert(data.secondBatchClarifications[1].optionsStatus === "unavailable", "second second-batch question options must remain unavailable");
  assert(
    JSON.stringify(data.secondBatchClarifications[0].visibleOptions) === JSON.stringify(["基准价 + 各行估算区间（推荐）", "只显示基准价 + 说明"]),
    "second-batch visible option fragments drift",
  );
  assert(data.secondBatchClarifications[1].visibleOptions.length === 0, "unavailable options must not be invented");
  assert(data.executionPhases.length === 5, "expected five execution phases");
  assert(
    JSON.stringify(data.executionPhases.map((phase) => phase.id)) === JSON.stringify(["clarify", "research", "converge", "implement", "verify"]),
    "execution phase order drift",
  );
  assert(
    JSON.stringify(data.executionPhases.map((phase) => phase.time)) === JSON.stringify([
      "17:10:49–17:12:21",
      "17:14:20–17:27:15",
      "17:29:30–17:34:18",
      "17:34:27–18:30:38",
      "18:30:38–18:42:53",
    ]),
    "execution phase time boundaries drift",
  );
  const timeToSeconds = (value) => {
    const [hours, minutes, seconds] = value.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  };
  let previousPhaseEnd = 0;
  for (const phase of data.executionPhases) {
    const [start, end] = phase.time.split("–");
    const startSeconds = timeToSeconds(start);
    const endSeconds = timeToSeconds(end);
    assert(startSeconds >= previousPhaseEnd && endSeconds >= startSeconds, `execution phase ${phase.id} is not monotonic`);
    previousPhaseEnd = endSeconds;
  }
  assert(data.toolFingerprint.length === 60, "expected sixty ordered tool calls");
  assert(data.toolFingerprint.every((item, index) => item.index === index + 1), "tool fingerprint indices must be continuous");
  const expectedToolSequence = [
    "AskUserQuestion",
    "Agent", "Agent", "Agent",
    "Read",
    "Bash",
    "AskUserQuestion",
    "Read", "Read",
    "EnterPlanMode",
    "ExitPlanMode",
    "TodoWrite",
    "Bash",
    "Agent",
    ...Array(11).fill("Bash"),
    "SendMessage",
    "Agent",
    "Bash",
    "Bash", "Bash", "Bash",
    "Read", "Read",
    "Grep",
    "Bash",
    "Read",
    "VerifyJourney",
    "Read",
    "Edit",
    "Bash", "Bash", "Bash",
    "Read",
    "Edit", "Edit",
    "Read",
    "Edit",
    "Bash",
    "Read",
    "Edit",
    "Bash", "Bash",
    "Read", "Read",
    "Edit",
    "Bash",
    "Read",
    "Bash",
    "TodoWrite",
    "Brief",
  ];
  assert(
    JSON.stringify(data.toolFingerprint.map((item) => item.tool)) === JSON.stringify(expectedToolSequence),
    "tool fingerprint full order drift",
  );
  assert(
    JSON.stringify(data.toolFingerprint.filter((item) => item.status === "error").map((item) => item.index)) === JSON.stringify([14, 26, 27, 28, 52, 56]),
    "tool fingerprint error positions drift",
  );
  assert(
    JSON.stringify(data.toolFingerprint.filter((item) => item.status === "error").map((item) => item.detail)) ===
      JSON.stringify(["SUBAGENT_MAX_TURNS", "Agent not found", "SUBAGENT_MAX_TURNS", "exit 1", "exit 1", "exit 1"]),
    "tool fingerprint error details drift",
  );
  assert(data.researchLineage.researchAssets.length === 3, "expected three research lineage assets");
  assert(data.researchLineage.applicationFiles.length === 6, "expected six application lineage files");
  assert(
    JSON.stringify(data.researchLineage.researchAssets.map(({ editorLabel, file, hashPrefix }) => [editorLabel, file, hashPrefix])) ===
      JSON.stringify([
        ["国际金价研究 Agent", "gold_price_sources.md", "9700f9d196ac3548"],
        ["银行积存金研究 Agent", "bank_gold_sources.md", "5c05d12bb15cee82"],
        ["央行购金研究 Agent", "central_bank_gold_sources.md", "87f05fa76eeeb12d"],
      ]),
    "research asset lineage drift",
  );
  assert(
    JSON.stringify(data.researchLineage.applicationFiles.map(({ file, hashPrefix }) => [file, hashPrefix])) ===
      JSON.stringify([
        ["requirements.txt", "8ebf8da5b16a0ad9"],
        ["bank_config.py", "d1e4f2b0733774c0"],
        ["data_fetcher.py", "b2788cab92388970"],
        ["app.py", "1f085352caf30607"],
        ["start.command", "2f42544704ba55fc"],
        ["templates/index.html", "de370975402c9d77"],
      ]),
    "application file lineage drift",
  );
  assert(data.surfaceOwnership.length === 6, "expected six surface ownership rows");
  const validPressures = new Set(["配置级", "单层实现", "跨层实现", "数据生命周期重构"]);
  assert(data.surfaceOwnership.every((row) => validPressures.has(row.pressure)), "surface ownership pressure enum drift");
  assert(data.dataSourceMatrix.length === 6, "expected six data source matrix rows");
  const validDataStatuses = new Set(["dynamic-public", "derived-estimate", "static-snapshot", "verification-only", "missing", "different-instrument"]);
  for (const row of data.dataSourceMatrix) {
    assert(validDataStatuses.has(row.zhikun.status), `${row.domain} has invalid ZhikunCode data status`);
    assert(validDataStatuses.has(row.codex.status), `${row.domain} has invalid Codex data status`);
  }
  assert(
    JSON.stringify(data.dataSourceMatrix.map((row) => [row.domain, row.zhikun.status, row.codex.status])) ===
      JSON.stringify([
        ["国际黄金", "dynamic-public", "dynamic-public"],
        ["国内黄金", "different-instrument", "dynamic-public"],
        ["工商银行、建设银行", "derived-estimate", "dynamic-public"],
        ["农业、中国、招商、平安银行", "derived-estimate", "verification-only"],
        ["中国央行储备", "dynamic-public", "static-snapshot"],
        ["全球央行", "missing", "static-snapshot"],
      ]),
    "data source classification matrix drift",
  );
  assert(data.sourceVisualAudit.length === 46, "expected forty-six source SVG audit records");
  assert(data.sourceVisualAudit.filter((visual) => visual.status !== "omitted").length === 44, "expected forty-four published source SVGs");
  assert(data.sourceVisualAudit.filter((visual) => visual.status === "included").length === 32, "expected thirty-two primary source SVGs");
  assert(data.sourceVisualAudit.filter((visual) => visual.status === "merged").length === 12, "expected twelve merged source SVGs");
  assert(data.sourceVisualAudit.filter((visual) => visual.status === "omitted").length === 2, "expected two omitted source SVGs");
  assert(new Set(data.sourceVisualAudit.map((visual) => visual.key)).size === 46, "source SVG audit keys must be unique");
  assert(
    data.sourceVisualAudit.every((visual) =>
      visual.status === "omitted" ? visual.targetFigureId === null : visual.targetFigureId && visual.baseline.viewBox === visual.viewBox),
    "source SVG target or viewBox drift",
  );
  assert(
    data.sourceVisualAudit.filter((visual) => visual.status !== "omitted").every((visual) =>
      visual.baseline.textNodes === visual.semanticUnits.textNodes &&
      visual.baseline.shapes === visual.semanticUnits.shapes &&
      visual.baseline.groups === visual.semanticUnits.groups &&
      visual.baseline.paths === visual.semanticUnits.paths &&
      visual.baseline.geometrySha256 === visual.published.geometrySha256),
    "source SVG structure or geometry changed during publication",
  );
  const publicVisualTargets = data.sourceVisualAudit.filter((visual) => visual.status !== "omitted").map((visual) => visual.targetFigureId);
  assert(new Set(publicVisualTargets).size === visualManifest.length, "every thematic figure must receive a source SVG");
  assert(data.visualCorrections.length === 19, "expected nineteen controlled visual correction rules");
  assert(new Set(data.visualCorrections.map((correction) => correction.id)).size === data.visualCorrections.length, "visual correction ids must be unique");
  for (const correction of data.visualCorrections) {
    assert(correction.before && correction.after && correction.reason, `${correction.id} correction ledger entry is incomplete`);
    assert(correction.evidence.every((id) => data.evidence.some((item) => item.id === id)), `${correction.id} references missing evidence`);
    assert(correction.affectedSourceVisuals.every((key) => data.sourceVisualAudit.some((visual) => visual.key === key)), `${correction.id} references unknown source SVG`);
  }
  assert(data.executionDetails.agents.length === 5, "expected five sub-agent records");
  assert(
    data.executionDetails.agents.filter((agent) => agent.status === "SUCCESS").length === 3,
    "expected three successful research agents",
  );
  assert(
    data.executionDetails.agents.filter((agent) => agent.status === "SUBAGENT_MAX_TURNS").length === 2,
    "expected two max-turn sub-agents",
  );
  assert(
    data.executionDetails.toolDistribution.reduce((sum, item) => sum + item.count, 0) === 60,
    "tool distribution must total 60",
  );
  assert(
    data.executionDetails.toolResults.completed + data.executionDetails.toolResults.errors === 60,
    "tool results must total 60",
  );
  const evidenceById = Object.fromEntries(data.evidence.map((evidence) => [evidence.id, evidence]));
  assert(
    evidenceById.E025.excerpt.includes("央行/回购口径4项、金价品种3项、银行范围3项、交付形式4项"),
    "E025 must match the frozen run and source report",
  );
  assert(evidenceById.E025.sourceTypes.includes("log") && evidenceById.E025.sourceTypes.includes("document"), "E025 must preserve its dual provenance");
  assert(
    JSON.stringify(evidenceById.E025.publicExcerptLineSegments) ===
      JSON.stringify([{ start: 101, end: 101 }, { start: 107, end: 109 }, { start: 113, end: 115 }, { start: 119, end: 120 }, { start: 127, end: 130 }]),
    "E025 public excerpt must contain only its first-batch clarification lines",
  );
  assert(evidenceById.E018.publicVerification === "partial", "E018 protected URL must not be fully public");
  assert(
    evidenceById.E009.publicVerification === "partial" &&
      evidenceById.E009.publicPath.includes("quotation_daily_new?end_date=2026-07-23&start_date=2026-07-23"),
    "E009 must use the date-locked SGE page and disclose its partial reproducibility",
  );
  assert(
    evidenceById.E010.publicVerification === "public" &&
      evidenceById.E010.publicPath === "https://www.safe.gov.cn/safe/2026/0206/27116.html",
    "E010 must link directly to the official SAFE 2026 reserve data page",
  );
  assert(
    evidenceById.E026.sourceTypes.includes("screenshot") && evidenceById.E026.sourceTypes.includes("document"),
    "E026 must separate screenshot evidence from operator observation",
  );
  assert(
    evidenceById.E026.publicExcerptLineSegments.length === 0,
    "E026 must remain screenshot/document evidence without borrowed log ranges",
  );
  assert(
    new Set(["E025", "E027", "E037", "E038"].map((id) => JSON.stringify(evidenceById[id].publicExcerptLineSegments))).size === 4,
    "evidence-specific public excerpt ranges must not collapse to one shared range",
  );
  assert(!evidenceById.E038.excerpt.includes("当前 HEAD"), "E038 must name the audit reference commit");

  const validSourceTypes = new Set(["log", "code", "screenshot", "document"]);
  const validVerification = new Set(["verified", "partial", "unavailable"]);
  const validPublicVerification = new Set(["public", "partial", "private"]);
  const maxLogLines = data.artifacts.find((artifact) => artifact.type === "private-log")?.lines;
  for (const evidence of data.evidence) {
    assert(validSourceTypes.has(evidence.sourceType), `${evidence.id} has invalid sourceType`);
    assert(Array.isArray(evidence.sourceTypes) && evidence.sourceTypes.length > 0, `${evidence.id} is missing sourceTypes`);
    assert(evidence.sourceTypes.every((type) => validSourceTypes.has(type)), `${evidence.id} has invalid sourceTypes`);
    assert(validVerification.has(evidence.verification), `${evidence.id} has invalid verification`);
    assert(validPublicVerification.has(evidence.publicVerification), `${evidence.id} has invalid publicVerification`);
    assert(typeof evidence.sourceSubtype === "string" && evidence.sourceSubtype.length > 0, `${evidence.id} is missing sourceSubtype`);
    assert(Array.isArray(evidence.lineSegments), `${evidence.id} is missing lineSegments`);
    let previousEnd = 0;
    for (const segment of evidence.lineSegments) {
      assert(Number.isInteger(segment.start) && Number.isInteger(segment.end), `${evidence.id} line segment must be integer`);
      assert(segment.start > previousEnd && segment.end >= segment.start, `${evidence.id} lineSegments are not ordered`);
      if (evidence.sourceTypes.includes("log")) assert(segment.end <= maxLogLines, `${evidence.id} line segment exceeds log length`);
      previousEnd = segment.end;
    }
    if (evidence.publicExcerptLineSegments?.length) {
      assert(Array.isArray(evidence.publicExcerptLineSegments), `${evidence.id} is missing public excerpt line segments`);
      assert(evidence.sourceTypes.includes("log"), `${evidence.id} has log excerpts without a log source`);
      assert(evidence.publicLogPath === publicLogExcerptRelativePath, `${evidence.id} has log excerpts without the public log path`);
      let previousPublicEnd = 0;
      for (const segment of evidence.publicExcerptLineSegments) {
        assert(Number.isInteger(segment.start) && Number.isInteger(segment.end), `${evidence.id} public excerpt segment must be integer`);
        assert(segment.start > previousPublicEnd && segment.end >= segment.start, `${evidence.id} public excerpt segments are not ordered`);
        assert(segment.end <= maxLogLines, `${evidence.id} public excerpt segment exceeds log length`);
        assert(
          evidence.lineSegments.some((registered) => segment.start >= registered.start && segment.end <= registered.end),
          `${evidence.id} public excerpt segment is outside its registered log ranges`,
        );
        previousPublicEnd = segment.end;
      }
    }
  }

  const referencedIds = new Set([
    ...data.events.flatMap((event) => event.evidence),
    ...data.findings.flatMap((finding) => finding.evidence),
    ...data.scores.flatMap((score) => score.dimensions.flatMap((dimension) => dimension.evidence)),
    ...data.executionPhases.flatMap((phase) => phase.evidence),
    ...data.secondBatchClarifications.flatMap((question) => question.evidence),
    ...data.researchLineage.evidence,
    ...data.surfaceOwnership.flatMap((row) => row.evidence),
    ...data.dataSourceMatrix.flatMap((row) => row.evidence),
  ]);
  for (const id of referencedIds) assert(actualIds.includes(id), `dangling evidence reference ${id}`);

  const frozenFacts = {
    scores: data.scores.map((score) => ({
      systemId: score.systemId,
      declaredScore: score.declaredScore,
      declaredMin: score.declaredMin,
      declaredMax: score.declaredMax,
      dimensions: score.dimensions.map(({ id, weight, value, min, max, reason, evidence }) => ({
        id, weight, value, min, max, reason, evidence,
      })),
    })),
    findings: data.findings.map(({ id, system, title, body, severity, evidence }) => ({
      id, system, title, body, severity, evidence,
    })),
    evidence: data.evidence.map(({ id, legacyId, claim, excerpt, originalSha256, evidenceGrade, timestamp }) => ({
      id, legacyId, claim, excerpt, originalSha256, evidenceGrade, timestamp,
    })),
  };
  const actualFrozenFactsSha256 = crypto.createHash("sha256").update(JSON.stringify(frozenFacts)).digest("hex");
  assert(actualFrozenFactsSha256 === frozenFactsSha256, "frozen scores, findings or evidence excerpts drifted");
};

const verifyPrivateSourceReports = () => {
  if (!verifyPrivateSources) return;
  assert(zhikunSourceReportPath && comparisonSourceReportPath, "--verify-private-sources requires --zhikun-report and --comparison-report");
  assert(fs.existsSync(zhikunSourceReportPath), "ZhikunCode source report does not exist");
  assert(fs.existsSync(comparisonSourceReportPath), "comparison source report does not exist");
  const zhikunBytes = fs.readFileSync(zhikunSourceReportPath);
  const comparisonBytes = fs.readFileSync(comparisonSourceReportPath);
  const zhikunArtifact = data.artifacts.find((artifact) => artifact.label === "ZhikunCode 单系统报告");
  const comparisonArtifact = data.artifacts.find((artifact) => artifact.label === "双系统冻结比较报告");
  assert(sha256(zhikunBytes) === zhikunArtifact.sha256, "ZhikunCode source report SHA-256 mismatch");
  assert(sha256(comparisonBytes) === comparisonArtifact.sha256, "comparison source report SHA-256 mismatch");

  const zhikunHtml = zhikunBytes.toString("utf8");
  const comparisonHtml = comparisonBytes.toString("utf8");
  assert(sourceDocumentAudit.zhikun.sha256 === sha256(zhikunBytes), "embedded ZhikunCode source visual baseline hash drifted");
  assert(sourceDocumentAudit.comparison.sha256 === sha256(comparisonBytes), "embedded comparison source visual baseline hash drifted");
  const inventoryStatuses = new Set(["included", "merged", "omitted"]);
  assert(sourceVisualInventory.length === 46, "private visual inventory must register all forty-six top-level source SVGs");
  const inventoryKeys = sourceVisualInventory.map((item) => `${item.source}:${item.title}`);
  assert(new Set(inventoryKeys).size === inventoryKeys.length, "private visual inventory contains duplicate source/title entries");
  for (const item of sourceVisualInventory) {
    assert(["zhikun", "comparison"].includes(item.source), `invalid private visual source: ${item.source}`);
    assert(inventoryStatuses.has(item.status), `invalid private visual status: ${item.status}`);
    assert(item.reason.trim().length > 0, `private visual inventory reason missing: ${item.title}`);
    const sourceHtml = item.source === "zhikun" ? zhikunHtml : comparisonHtml;
    assert(sourceHtml.includes(`>${item.title}</title>`), `registered private visual reference is missing: ${item.title}`);
  }
  const extractTopLevelSvgTitles = (sourceHtml) =>
    [...sourceHtml.matchAll(/<svg\b[^>]*>[\s\S]*?<title[^>]*>([^<]+)<\/title>/g)].map((match) => match[1].trim());
  for (const [source, sourceHtml, expectedCount] of [
    ["zhikun", zhikunHtml, 28],
    ["comparison", comparisonHtml, 18],
  ]) {
    const sourceTitles = extractTopLevelSvgTitles(sourceHtml);
    const registeredTitles = sourceVisualInventory.filter((item) => item.source === source).map((item) => item.title);
    assert(sourceTitles.length === expectedCount, `${source} source report top-level SVG count drifted`);
    assert(JSON.stringify(sourceTitles) === JSON.stringify(registeredTitles), `${source} source visual inventory is incomplete or out of order`);
    const rawSvgs = [...sourceHtml.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map((match) => match[0]);
    const sourceAuditRows = sourceVisualAudit.filter((visual) => visual.source === source);
    assert(rawSvgs.length === sourceAuditRows.length, `${source} source SVG baseline count drifted`);
    rawSvgs.forEach((svg, index) => {
      assert(sha256(svg) === sourceAuditRows[index].originalSvgSha256, `${source} source SVG hash drifted at ${index + 1}`);
      assert(sourceAuditRows[index].order === index + 1, `${source} source SVG order drifted at ${index + 1}`);
    });
  }
  const inventoryByTitle = new Map(sourceVisualInventory.map((item) => [item.title, item]));
  for (const visual of visualManifest) {
    for (const title of visual.sourceReferences) {
      const sourceItem = inventoryByTitle.get(title);
      assert(sourceItem, `visual manifest references an unregistered source visual: ${title}`);
      assert(sourceItem.status !== "omitted", `visual manifest references an omitted source visual: ${title}`);
    }
  }
  const sourceToolFingerprint = [...zhikunHtml.matchAll(/<title>第\s*(\d+)\s*次：([^，]+)，([^<]+)<\/title>/g)]
    .map((match) => ({
      index: Number(match[1]),
      tool: match[2].trim(),
      status: match[3].includes("正常完成") ? "success" : "error",
    }));
  assert(sourceToolFingerprint.length === 60, "source report does not contain the sixty-call fingerprint");
  for (const [index, sourceCall] of sourceToolFingerprint.entries()) {
    const currentCall = data.toolFingerprint[index];
    assert(sourceCall.index === currentCall.index, `source fingerprint index mismatch at ${index + 1}`);
    assert(sourceCall.tool === currentCall.tool, `source fingerprint tool mismatch at ${index + 1}`);
    assert(sourceCall.status === currentCall.status, `source fingerprint status mismatch at ${index + 1}`);
  }
  for (const question of data.clarificationQuestions) {
    assert(comparisonHtml.includes(question.question), `source comparison report is missing question: ${question.question}`);
    for (const option of question.options) {
      assert(comparisonHtml.includes(option.label), `source comparison report is missing option: ${option.label}`);
      assert(comparisonHtml.includes(option.description), `source comparison report is missing option description: ${option.description}`);
    }
  }

  const auditDataMatch = comparisonHtml.match(/<script id="audit-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert(auditDataMatch, "comparison source report audit-data is missing");
  const sourceAudit = JSON.parse(auditDataMatch[1]);
  for (const score of data.scores) {
    const sourceSystem = sourceAudit.systems.find((system) => system.id === score.systemId);
    assert(sourceSystem?.score === score.declaredScore, `${score.systemId} source score drift`);
    assert(sourceSystem?.min === score.declaredMin && sourceSystem?.max === score.declaredMax, `${score.systemId} source interval drift`);
    for (const dimension of score.dimensions) {
      const sourceDimension = sourceAudit.scores[score.systemId][dimension.id];
      assert(sourceDimension.value === dimension.value, `${score.systemId}/${dimension.id} source value drift`);
      assert(sourceDimension.min === dimension.min && sourceDimension.max === dimension.max, `${score.systemId}/${dimension.id} source range drift`);
    }
  }
  for (const finding of data.findings) {
    const sourceFinding = sourceAudit.findings.find((item) => item.id === finding.id);
    assert(sourceFinding, `source finding ${finding.id} is missing`);
    const expectedBody = finding.id === "F16"
      ? "审计参考提交 aa1b3173… 的源码能解释日志中的类、方法与结构化事件，但日志没有记录运行构建 Git SHA，不能证明运行二进制与该参考提交逐字节一致。"
      : sourceFinding.body;
    assert(sourceFinding.title === finding.title && expectedBody === finding.body && sourceFinding.severity === finding.severity, `source finding ${finding.id} drift`);
  }
  const sourceE32 = sourceAudit.evidence.find((item) => item.id === "E32");
  assert(sourceE32?.detail.includes("央行/回购口径4项、金价品种3项、银行范围3项、交付形式4项"), "source E32 clarification summary drift");
  console.log("Verified private source reports against registered hashes and structured audit facts");
};

const refreshPublicScreenshotArtifacts = () => {
  const unsafeZhikunProcessSha256 = "aca3afd2d323b953cbca84a596fa7032312194a6c9d051a6cb4bcfe090b91c52";
  for (const artifact of data.artifacts.filter((item) => item.type === "derived-screenshot" && item.publicPath)) {
    const absolutePath = path.join(caseDir, artifact.publicPath);
    assert(fs.existsSync(absolutePath), `public screenshot is missing: ${artifact.publicPath}`);
    const bytes = fs.readFileSync(absolutePath);
    artifact.sha256 = sha256(bytes);
    artifact.bytes = bytes.length;
  }
  const zhikunProcess = data.artifacts.find((artifact) => artifact.label === "ZhikunCode 开发过程截图");
  assert(zhikunProcess.sha256 !== unsafeZhikunProcessSha256, "unredacted ZhikunCode process screenshot must not be published");
  zhikunProcess.note = "从冻结比较报告内嵌图像解码后，对一处本机绝对路径做确定性遮蔽；哈希对应公开派生 JPEG，不等同于源图哈希。";
  fs.writeFileSync(evidencePath, `${JSON.stringify(data, null, 2)}\n`);
};

buildPublicLogExcerpt();
refreshPublicScreenshotArtifacts();
validateData();
verifyPrivateSourceReports();

const inlineImage = (relativePath) => {
  const absolutePath = path.join(caseDir, relativePath);
  const extension = path.extname(absolutePath).slice(1).toLowerCase();
  const mime = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : `image/${extension}`;
  return `data:${mime};base64,${fs.readFileSync(absolutePath).toString("base64")}`;
};

const imageData = {
  codexProcess: inlineImage("assets/gold-audit/codex-process.jpg"),
  codexProduct: inlineImage("assets/gold-audit/codex-product.jpg"),
  zhikunProcess: inlineImage("assets/gold-audit/zhikuncode-process.jpg"),
  zhikunProduct: inlineImage("assets/gold-audit/zhikuncode-product.jpg"),
  zhikunClarification: inlineImage("assets/gold-audit/zhikuncode-clarification.jpg"),
  codexClarification: inlineImage("assets/gold-audit/codex-clarification.jpg"),
};

const scoreRows = data.dimensions.map((dimension) => {
  const zhikun = zhikunScore.dimensions.find((item) => item.id === dimension.id);
  const codex = codexScore.dimensions.find((item) => item.id === dimension.id);
  const delta = zhikun.value - codex.value;
  const deltaText = delta === 0 ? "相同" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
  return `
    <tr>
      <th scope="row">${escapeHtml(dimension.label)}<small>权重 ${dimension.weight}%</small></th>
      <td>
        <div class="score-cell"><b>${zhikun.value.toFixed(1)}</b><span class="meter"><i style="width:${zhikun.value * 10}%"></i></span></div>
        <p>${escapeHtml(publicNarrativeText(zhikun.reason))}</p>
        <div>${evidenceLinks(zhikun.evidence)}</div>
      </td>
      <td>
        <div class="score-cell codex"><b>${codex.value.toFixed(1)}</b><span class="meter"><i style="width:${codex.value * 10}%"></i></span></div>
        <p>${escapeHtml(publicNarrativeText(codex.reason))}</p>
        <div>${evidenceLinks(codex.evidence)}</div>
      </td>
      <td class="delta ${delta > 0 ? "zhikun" : delta < 0 ? "codex" : ""}">${deltaText}</td>
    </tr>`;
}).join("");

const findingRows = data.findings.map((finding) => `
  <tr>
    <td><span class="system-tag ${finding.system}">${finding.system === "zhikun" ? "ZhikunCode" : "Codex"}</span></td>
    <td><strong>${escapeHtml(finding.title)}</strong><p>${escapeHtml(finding.body)}</p></td>
    <td>${evidenceLinks(finding.evidence)}</td>
  </tr>`).join("");

const eventRows = data.events.map((event) => `
  <tr>
    <td><span class="event-order">${String(event.order).padStart(2, "0")}</span></td>
    <td><time>${escapeHtml(event.time)}</time></td>
    <td>${escapeHtml(event.lane)}</td>
    <td><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.result)}</p></td>
    <td>${evidenceLinks(event.evidence)}</td>
  </tr>`).join("");

const clarificationRows = data.clarificationQuestions.map((question, index) => `
  <li class="question-card">
    <header><span class="event-order">${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(question.question)}</strong><span class="status ${question.multiSelect ? "grade" : "verified"}">${question.multiSelect ? "多选" : "单选"}</span></header>
    <ul>${question.options.map((option) => `<li><b>${escapeHtml(option.label)}</b><span>${escapeHtml(option.description)}</span></li>`).join("")}</ul>
  </li>`).join("");

const agentRows = data.executionDetails.agents.map((agent) => `
  <tr>
    <th>${escapeHtml(agent.role)}<small>${escapeHtml(agent.type)}</small></th>
    <td><time>${escapeHtml(agent.time)}</time><small>${agent.turns} turns</small></td>
    <td><span class="status ${agent.status === "SUCCESS" ? "verified" : "failed"}">${escapeHtml(agent.status)}</span></td>
    <td>${escapeHtml(agent.output)}${agent.outputSha ? `<small>SHA ${escapeHtml(agent.outputSha)}</small>` : ""}</td>
    <td>${escapeHtml(agent.handoff)}</td>
  </tr>`).join("");

const phaseById = Object.fromEntries(data.executionPhases.map((phase) => [phase.id, phase]));
const phaseColorById = {
  clarify: "#43d8eb",
  research: "#a77bff",
  converge: "#f6b94b",
  implement: "#5a95ff",
  verify: "#2dd4a8",
};
const phaseRows = data.executionPhases.map((phase) => `
  <tr>
    <th><span class="event-order">${String(phase.order).padStart(2, "0")}</span> ${escapeHtml(phase.label)}</th>
    <td><time>${escapeHtml(phase.time)}</time></td>
    <td>${escapeHtml(phase.summary)}</td>
    <td>${phase.facts.map((fact) => `<span class="status grade">${escapeHtml(fact)}</span>`).join(" ")}</td>
    <td>${evidenceLinks(phase.evidence)}</td>
  </tr>`).join("");

const toolFingerprintRows = data.toolFingerprint.map((call) => `
  <tr>
    <td><span class="event-order">${String(call.index).padStart(2, "0")}</span></td>
    <td>${escapeHtml(phaseById[call.phase].label)}</td>
    <td><code>${escapeHtml(call.tool)}</code></td>
    <td><span class="status ${call.status === "error" ? "failed" : "verified"}">${call.status === "error" ? escapeHtml(call.detail) : "正常完成"}</span></td>
  </tr>`).join("");

const secondBatchRows = data.secondBatchClarifications.map((question) => `
  <article class="question-card boundary-card">
    <header><span class="event-order">${String(question.order).padStart(2, "0")}</span><strong>${escapeHtml(question.question)}</strong><span class="status ${question.optionsStatus === "partial" ? "limited" : "failed"}">${question.optionsStatus === "partial" ? "选项部分留存" : "选项未留存"}</span></header>
    ${question.visibleOptions.length ? `<ul>${question.visibleOptions.map((option) => `<li><b>${escapeHtml(option)}</b><span>仅证明截图中可辨认文字，不代表完整选项集或最终选择。</span></li>`).join("")}</ul>` : ""}
    <p><b>日志定位：</b>L${question.questionLine} 问题发送 · L${question.answerLine} 回答${question.completionLine ? ` · L${question.completionLine} 工具完成` : ""}</p>
    <p><b>证据边界：</b>${escapeHtml(question.boundary)} ${evidenceLinks(question.evidence)}</p>
  </article>`).join("");

const lineageRows = [
  ...data.researchLineage.researchAssets.map((asset) => `
    <tr><td>研究资产</td><td>${escapeHtml(asset.role)}</td><td><code>${escapeHtml(asset.file)}</code></td><td><code>${escapeHtml(asset.hashPrefix)}</code></td><td>${escapeHtml(asset.editorLabel)}</td></tr>`),
  ...data.researchLineage.applicationFiles.map((asset) => `
    <tr><td>应用文件</td><td>主协调器综合后的实现链</td><td><code>${escapeHtml(asset.file)}</code></td><td><code>${escapeHtml(asset.hashPrefix)}</code></td><td>实现 Agent 产出后由主协调器接管</td></tr>`),
].join("");

const pressureLevels = { "配置级": 25, "单层实现": 50, "跨层实现": 75, "数据生命周期重构": 100 };
const surfaceOwnershipRows = data.surfaceOwnership.map((row) => `
  <tr>
    <th>${escapeHtml(row.module)}</th>
    <td>${escapeHtml(row.zhikun)}</td>
    <td>${escapeHtml(row.codex)}</td>
    <td><div class="pressure-label"><span>${escapeHtml(row.pressure)}</span></div><div class="pressure-scale" aria-label="${escapeHtml(row.pressure)}"><i style="width:${pressureLevels[row.pressure]}%"></i></div><p>${escapeHtml(row.meaning)}</p>${evidenceLinks(row.evidence)}</td>
  </tr>`).join("");

const dataStatusLabels = {
  "dynamic-public": "动态公开来源",
  "derived-estimate": "派生估算",
  "static-snapshot": "静态快照",
  "verification-only": "仅核验入口",
  missing: "缺失",
  "different-instrument": "替代品种",
};
const dataSourceCell = (system) => `
  <span class="data-status status-${escapeHtml(system.status)}">${escapeHtml(dataStatusLabels[system.status])}</span>
  <dl class="matrix-details">
    <div><dt>来源</dt><dd>${escapeHtml(system.source)}</dd></div>
    <div><dt>方式</dt><dd>${escapeHtml(system.method)}</dd></div>
    <div><dt>标签</dt><dd>${escapeHtml(system.label)}</dd></div>
    <div><dt>更新</dt><dd>${escapeHtml(system.update)}</dd></div>
    <div><dt>核验</dt><dd>${escapeHtml(system.verification)}</dd></div>
    <div><dt>限制</dt><dd>${escapeHtml(system.limit)}</dd></div>
  </dl>`;
const dataSourceRows = data.dataSourceMatrix.map((row) => `
  <tr>
    <th>${escapeHtml(row.domain)}<small>${evidenceLinks(row.evidence)}</small></th>
    <td>${dataSourceCell(row.zhikun)}</td>
    <td>${dataSourceCell(row.codex)}</td>
  </tr>`).join("");

const evidenceCards = data.evidence.map((evidence) => {
  const publicLocation = evidence.publicPath
    ? /^https?:/.test(evidence.publicPath)
      ? `<a href="${escapeHtml(evidence.publicPath)}" target="_blank" rel="noopener noreferrer">打开公开来源 ↗</a>`
      : `<a href="${escapeHtml(evidence.publicPath)}">打开仓库证据</a>`
    : `<span class="private-source">原件未公开</span>`;
  const verificationLabel =
    evidence.verification === "verified" ? "作者已验证" :
      evidence.verification === "partial" ? "作者部分验证" : "作者无法验证";
  const publicVerificationLabel =
    evidence.publicVerification === "public" ? "公开材料可访问" :
      evidence.publicVerification === "partial" ? "第三方公开复核受限" : "原件与摘录均不公开";
  const publicVerificationClass =
    evidence.publicVerification === "public" ? "verified" :
      evidence.publicVerification === "partial" ? "limited" : "failed";
  const lineLocation = evidence.lineSegments.length
    ? evidence.lineSegments.map((segment) => segment.start === segment.end ? `L${segment.start}` : `L${segment.start}–L${segment.end}`).join(" · ")
    : null;
  const publicExcerptLineLocation = evidence.publicExcerptLineSegments?.length
    ? evidence.publicExcerptLineSegments.map((segment) => segment.start === segment.end ? `L${segment.start}` : `L${segment.start}–L${segment.end}`).join(" · ")
    : null;
  return `
    <article class="evidence-card" id="evidence-${escapeHtml(evidence.id)}">
      <header>
        <div><span class="evidence-id">${escapeHtml(evidence.id)}</span><span class="legacy-id">${escapeHtml(evidence.legacyId)}</span></div>
        <div class="evidence-badges"><span class="status grade">等级 ${escapeHtml(evidence.evidenceGrade)}</span><span class="status ${evidence.verification === "verified" ? "verified" : evidence.verification === "partial" ? "limited" : "failed"}">${verificationLabel}</span><span class="status ${publicVerificationClass}">${publicVerificationLabel}</span></div>
      </header>
      <h3>${escapeHtml(evidence.claim)}</h3>
      <p>${escapeHtml(publicNarrativeText(evidence.excerpt))}</p>
      <dl>
        <div><dt>来源组合</dt><dd>${escapeHtml(evidence.sourceTypes.join(" + "))}</dd></div>
        <div><dt>来源子型</dt><dd>${escapeHtml(evidence.sourceSubtype)}</dd></div>
        <div><dt>核验时间</dt><dd>${escapeHtml(evidence.timestamp)}</dd></div>
        <div><dt>公开位置</dt><dd>${publicLocation}</dd></div>
        ${evidence.publicVerificationNote ? `<div><dt>公开复核边界</dt><dd>${escapeHtml(evidence.publicVerificationNote)}</dd></div>` : ""}
        ${lineLocation ? `<div><dt>${evidence.sourceTypes.includes("log") ? "原始日志登记行段" : "精确行段"}</dt><dd>${lineLocation}</dd></div>` : ""}
        ${publicExcerptLineLocation ? `<div><dt>公开摘录实际行段</dt><dd><a href="${escapeHtml(evidence.publicLogPath)}">${publicExcerptLineLocation}</a></dd></div>` : ""}
        ${evidence.originalSha256 ? `<div><dt>原始 SHA-256</dt><dd><code>${escapeHtml(evidence.originalSha256)}</code></dd></div>` : ""}
      </dl>
      ${evidence.redactions.length ? `<p class="redaction">脱敏：${escapeHtml(evidence.redactions.join("、"))}</p>` : ""}
    </article>`;
}).join("");

const artifactRows = data.artifacts.map((artifact) => `
  <tr>
    <td>${escapeHtml(artifact.label)}</td>
    <td><code>${escapeHtml(artifact.sha256)}</code></td>
    <td>${artifact.publicPath ? `<a href="${escapeHtml(artifact.publicPath)}">公开文件</a>` : "原件未公开"}</td>
    <td>${escapeHtml(artifact.note)}</td>
  </tr>`).join("");

const limitations = data.limitations.map((limitation) => `<li>${escapeHtml(limitation)}</li>`).join("");
const embeddedScoreData = {
  scores: data.scores.map((score) => ({
    name: score.name,
    declaredScore: score.declaredScore,
    dimensions: score.dimensions.map(({ id, weight, value, min, max }) => ({
      id,
      weight,
      value,
      min,
      max,
    })),
  })),
};
const embeddedJson = JSON.stringify(embeddedScoreData).replaceAll("</script", "<\\/script");
const visuals = renderAuditVisuals(data);
const canonicalizeGeneratedHtml = (value) =>
  `${value.split("\n").map((line) => line.trimEnd()).join("\n").trimEnd()}\n`;

const html = canonicalizeGeneratedHtml(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <meta name="description" content="ZhikunCode 与 Codex 在同一黄金监控任务中的需求澄清、Agent 调度、权限控制与工程交付公开审计。">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="https://zhikunqingtao.github.io/zhikuncode/case-studies/zhikuncode-codex-gold-monitor-audit.html">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="zh_CN">
  <meta property="og:site_name" content="ZhikunCode">
  <meta property="og:title" content="同一黄金监控任务的双工具执行审计">
  <meta property="og:description" content="一份证据优先、可复算、有明确边界的 ZhikunCode 与 Codex 工程执行案例。">
  <meta property="og:url" content="https://zhikunqingtao.github.io/zhikuncode/case-studies/zhikuncode-codex-gold-monitor-audit.html">
  <title>同一黄金监控任务的双工具执行审计 · ZhikunCode × Codex</title>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"TechArticle","headline":"同一黄金监控任务的双工具执行审计","datePublished":"2026-07-25","dateModified":"${escapeHtml(data.auditDate)}","inLanguage":"zh-CN","author":{"@type":"Organization","name":"ZhikunCode"},"about":["AI coding agent","ZhikunCode","Codex","工程审计"]}
  </script>
  <style>
${auditReportCss}
${auditVisualCss}
  </style>
</head>
<body>
  <header class="hero">
    <div class="shell hero-grid">
      <div>
        <div class="eyebrow">Public Engineering Audit · Case 01</div>
        <h1>同一黄金监控任务的双工具执行审计</h1>
        <p class="lead">这份报告对照 ZhikunCode 与 Codex 完成同一黄金监控任务的全过程，包括需求澄清、Agent 调度、权限控制和最终交付。报告依据运行日志、代码、文件哈希和运行截图；无法核实的内容标为未验证。</p>
        <div class="meta"><span>报告 v${escapeHtml(data.reportVersion)}</span><span>案例日期 ${escapeHtml(data.caseDate)}</span><span>审计日期 ${escapeHtml(data.auditDate)}</span><span>38 条证据</span><span>14 个维度</span><span>中文 · 静态 · 离线可读</span></div>
      </div>
      <aside class="audit-plate" aria-label="审计摘要">
        <h2>审计范围</h2>
        <div class="plate-row"><span>证据账本<small>保留旧编号与公开状态</small></span><strong>38 条</strong></div>
        <div class="plate-row"><span>评分方法<small>原始分、权重、区间可复算</small></span><strong>14 维</strong></div>
        <div class="plate-row"><span>比较边界<small>工具、模型、人工、数据条件分开</small></span><strong>单任务</strong></div>
        <p class="plate-note">先读事实与限制，再读评分。68.3 / 68.4 仅在方法章节呈现，不作为首屏结论。</p>
      </aside>
    </div>
  </header>

  <nav class="nav report-nav" aria-label="报告章节"><div class="shell nav-inner">
    <a href="#summary">01 摘要</a><a href="#score-visuals">02 评分拆解</a><a href="#boundary">03 比较条件</a><a href="#timeline">04 执行过程</a><a href="#control-plane">05 系统机制</a><a href="#cross-evidence">06 日志×源码</a><a href="#delivery">07 交付对照</a><a href="#product-audit">08 产物分析</a><a href="#gallery">09 运行截图</a><a href="#issues">10 问题复盘</a><a href="#score">11 评分方法</a><a href="#evidence">12 证据账本</a><a href="#reproduce">13 复现与限制</a>
  </div></nav>

  <main class="shell">
    <section id="summary">
      <header class="section-head"><div class="kicker">01 / Audit summary</div><div><h2>审计摘要</h2><p>先看任务、运行条件和结论，再沿证据编号核对过程与产物。</p></div></header>
      <div class="summary-grid">
        <article class="panel prompt">
          <span class="status verified">原始输入 · ${evidenceLink("E001")}</span>
          <h3>用户要解决什么问题？</h3>
          <blockquote>“${escapeHtml(data.evidence.find((item) => item.id === "E001").excerpt)}”</blockquote>
          <h3>整理后的需求摘要</h3>
          <p>用户希望获得一个可每日查看的黄金监控工具，覆盖国际/国内金价、银行积存金价格，以及“国家对黄金回购”的频率和金额趋势；对含义或数据可得性不确定之处，系统应先向用户确认。此段是编辑整理，不替代上方逐字原文。</p>
        </article>
        <div class="summary-side">
          <article class="panel fact-box"><h3>ZhikunCode 运行配置</h3><p>Kimi K3 起步；HTTP 429 后由用户手动切换至 GLM-5.2，并在同一逻辑会话中继续。${evidenceLink("E023")} ${evidenceLink("E027")} ${evidenceLink("E037")}</p></article>
          <article class="panel fact-box"><h3>Codex 运行配置</h3><p>GPT-5.6 Sol，推理强度 High。该配置来自任务操作者补充，报告未独立验证服务端实际路由。${evidenceLink("E024")}</p></article>
          <article class="panel fact-box"><h3>审计结论</h3><p>两侧总分接近，但弱项不同。ZhikunCode 的两个实现 Agent 没有自行完成，银行与全球央行数据也不完整；Codex 的部分银行数据需要到 App 核验，央行数据是静态数组，质量检查也没有全部通过。</p></article>
        </div>
      </div>
      <div class="finding-grid">
        <article class="panel finding verified"><b>已验证 01 · 都交付了可查看的仪表盘</b><p>ZhikunCode 为本地 Flask 动态服务；Codex 为 React/服务端聚合的托管页面。${evidenceLink("E003")} ${evidenceLink("E005")} ${evidenceLink("E006")} ${evidenceLink("E036")}</p></article>
        <article class="panel finding verified"><b>已验证 02 · 分数相近，实现方式不同</b><p>ZhikunCode 用选择卡确认需求，并交付可在本机直接运行的服务；Codex 使用服务端并发抓取，页面的响应式处理更完整。两边都没有完整取得六家银行的真实报价，央行数据也各有缺口。</p></article>
        <article class="panel finding verified"><b>已验证 03 · 控制面行为可以追踪</b><p>长任务留下 Run、Agent、工具、验证与完成事件；但运行构建 SHA 缺失，源码只能解释行为。${evidenceLink("E027")} ${evidenceLink("E037")} ${evidenceLink("E038")}</p></article>
        <article class="panel finding limit"><b>本案例没有比较模型本身</b><p>工具、运行环境、人工操作和模型配置都不同，无法只看最终结果判断模型能力是否相等。</p></article>
        <article class="panel finding limit"><b>本案例不能代表产品排名</b><p>这里只观察一个任务，没有覆盖大型仓库、跨平台、长期维护和团队协作。</p></article>
        <article class="panel finding limit"><b>本案例不能拆分平台与模型贡献</b><p>报告没有单独测量模型强弱，因此不能判断调度系统是否弥补了模型差距。</p></article>
      </div>
    </section>

    <section id="score-visuals">
      <header class="section-head"><div class="kicker">02 / Score anatomy</div><div><h2>先拆开总分，再看过程</h2><p>68.3 和 68.4 很接近，但两侧得分的来源不同。下面三张评分图使用同一组 14 维数据。</p></div></header>
      ${visuals.evidencePyramid}
      ${visuals.configurationOverview}
      ${visuals.scoreOverview}
      ${visuals.scoreDimensions}
      ${visuals.scoreWeightedDelta}
    </section>

    <section id="boundary">
      <header class="section-head"><div class="kicker">03 / Boundary</div><div><h2>比较条件</h2><p>这不是模型基准测试。两次运行使用的工具、模型、人工操作和数据条件都不同。</p></div></header>
      <div class="boundary-grid">
        <article class="panel boundary"><span class="num">A</span><h3>工具能力</h3><p>交互组件、Agent 编排、文件与终端工具、权限网关、验证器和部署通道属于产品控制面。</p></article>
        <article class="panel boundary"><span class="num">B</span><h3>模型能力</h3><p>规划、推理和代码生成受模型影响；ZhikunCode 中途换模，因此无法形成单模型对照。</p></article>
        <article class="panel boundary"><span class="num">C</span><h3>人工介入</h3><p>用户回答澄清问题、切换模型、批准权限和输入“继续”，都可能改变路径与墙钟时间。</p></article>
        <article class="panel boundary"><span class="num">D</span><h3>数据条件</h3><p>银行真实积存金报价通常不公开；上游页面、认证和网络条件限制最终覆盖。</p></article>
      </div>
    </section>

    <section id="timeline">
      <header class="section-head"><div class="kicker">04 / Timeline</div><div><h2>任务执行过程</h2><p>时间线只收录能在原始日志中定位的事件。任务完成后的浏览器观察单独列出，日志没有记录的环节不补写。</p></div></header>
      <div class="notice" style="margin:0 0 18px"><strong>原始日志已完成身份核验</strong><p>本地原件为 17,254 行、2,730,008 字节，SHA-256 为 <code>dc055d95826f91c6ff9624172274d0a2846a4aca0665be871f26aba73e5a9067</code>，与冻结证据登记值完全一致。完整日志含会话标识、本机路径和工具输入，不直接公开；<a href="${publicLogExcerptRelativePath}">查看保留原始行号的脱敏关键事件摘录</a>。</p></div>
      ${visuals.executionPulse}
      ${visuals.traceMap}
      <div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>#</th><th>时间</th><th>泳道</th><th>动作与结果</th><th>证据</th></tr></thead><tbody>${eventRows}</tbody></table></div>
      ${visuals.requirementCompiler}
      ${visuals.executionSequence}
      <div class="subsection">
        <h3>第一批结构化澄清：问题与冻结选项复原</h3>
        <p>日志逐字确认四个问题文本及回答顺序；十四个完整选项来自哈希登记的冻结比较页。两类来源合并后才能恢复完整交互，日志本身不单独证明全部选项。${evidenceLink("E025")}</p>
        <ol class="question-list">${clarificationRows}</ol>
      </div>
      <div class="subsection">
        <h3>第二批两个澄清问题：问题可证，选项只部分留存</h3>
        <p>日志证明两个问题发生、发送顺序、回答完成和一次 pending interaction 重放；公开截图只显示第一个问题及部分选项。第二题的完整选项与用户最终选择没有留存，保持 unavailable，不补写。${evidenceLink("E026")} ${evidenceLink("E027")}</p>
        <div class="question-list">${secondBatchRows}</div>
        <div class="notice"><strong>交互连续性证据边界</strong><p>结构化卡片减少了手动整理和复制答案的步骤；L7076 证明期间重放过一个 pending interaction。公开截图只能证明弹窗形态和局部可见文字，不能独立复现刷新前后的全部交互。</p></div>
      </div>
      <div class="subsection">
        <div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>阶段</th><th>时间</th><th>主链含义</th><th>可直接观察事实</th><th>证据</th></tr></thead><tbody>${phaseRows}</tbody></table></div>
      </div>
      ${visuals.researchLineage}
      <div class="subsection">
        <h3>五个子 Agent：终态、产出与主链接管</h3>
        <p>达到轮次上限不代表没有中间产出。表格列出每个子任务的角色、轮次、时间和交接结果。${evidenceLink("E027")} ${evidenceLink("E037")}</p>
        ${visuals.agentDag}
        ${visuals.concurrencyModel}
        <div class="table-wrap"><table><thead><tr><th>角色/类型</th><th>时间/规模</th><th>终态</th><th>产出</th><th>主链关系</th></tr></thead><tbody>${agentRows}</tbody></table></div>
      </div>
      <div class="subsection">
        <div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>类型</th><th>角色/主链</th><th>文件</th><th>日志哈希前缀</th><th>边界</th></tr></thead><tbody>${lineageRows}</tbody></table></div>
      </div>
      <div class="subsection">
        <div class="legend-row">${data.executionPhases.map((phase) => `<span class="phase-legend" style="--legend:${phaseColorById[phase.id]}">${escapeHtml(phase.label)}</span>`).join("")}<span class="status failed">红框 = 工具错误返回</span></div>
        ${visuals.toolFingerprint}
        <div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>#</th><th>阶段</th><th>工具</th><th>结果</th></tr></thead><tbody>${toolFingerprintRows}</tbody></table></div>
      </div>
      ${visuals.completionGate}
    </section>

    <section id="control-plane">
      <header class="section-head"><div class="kicker">05 / Control plane</div><div><h2>ZhikunCode 如何执行任务</h2><p>下图把日志事件对应到 ZhikunCode 的任务执行组件。绿色表示日志直接命中，蓝色表示源码能够确认，琥珀色表示本次运行没有触发。</p></div></header>
      <div class="mechanism-legend"><span class="status verified">日志直接命中</span><span class="status grade">固定提交源码确认</span><span class="status limited">本次未触发/不足以证明</span></div>
      ${visuals.capabilityMapping}
      ${visuals.threeSystemPath}
      ${visuals.controlCutaway}
      ${visuals.capabilityCoverage}
      ${visuals.queryLoop}
      ${visuals.contextCascade}
      ${visuals.authorizationGateway}
      ${visuals.durableInteraction}
      ${visuals.resilienceState}
      ${visuals.recoveryMatrix}
    </section>

    <section id="cross-evidence">
      <header class="section-head"><div class="kicker">06 / Log × source</div><div><h2>日志事件与对应源码</h2><p>表中列出日志事件、能够解释这些行为的源码，以及证据仍然无法回答的问题。源码链接固定到审计参考提交。</p></div></header>
      <div class="table-wrap"><table><thead><tr><th>运行事实与日志行段</th><th>固定提交源码入口</th><th>可推出</th><th>不可推出</th></tr></thead><tbody>
        <tr><th>Session、MCP 恢复、模型 429 与人工续接<p>L14–L43 · L55–L201 · L17084–L17090</p>${evidenceLink("E027")} ${evidenceLink("E037")}</th><td class="code-link-list">${sourceLink("backend/src/main/java/com/aicodeassistant/engine/QueryEngine.java")} ${sourceLink("backend/src/main/java/com/aicodeassistant/interaction/DurableInteractionService.java")} ${sourceLink("backend/src/main/java/com/aicodeassistant/llm/ApiCircuitBreaker.java")} ${sourceLink("backend/src/main/java/com/aicodeassistant/mcp/McpClientManager.java")}</td><td>同一逻辑 Session 可由新 Run 继续；日志存在 MCP 恢复、断路器与模型切换相关事件。</td><td>不是自动模型故障转移；不能证明跨模型语义完全无损或所有恢复分支都可靠。</td></tr>
        <tr><th>子 Agent、轮内工具队列与动态超时<p>L251–L396</p>${evidenceLink("E027")} ${evidenceLink("E037")}</th><td class="code-link-list">${sourceLink("backend/src/main/java/com/aicodeassistant/tool/agent/SubAgentExecutor.java")} ${sourceLink("backend/src/main/java/com/aicodeassistant/tool/StreamingToolExecutor.java")}</td><td>可追踪子任务与工具执行终态，失败可回到主链继续。</td><td>日志中的时间窗重叠不能推出任务重复或性能收益，也不能证明达到轮次上限的 Agent 毫无中间产出。</td></tr>
        <tr><th>Session Grant、工具准入、授权与 Verify<p>L1248–L1256 · L14921–L15061</p>${evidenceLink("E027")} ${evidenceLink("E038")}</th><td class="code-link-list">${sourceLink("backend/src/main/java/com/aicodeassistant/tool/ToolExecutionPipeline.java")} ${sourceLink("backend/src/main/java/com/aicodeassistant/authorization/AuthorizationService.java")} ${sourceLink("backend/src/main/java/com/aicodeassistant/authorization/ToolExecutionGateway.java")}</td><td>存在 Grant 匹配、工具准入、受控执行与 VerifyJourney 的事件和实现路径。</td><td>权限判定数不是弹窗数；Verify 事件不自动等于完整测试通过。</td></tr>
        <tr><th>Bash 失败分类与 Plan 工具管线<p>L2159 · L2299 · L7191–L7261</p>${evidenceLink("E027")} ${evidenceLink("E038")}</th><td class="code-link-list">${sourceLink("backend/src/main/java/com/aicodeassistant/tool/bash/BashErrorClassifier.java")} ${sourceLink("backend/src/main/java/com/aicodeassistant/tool/ToolExecutionPipeline.java")}</td><td>错误分类和计划工具经过控制管线的行为有冻结日志定位。</td><td>不能由两处失败分类证明全部命令错误都能准确恢复。</td></tr>
        <tr><th>文件哈希与编辑者<p>L16645–L16646</p>${evidenceLink("E027")} ${evidenceLink("E038")}</th><td class="code-link-list">${sourceLink("backend/src/main/java/com/aicodeassistant/tool/impl/FileVersionTracker.java")}</td><td>文件活动可记录 hash 与 editor，固定源码解释其版本追踪机制。</td><td>公开证据没有逐文件版本账本，不能重建每次编辑的完整 diff 序列。</td></tr>
        <tr><th>安全审计、错误级联与上下文治理<p>L16724–L16795</p>${evidenceLink("E027")} ${evidenceLink("E038")}</th><td class="code-link-list">${sourceLink("backend/src/main/java/com/aicodeassistant/engine/ContextCascade.java")} ${sourceLink("backend/src/main/java/com/aicodeassistant/engine/QueryLoopState.java")}</td><td>上下文诊断与错误级联在长程执行末段留下可定位事件。</td><td>不能量化上下文治理对最终输出的净贡献。</td></tr>
        <tr><th>Brief、成功终止与消息持久化<p>L16965–L17025</p>${evidenceLink("E037")}</th><td class="code-link-list">${sourceLink("backend/src/main/java/com/aicodeassistant/engine/QueryEngine.java")} ${sourceLink("backend/src/main/java/com/aicodeassistant/engine/strategy/DefaultTerminationStrategy.java")} ${sourceLink("backend/src/main/java/com/aicodeassistant/interaction/DurableInteractionService.java")}</td><td>成功终止与消息完成独立于中间 Verify 检查点，并形成最终闭环。</td><td>不能据此宣称生产级验收、长期 SLA 或所有消息恢复场景通过。</td></tr>
      </tbody></table></div>
    </section>

    <section id="delivery">
      <header class="section-head"><div class="kicker">07 / Deliverables</div><div><h2>交付物逐项对照</h2><p>这里比较需求是否落实，以及代码实际怎样实现。页面上出现一个模块，不代表它已经取得真实数据。</p></div></header>
      <div class="table-wrap"><table class="comparison"><thead><tr><th>需求/工程项</th><th>ZhikunCode</th><th>Codex</th><th>审计判断</th></tr></thead><tbody>
        <tr><th>国际金价</th><td>XAU/USD 动态抓取，运行观察值 4092.04。${evidenceLink("E006")}</td><td>COMEX 报价与历史数据进入服务端聚合。${evidenceLink("E003")} ${evidenceLink("E036")}</td><td><span class="status verified">均有实现</span><p>品种口径不同，不能只比较页面数字。</p></td></tr>
        <tr><th>国内金价</th><td>页面标作沪金，实际两路函数指向同一 <code>nf_AU0</code>，不是 SGE 现货。${evidenceLink("E036")}</td><td>SGE Au99.99 / Au(T+D)，有官方来源复核。${evidenceLink("E009")} ${evidenceLink("E036")}</td><td><span class="status limited">Codex 口径更贴近需求</span></td></tr>
        <tr><th>六家指定银行</th><td>覆盖 5/6 指定银行，缺平安；全部为沪金基准叠加固定点差的估算。${evidenceLink("E019")} ${evidenceLink("E028")}</td><td>列出 6 家；仅工行、建行有公开报价，其余 4 家引导 App 核验。${evidenceLink("E020")}</td><td><span class="status limited">均未完整取得真实六行报价</span></td></tr>
        <tr><th>央行趋势</th><td>SAFE 中国官方储备历史，未实现各国央行。${evidenceLink("E010")} ${evidenceLink("E028")}</td><td>全球央行视图，但客户端硬编码；4 月值与 WGC 修订值不符且刷新不更新。${evidenceLink("E011")} ${evidenceLink("E030")}</td><td><span class="status failed">两侧都有主要缺口</span></td></tr>
        <tr><th>刷新与状态</th><td>首次请求四类数据；30 秒刷新行情和银行；月度缓存/预热。${evidenceLink("E034")} ${evidenceLink("E036")}</td><td>客户端 60 秒轮询；服务端 5 个 allSettled 分支与 HTTP 缓存。${evidenceLink("E034")} ${evidenceLink("E036")}</td><td><span class="status verified">机制均可追踪</span></td></tr>
        <tr><th>失败降级</th><td>单抓取函数失败返回空值/空结果，页面有显式降级文案；请求顺序执行且存在宽泛异常。${evidenceLink("E007")} ${evidenceLink("E034")}</td><td>单上游失败隔离并返回 <code>errors[]</code>，但页面不读取该数组。${evidenceLink("E036")}</td><td><span class="status limited">两侧都有部分失败反馈断层</span></td></tr>
        <tr><th>可访问性</th><td>1 组媒体查询，未发现 ARIA；未执行统一设备矩阵。${evidenceLink("E035")}</td><td>3 组媒体查询、6 处 ARIA、reduced-motion；线上链接需要登录。${evidenceLink("E018")} ${evidenceLink("E035")}</td><td><span class="status limited">Codex 前端基础更完整</span></td></tr>
        <tr><th>质量门禁</th><td>Python AST 通过；没有自动化测试，依赖未锁定。${evidenceLink("E016")} ${evidenceLink("E022")}</td><td>构建成功；2/2 测试失败，lint 与仓库 typecheck 不绿。${evidenceLink("E012")} ${evidenceLink("E013")} ${evidenceLink("E014")} ${evidenceLink("E015")}</td><td><span class="status failed">双方都不是绿色质量基线</span></td></tr>
      </tbody></table></div>
    </section>

    <section id="product-audit">
      <header class="section-head"><div class="kicker">08 / Product audit</div><div><h2>页面背后的代码和数据</h2><p>这一节把页面模块对应到代码与数据来源。修改压力只表示改动会跨过哪些层，不估算工时。</p></div></header>
      ${visuals.dataLineage}
      ${visuals.zhikunArchitecture}
      ${visuals.zhikunLifecycle}
      ${visuals.zhikunScreen}
      ${visuals.codexArchitecture}
      ${visuals.codexLifecycle}
      ${visuals.codexScreen}
      ${visuals.dualRuntime}
      <div class="subsection" style="margin-top:0">
        <h3>修改一个页面模块会涉及哪些代码</h3>
        <div class="table-wrap"><table><thead><tr><th>页面模块</th><th>ZhikunCode 对应代码</th><th>Codex 对应代码</th><th>改动范围</th></tr></thead><tbody>${surfaceOwnershipRows}</tbody></table></div>
        <div class="notice"><strong>改动范围分四级</strong><p><b>配置级：</b>主要改变配置；<b>单层实现：</b>改动集中在一个实现层；<b>跨层实现：</b>需要同步抓取、接口和展示；<b>数据生命周期重构：</b>需要改变数据从产生、缓存到页面刷新的整条路径。这只是代码影响范围，不是工时估算。</p></div>
      </div>
      <div class="subsection">
        <h3>页面数据来自哪里</h3>
        <p>公开页面上的动态价格不一定是最终成交价。估算值、静态快照、App 核验入口和缺失项在表中分别标记。</p>
        <div class="legend-row">
          ${Object.entries(dataStatusLabels).map(([status,label]) => `<span class="data-status status-${escapeHtml(status)}">${escapeHtml(label)}</span>`).join("")}
        </div>
        <div class="table-wrap"><table class="data-matrix"><thead><tr><th>数据域</th><th>ZhikunCode</th><th>Codex</th></tr></thead><tbody>${dataSourceRows}</tbody></table></div>
        <div class="notice"><strong>名字相同，不代表价格口径相同</strong><p>ZhikunCode 的国际黄金为 XAU/USD，Codex 为 COMEX 期货；ZhikunCode 国内行情是沪金主力替代品种，Codex 使用 SGE Au99.99 与 Au(T+D)。因此页面上的两个“当前价”不能直接互相验证。全球央行 4 月 <code>+17</code> 吨来自客户端静态快照，与权威来源后来修订的 <code>+19</code> 吨不一致，刷新页面也不会修正。</p></div>
      </div>
    </section>

    <section id="gallery">
      <header class="section-head"><div class="kicker">09 / Primary evidence</div><div><h2>开发过程与最终页面</h2><p>截图来自冻结比较报告，只对一处本机路径做了遮蔽。长图可以直接纵向滚动查看。</p></div></header>
      <div class="gallery">
        <figure class="shot"><div class="shot-frame"><img src="${imageData.zhikunProcess}" alt="ZhikunCode 开发过程长截图，本机路径已遮蔽" loading="lazy"></div><figcaption><strong>ZhikunCode · 开发过程</strong><span>公开派生图仅遮蔽一处本机绝对路径；其余流程像素保持不变，不从截图推断墙钟时间 · ${evidenceLink("E004")}</span></figcaption></figure>
        <figure class="shot"><div class="shot-frame"><img src="${imageData.codexProcess}" alt="Codex 开发过程长截图" loading="lazy"></div><figcaption><strong>Codex · 开发过程</strong><span>包含澄清、实现与交付记录 · ${evidenceLink("E002")}</span></figcaption></figure>
        <figure class="shot"><div class="shot-frame short"><img src="${imageData.zhikunProduct}" alt="ZhikunCode 黄金监控仪表盘最终截图" loading="lazy"></div><figcaption><strong>ZhikunCode · 最终产物</strong><span>本地动态 Flask 仪表盘 · ${evidenceLink("E005")} ${evidenceLink("E006")}</span></figcaption></figure>
        <figure class="shot"><div class="shot-frame"><img src="${imageData.codexProduct}" alt="Codex 黄金监控仪表盘最终截图" loading="lazy"></div><figcaption><strong>Codex · 最终产物</strong><span>React 仪表盘与来源披露 · ${evidenceLink("E003")}</span></figcaption></figure>
        <figure class="shot"><div class="shot-frame short"><img src="${imageData.zhikunClarification}" alt="ZhikunCode AI 需要更多信息结构化选择窗口" loading="lazy"></div><figcaption><strong>ZhikunCode · 结构化澄清</strong><span>可点击选项、说明、确认/取消 · ${evidenceLink("E026")}</span></figcaption></figure>
        <figure class="shot"><div class="shot-frame short"><img src="${imageData.codexClarification}" alt="Codex 以普通文本提问并由用户整理答案的界面" loading="lazy"></div><figcaption><strong>Codex · 文本澄清</strong><span>用户在输入框手动整理三项回复 · ${evidenceLink("E029")}</span></figcaption></figure>
      <p class="shot-note">公开 JPEG 是从冻结报告的内嵌图像解码得到；ZhikunCode 开发过程图另对一处本机绝对路径做了确定性遮蔽。公开文件哈希记录在“复现与限制”章节，它们不冒充源图的字节级副本。</p>
      </div>
    </section>

    <section id="issues">
      <header class="section-head"><div class="kicker">10 / Retrospective</div><div><h2>问题复盘</h2><p>这里同时记录执行过程和最终产物的问题。任务结束后的修复不改变本次评分。</p></div></header>
      <div class="table-wrap"><table class="issues"><thead><tr><th>范围</th><th>问题、现象与具体影响</th><th>证据</th></tr></thead><tbody>
        <tr><td><span class="system-tag zhikun">控制面</span></td><td><strong>实现与修复 Agent 达到轮次上限</strong><p>三个不同研究方向在时间窗内重叠执行并成功；后续 2 个实现/修复 Agent 达到 <code>SUBAGENT_MAX_TURNS</code>。日志能证明终态与主链接管，不能据此推断重复任务或调度器内部选择原因。</p><p>两次子任务未自行完成，主协调器继续 Bash、Read、Edit、测试和修复。</p></td><td>${evidenceLink("E027")} ${evidenceLink("E037")}</td></tr>
        <tr><td><span class="system-tag zhikun">交互</span></td><td><strong>确认一个问题后，下一问没有立即弹出</strong><p>选择卡减少了用户手动整理答案的步骤，但操作者记录显示，首次确认后后续问题没有自动出现，刷新页面后才恢复。公开截图只能证明弹窗样式，不能单独还原完整的刷新过程。</p></td><td>${evidenceLink("E025")} ${evidenceLink("E026")}</td></tr>
        ${findingRows}
      </tbody></table></div>
    </section>

    <section id="score">
      <header class="section-head"><div class="kicker">11 / Scoring method</div><div><h2>十四维评分方法</h2><p>评分只汇总本次案例。每个维度的理由、证据、权重和区间都可以复算。</p></div></header>
      <div class="score-summary">
        <article class="panel score-panel zhikun"><span class="system-tag zhikun">ZhikunCode</span><div class="score">${computed.zhikun.score}</div><small>计算区间 ${computed.zhikun.min}–${computed.zhikun.max} · 权重 ${computed.zhikun.weight}%</small></article>
        <article class="panel score-panel codex"><span class="system-tag codex">Codex</span><div class="score">${computed.codex.score}</div><small>计算区间 ${computed.codex.min}–${computed.codex.max} · 权重 ${computed.codex.weight}%</small></article>
        <div class="formula"><code>Σ(维度分 ÷ 10 × 权重)</code><span>中心分保留 1 位小数；上下界使用相同公式。0.1 分差异远小于评分区间，不解释为实质领先。</span></div>
      </div>
      <div class="table-wrap"><table class="score-table"><thead><tr><th>维度</th><th>ZhikunCode</th><th>Codex</th><th>差值 Z−C</th></tr></thead><tbody>${scoreRows}</tbody></table></div>
      <div class="runtime-check"><strong id="score-check">正在复算内嵌数据…</strong><span id="score-check-detail">若 JavaScript 被禁用，以上静态表格和结果仍完整可读。</span></div>
      <noscript><div class="notice"><strong>JavaScript 已禁用</strong><p>静态复算结果：ZhikunCode 68.3（62.6–73.7），Codex 68.4（63.2–73.6），权重均为 100%。</p></div></noscript>
    </section>

    <section id="evidence">
      <header class="section-head"><div class="kicker">12 / Evidence ledger</div><div><h2>证据账本</h2><p>38 条证据重新连续编号为 E001–E038，并保留旧编号。证据等级、作者核验和第三方公开复核是三个独立维度。</p></div></header>
      <div class="notice" style="margin:0 0 18px"><strong>等级定义</strong><p><b>A：</b>${escapeHtml(data.evidenceGradeDefinition.A)}<br><b>B：</b>${escapeHtml(data.evidenceGradeDefinition.B)}<br><b>C：</b>${escapeHtml(data.evidenceGradeDefinition.C)}</p></div>
      <div class="evidence-tools"><p>“作者已验证”表示报告作者掌握直接材料；“公开材料可访问”只表示第三方能打开所列材料。完整日志原件已核验但未公开，第三方可直接检查脱敏摘录中的原始行号和事件，仍不能据此推断未公开的全部日志内容。</p><a class="button" href="zhikuncode-codex-gold-monitor-evidence.json" download>下载结构化证据 JSON</a></div>
      <div class="evidence-grid">${evidenceCards}</div>
    </section>

    <section id="reproduce">
      <header class="section-head"><div class="kicker">13 / Reproducibility</div><div><h2>复现、哈希与已知限制</h2><p>哈希只能帮助确认文件连续性，不能独立证明内容真实、完整或来源可信。</p></div></header>
      <div class="table-wrap hashes"><table><thead><tr><th>产物</th><th>SHA-256</th><th>公开状态</th><th>说明</th></tr></thead><tbody>${artifactRows}</tbody></table></div>
      <p><a class="button" href="zhikuncode-codex-gold-monitor-SHA256SUMS.txt">查看公开 HTML、证据 JSON、脱敏日志摘录、截图与复核说明的完整 SHA-256 清单</a></p>
      <div class="runtime-check"><strong>从仓库根目录校验公开文件</strong><code>cd docs/case-studies &amp;&amp; shasum -a 256 -c zhikuncode-codex-gold-monitor-SHA256SUMS.txt</code></div>
      <div class="summary-grid" style="margin-top:18px">
        <article class="panel prompt"><h3>源码与运行版本</h3><p>控制面审计参考提交：<a href="https://github.com/zhikunqingtao/zhikuncode/tree/${escapeHtml(data.sourceCommits.zhikuncodeAuditReference)}"><code>${escapeHtml(data.sourceCommits.zhikuncodeAuditReference)}</code></a></p><p>${escapeHtml(data.sourceCommits.zhikuncodeAuditReferenceNote)}</p><p>${escapeHtml(data.sourceCommits.runBuildNote)}</p></article>
        <article class="panel prompt"><h3>第三方最低复核路径</h3><ol><li>阅读<a href="README.md">生成与复核说明</a>并下载证据 JSON，检查证据编号、评分权重和引用闭包。</li><li>打开<a href="${publicLogExcerptRelativePath}">脱敏关键日志摘录</a>，按原始行号核对 Run、Agent、权限、恢复、验证与终止事件。</li><li>用页面内公式复算 14 个维度。</li><li>核对公开截图哈希与页面内嵌图像。</li><li>按固定提交阅读控制面源码。</li><li>将无法访问的完整原件视为证据限制，而不是默认相信。</li></ol></article>
      </div>
      <div class="subsection">
        <div class="notice"><strong>源图公开边界</strong><p>44 张公开源图经过可追踪的脱敏和事实边界修正；完整修正记录保留在结构化证据 JSON 与生成器校验中。</p></div>
      </div>
      <h3 style="margin-top:30px">已知限制</h3>
      <ol class="limitations">${limitations}</ol>
      <div class="disclosure"><strong>利益关系披露</strong><p>${escapeHtml(data.disclosure)}</p><p><strong>评审者：</strong>开发者主导的内部技术审计，尚未经过独立第三方复核。<br><strong>用途：</strong>工程复盘、开源项目说明与方法展示；不构成投资建议，也不构成产品或模型排名。</p></div>
    </section>
  </main>

  <footer><div class="shell footer-grid"><p><strong>ZhikunCode × Codex · 黄金监控任务公开审计</strong><br>报告版本 ${escapeHtml(data.reportVersion)} · ${escapeHtml(data.auditDate)} · Asia/Shanghai</p><p>单文件正文离线可读 · 无 CDN / 无远程字体 / 无运行时数据请求<br><a href="../index.html">返回 ZhikunCode 首页</a> · <a href="zhikuncode-codex-gold-monitor-evidence.json">证据 JSON</a></p></div></footer>

  <script id="audit-data" type="application/json">${embeddedJson}</script>
  <script>
  (() => {
    "use strict";
    const dataNode = document.getElementById("audit-data");
    const statusNode = document.getElementById("score-check");
    const detailNode = document.getElementById("score-check-detail");
    try {
      const report = JSON.parse(dataNode.textContent);
      const round1 = value => Math.round((value + 1e-9) * 10) / 10;
      const calculate = (dimensions, key = "value") =>
        dimensions.reduce((total, dimension) => total + dimension.weight * dimension[key] / 10, 0);
      const results = report.scores.map(system => ({
        name: system.name,
        score: round1(calculate(system.dimensions)),
        min: round1(calculate(system.dimensions, "min")),
        max: round1(calculate(system.dimensions, "max")),
        weight: system.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0),
        declared: system.declaredScore,
      }));
      const valid = results.every(result => result.weight === 100 && result.score === result.declared);
      statusNode.textContent = valid ? "复算通过：两套权重均为 100%，计算结果与声明分一致。" : "复算失败：请检查权重或声明分。";
      detailNode.textContent = results.map(result => \`\${result.name} \${result.score}（\${result.min}–\${result.max}）\`).join("；");
      statusNode.style.color = valid ? "var(--green)" : "var(--red)";
    } catch (error) {
      statusNode.textContent = "内嵌数据解析失败；请以静态表格和外部证据 JSON 为准。";
      detailNode.textContent = error instanceof Error ? error.message : String(error);
      statusNode.style.color = "var(--red)";
    }

    const reportNav = document.querySelector(".report-nav");
    const navStrip = reportNav?.querySelector(".nav-inner");
    const navLinks = reportNav ? Array.from(reportNav.querySelectorAll('a[href^="#"]')) : [];
    const navSections = navLinks
      .map(link => document.getElementById(link.getAttribute("href").slice(1)))
      .filter(Boolean);
    let currentSectionId = "";
    let scrollFrame = 0;

    const setCurrentSection = id => {
      if (!id || id === currentSectionId) return;
      currentSectionId = id;
      let currentLink = null;
      navLinks.forEach(link => {
        const active = link.getAttribute("href") === "#" + id;
        if (active) {
          link.setAttribute("aria-current", "location");
          currentLink = link;
        } else {
          link.removeAttribute("aria-current");
        }
      });
      if (!currentLink || !navStrip) return;
      const stripRect = navStrip.getBoundingClientRect();
      const linkRect = currentLink.getBoundingClientRect();
      if (linkRect.left < stripRect.left || linkRect.right > stripRect.right) {
        currentLink.scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    };

    const syncNavigation = () => {
      scrollFrame = 0;
      if (!reportNav || !navSections.length) return;
      const marker = reportNav.getBoundingClientRect().bottom + 24;
      let activeSection = navSections[0];
      for (const section of navSections) {
        if (section.getBoundingClientRect().top <= marker) activeSection = section;
        else break;
      }
      setCurrentSection(activeSection.id);
    };

    const scheduleNavigationSync = () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(syncNavigation);
    };

    navLinks.forEach(link => {
      link.addEventListener("click", () => setCurrentSection(link.getAttribute("href").slice(1)));
    });
    addEventListener("scroll", scheduleNavigationSync, { passive: true });
    addEventListener("resize", scheduleNavigationSync, { passive: true });
    addEventListener("hashchange", () => {
      const target = document.getElementById(location.hash.slice(1));
      const section = target?.matches("main > section") ? target : target?.closest("main > section");
      if (section) setCurrentSection(section.id);
      scheduleNavigationSync();
    });
    syncNavigation();
  })();
  </script>
</body>
</html>`);

const validateGenerated = (documentHtml) => {
  const evidenceJson = fs.readFileSync(evidencePath, "utf8");
  const publicLogExcerpt = fs.readFileSync(publicLogExcerptPath, "utf8");
  const combined = `${documentHtml}\n${evidenceJson}\n${publicLogExcerpt}`;
  const publicVisibleMarkup = documentHtml
    .replaceAll(/src="data:image\/[^"]+"/g, 'src="<EMBEDDED_IMAGE>"')
    .replaceAll(/<style[\s\S]*?<\/style>/gi, "")
    .replaceAll(/<script[\s\S]*?<\/script>/gi, "");
  const forbidden = [
    "/Users/",
    "/var/folders/",
    "公开报告基线提交",
    "原始截图",
    "PERMISSION_UNDELIVERABLE",
    "Network/MCP Save",
    "log/app.log",
    "数据来源方面，你的预算和接受度是？",
    "你希望监控/更新的频率是？",
    "Agent 重复派发",
    "重复消耗上下文",
    "第二批完整选项已留存",
    "App 核验等同真实报价",
    "相对较弱",
  ];
  for (const text of forbidden) assert(!combined.includes(text), `forbidden public text found: ${text}`);
  assert(!/\b(?:Cookie|Authorization)\s*:/i.test(combined), "request header leaked");
  assert(!/\bBearer\s+[A-Za-z0-9._~-]{12,}/.test(combined), "bearer token leaked");
  assert(!/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(combined), "full session UUID leaked");
  const runtimeIdentifierScan = combined.replaceAll("aa1b3173…", "");
  assert(!/\b[0-9a-f]{8}…/i.test(runtimeIdentifierScan), "truncated runtime identifier leaked");
  assert(!/\bagent-[0-9a-f]{8}\b/i.test(combined), "sub-agent runtime identifier leaked");
  assert(!/\btransport=[^<,\s][^,\s]*/i.test(combined), "transport runtime identifier leaked");
  assert(!combined.includes("--legend:undefined"), "undefined phase legend color leaked");
  assert(!combined.includes("数据范围 · 交付形式 · 估算口径 · 不确定项处理"), "obsolete first-batch clarification ownership leaked");
  assert(!combined.includes("完整MCP服务和浏览器自动化属于源码或产品资料确认，但本次日志没有直接命中"), "incorrect MCP observation boundary leaked");
  assert(!combined.includes("300 实例 · 284 非空 Patch · results.json 记录 168 resolved"), "out-of-scope SWE-bench figures leaked");
  assert(!combined.includes("三个研究Agent并行探索"), "unsupported research-agent parallelism claim leaked");
  assert(!combined.includes("GLM-5.2是ZhikunCode核心执行模型"), "task-scoped model role was overstated");

  const ids = [...documentHtml.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert(new Set(ids).size === ids.length, "duplicate HTML id detected");
  const idSet = new Set(ids);
  const expectedSections = [
    "summary", "score-visuals", "boundary", "timeline", "control-plane", "cross-evidence",
    "delivery", "product-audit", "gallery", "issues", "score", "evidence", "reproduce",
  ];
  const renderedSections = [...documentHtml.matchAll(/<section id="([^"]+)"/g)].map((match) => match[1]);
  assert(JSON.stringify(renderedSections) === JSON.stringify(expectedSections), "report section order or pruning drifted");
  for (const match of documentHtml.matchAll(/href="#([^"]+)"/g)) {
    assert(idSet.has(match[1]), `dangling anchor #${match[1]}`);
  }
  for (const match of documentHtml.matchAll(/#evidence-(E\d{3})/g)) {
    assert(data.evidence.some((evidence) => evidence.id === match[1]), `dangling HTML evidence reference ${match[1]}`);
  }
  assert(!documentHtml.includes("publicationBase"), "legacy publicationBase field leaked");
  assert(!documentHtml.includes("单抓取函数异常返回错误对象"), "incorrect error-object statement leaked");
  assert(!documentHtml.includes("单个函数异常转成错误对象"), "incorrect error-object statement leaked");
  assert(!documentHtml.includes("事实与证据链修订"), "internal correction notice leaked");
  assert(!documentHtml.includes("工具数量分布摘要"), "redundant tool distribution card leaked");
  assert(!documentHtml.includes("墙钟时间只作过程量级对照"), "redundant wall-clock card leaked");
  assert(!documentHtml.includes("ZhikunCode 核心能力索引"), "redundant capability index leaked");
  assert(!documentHtml.includes("<section id=\"dataflow\">"), "redundant runtime-path section leaked");
  assert(!documentHtml.includes("未提供行号"), "empty line-number metadata leaked");
  assert(!documentHtml.includes("SWE-bench"), "out-of-scope benchmark name leaked into public HTML");
  assert(!documentHtml.includes("报告制作前仓库基线"), "repository baseline leaked into public HTML");
  assert(!("repositoryBaselineCommit" in data.sourceCommits), "repository baseline commit must not be published");
  assert(!("repositoryBaselineNote" in data.sourceCommits), "repository baseline note must not be published");
  assert(!documentHtml.includes("源 SVG 受控修正账本"), "internal visual correction ledger leaked into public HTML");
  assert(documentHtml.includes("44 张公开源图经过可追踪的脱敏和事实边界修正"), "public source-visual boundary summary missing");
  const usageLeak = publicVisibleMarkup.match(/.{0,80}\busage\b.{0,120}/i)?.[0];
  assert(!usageLeak, `non-comparable internal usage metric leaked into public HTML: ${usageLeak ?? ""}`);
  assert(!/<span class="status (?:failed|limited)">(?:主要|次要)<\/span>/.test(documentHtml), "undefined severity label leaked");
  assert(documentHtml.includes("第一批结构化澄清：问题与冻结选项复原"), "first-batch clarification title missing");
  assert(!documentHtml.includes("第一批结构化澄清原始记录"), "misleading first-batch clarification title leaked");
  assert(documentHtml.includes("截图来自冻结比较报告"), "derived screenshot disclosure missing");
  assert(documentHtml.includes("五个执行阶段"), "five-phase execution summary missing");
  assert(documentHtml.includes('class="source-panel-stack phase-story-layout"'), "five-phase source layout lost its companion story");
  assert((documentHtml.match(/class="phase-story-card"/g) || []).length === 5, "five-phase companion cards drifted");
  assert(
    /data-source-visual="zhikun-06"[\s\S]*?--source-native-width:300px/.test(documentHtml),
    "portrait execution pulse lost its native-width constraint",
  );
  assert(
    documentHtml.includes(".source-panel-stage>svg.desktop-diagram{display:block!important}"),
    "static source SVG visibility override is missing",
  );
  assert(
    documentHtml.includes('[data-source-visual="zhikun-06"] .run-stage-map .stage-node{opacity:1!important'),
    "static execution stages are not all legible",
  );
  assert(
    documentHtml.includes('[data-source-visual="zhikun-22"] .source-only-node{opacity:.92;stroke-dasharray:7 6}'),
    "capability map source-only evidence styling was lost during embedding",
  );
  assert(
    documentHtml.includes('[data-source-visual="zhikun-12"] .cut-docs{opacity:.34;stroke-dasharray:7 7}'),
    "control cutaway documentation-only boundary styling was lost during embedding",
  );
  assert(
    documentHtml.includes('[data-source-visual="zhikun-20"],[data-source-visual="zhikun-21"]\n  ) text[font-size="11"]{font-size:12px}'),
    "architecture atlas text-size correction was lost during embedding",
  );
  assert(
    documentHtml.includes('[data-source-family="comparison"] :is(.story-svg .state-partial,.product-screen-svg .ownership-partial)'),
    "comparison SVG status semantics were lost with the source page ancestor",
  );
  assert(
    documentHtml.includes('[data-source-family="comparison"] .control-proof-svg .cp-panel-amber'),
    "comparison control-proof limitation color was lost with the source page ancestor",
  );
  assert(documentHtml.includes("主任务的 60 次工具调用"), "ordered tool fingerprint missing");
  assert(documentHtml.includes("研究结果与最终文件"), "research lineage section missing");
  assert(documentHtml.includes("修改一个页面模块会涉及哪些代码"), "surface ownership section missing");
  assert(documentHtml.includes("页面数据来自哪里"), "data source matrix missing");
  assert(documentHtml.includes("第二批两个澄清问题：问题可证，选项只部分留存"), "second-batch evidence boundary missing");
  assert(documentHtml.includes(publicLogExcerptRelativePath), "public log excerpt link missing");
  assert(documentHtml.includes('class="nav report-nav"'), "report navigation marker missing");
  assert(documentHtml.includes('aria-current", "location"'), "report navigation active-state sync missing");
  assert(documentHtml.includes('.report-nav .nav-inner>a[aria-current="location"]'), "report navigation active style missing");
  const manifestIds = visualManifest.map((visual) => visual.id);
  const manifestTitles = visualManifest.map((visual) => visual.title);
  const takeaways = visualManifest.map((visual) => visual.takeaway);
  assert(new Set(manifestIds).size === manifestIds.length, "visual manifest ids must be unique");
  assert(new Set(manifestTitles).size === manifestTitles.length, "visual manifest titles must be unique");
  assert(new Set(takeaways).size === takeaways.length, "visual takeaways must be unique");
  for (const visual of visualManifest) {
    assert(visual.id && visual.section && visual.title && visual.takeaway, `visual manifest metadata incomplete: ${visual.key}`);
    assert(!/[？?]$/.test(visual.takeaway), `visual takeaway must be declarative: ${visual.key}`);
    assert(visual.sourceReferences.length > 0, `visual source references missing: ${visual.id}`);
    assert(visual.evidence.length > 0, `visual evidence references missing: ${visual.id}`);
    assert(documentHtml.includes(`id="figure-${visual.id}"`), `visual figure wrapper missing: ${visual.id}`);
    assert(documentHtml.includes(`<h3 id="${visual.id}-title">${visual.title}</h3>`), `visual title drifted from manifest: ${visual.id}`);
    assert(documentHtml.includes(`aria-labelledby="${visual.id}-title" aria-describedby="${visual.id}-desc"`), `visual ARIA linkage missing: ${visual.id}`);
    for (const evidenceId of visual.evidence) {
      assert(data.evidence.some((evidence) => evidence.id === evidenceId), `visual ${visual.id} references missing evidence ${evidenceId}`);
    }
  }
  const coreVisuals = [...documentHtml.matchAll(/data-core-visual="([^"]+)"/g)].map((match) => match[1]);
  assert(coreVisuals.length === visualManifest.length, `visual manifest/render count mismatch: ${visualManifest.length} vs ${coreVisuals.length}`);
  assert(new Set(coreVisuals).size === coreVisuals.length, "core SVG visual ids must be unique");
  assert(coreVisuals.every((id, index) => id === manifestIds[index]), "rendered core SVG order must match the visual manifest");
  const sourcePanels = [...documentHtml.matchAll(/<section class="source-visual-panel [^"]+"[^>]*data-source-visual="([^"]+)"[^>]*>/g)]
    .map((match) => match[1]);
  const expectedSourcePanels = data.sourceVisualAudit.filter((visual) => visual.status !== "omitted");
  assert(sourcePanels.length === 44, `expected forty-four source SVG panels, found ${sourcePanels.length}`);
  assert(new Set(sourcePanels).size === 44, "source SVG panels must be unique");
  const sourceKeyByTitle = new Map(expectedSourcePanels.map((visual) => [visual.title, visual.key]));
  const expectedRenderedSourceOrder = visualManifest.flatMap((visual) => visual.sourceReferences.map((title) => sourceKeyByTitle.get(title)));
  assert(JSON.stringify(sourcePanels) === JSON.stringify(expectedRenderedSourceOrder), "source SVG panel order must match thematic group registration");
  for (const visual of expectedSourcePanels) {
    assert(documentHtml.includes(`data-source-visual="${visual.key}"`), `source SVG panel missing: ${visual.key}`);
    assert(documentHtml.includes(`data-original-svg-sha256="${visual.originalSvgSha256}"`), `source SVG hash attribute missing: ${visual.key}`);
    assert(documentHtml.includes(`data-correction-ids="${visual.correctionIds.join(" ")}"`), `source SVG correction linkage drifted: ${visual.key}`);
  }
  for (const visual of data.sourceVisualAudit.filter((item) => item.status === "omitted")) {
    assert(!documentHtml.includes(`data-source-visual="${visual.key}"`), `omitted source SVG leaked: ${visual.key}`);
  }
  const svgIds = [...documentHtml.matchAll(/<svg[\s\S]*?<\/svg>/g)]
    .flatMap((match) => [...match[0].matchAll(/\sid="([^"]+)"/g)].map((idMatch) => idMatch[1]));
  assert(new Set(svgIds).size === svgIds.length, "SVG internal ids must be globally unique");
  for (const reference of documentHtml.matchAll(/url\(#([^)]+)\)/g)) {
    assert(svgIds.includes(reference[1]), `dangling SVG url reference #${reference[1]}`);
  }
  for (const figure of documentHtml.matchAll(/<figure class="audit-visual[^"]*"[\s\S]*?<\/figure>/g)) {
    assert(!figure[0].includes("<figcaption>"), "core visual repeats its heading in a figcaption");
  }
  const embeddedDataMatch = documentHtml.match(/<script id="audit-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert(embeddedDataMatch, "minimal embedded score data missing");
  const embeddedData = JSON.parse(embeddedDataMatch[1]);
  assert(JSON.stringify(Object.keys(embeddedData)) === JSON.stringify(["scores"]), "embedded audit data must contain score inputs only");
  assert(embeddedData.scores.length === 2, "embedded score data system count drifted");
  assert(!documentHtml.includes('class="timeline-svg"'), "legacy simplified timeline SVG leaked");
  assert(!documentHtml.includes('class="phase-svg"'), "legacy simplified phase SVG leaked");
  assert(!documentHtml.includes('class="lineage-svg"'), "legacy simplified lineage SVG leaked");
  assert(!documentHtml.includes('class="fingerprint-svg"'), "legacy simplified fingerprint SVG leaked");
  assert((documentHtml.match(/<style>/g) || []).length === 1, "generated report must contain one unified style block");
  for (const requiredVisual of manifestIds) {
    assert(coreVisuals.includes(requiredVisual), `required visual ${requiredVisual} missing`);
  }
  assert(publicLogExcerpt.includes("原始日志 SHA-256: dc055d95826f91c6ff9624172274d0a2846a4aca0665be871f26aba73e5a9067"), "public log provenance missing");
  for (const lineNumber of [63, 93, 101, 109, 115, 120, 149, 186, 187, 188, 189, 190, 7037, 7049, 7050, 7076, 7083, 7086, 16794, 16995, 16996, 17023]) {
    assert(publicLogExcerpt.includes(`L${lineNumber} `), `public log required line L${lineNumber} is missing`);
  }
};

validateGenerated(html);
fs.writeFileSync(outputPath, html);
const checksumFiles = [
  path.basename(outputPath),
  path.basename(evidencePath),
  publicLogExcerptRelativePath,
  "README.md",
  ...fs.readdirSync(path.join(caseDir, "assets", "gold-audit"))
    .sort()
    .map((file) => path.join("assets", "gold-audit", file)),
];
const checksumLines = checksumFiles.map((relativePath) => {
  const bytes = fs.readFileSync(path.join(caseDir, relativePath));
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  return `${digest}  ${relativePath}`;
});
fs.writeFileSync(
  path.join(caseDir, "zhikuncode-codex-gold-monitor-SHA256SUMS.txt"),
  `${checksumLines.join("\n")}\n`,
);
console.log(`Generated ${path.relative(repoRoot, outputPath)} (${Buffer.byteLength(html)} bytes)`);
