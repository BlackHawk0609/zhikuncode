#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { JSDOM } from "../frontend/node_modules/jsdom/lib/api.js";
import postcss from "../frontend/node_modules/postcss/lib/postcss.js";
import { sourceVisualInventory, visualManifest } from "./gold-audit-visuals.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(scriptDir, "gold-audit-source-visuals.mjs");
const evidencePath = path.join(scriptDir, "..", "docs", "case-studies", "zhikuncode-codex-gold-monitor-evidence.json");
const evidenceData = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};
const sourcePaths = {
  zhikun: option("--zhikun-report"),
  comparison: option("--comparison-report"),
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const compactGzip = (value) => zlib.gzipSync(Buffer.from(value), { level: 9, mtime: 0 }).toString("base64");
const escapeTemplate = (value) => value.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${");

for (const [source, sourcePath] of Object.entries(sourcePaths)) {
  assert(sourcePath, `missing --${source}-report`);
  assert(fs.existsSync(sourcePath), `${source} source report does not exist`);
  const artifactLabel = source === "zhikun" ? "ZhikunCode 单系统报告" : "双系统冻结比较报告";
  const registeredArtifact = evidenceData.artifacts.find((artifact) => artifact.label === artifactLabel);
  assert(registeredArtifact, `${artifactLabel} is missing from the evidence manifest`);
  assert(sha256(fs.readFileSync(sourcePath)) === registeredArtifact.sha256, `${artifactLabel} SHA-256 does not match the registered source`);
}

const legacyEvidenceMap = {
  E01: "E001", E02: "E002", E03: "E003", E04: "E004", E05: "E005",
  E08: "E006", E09: "E007", E11: "E008", E12: "E009", E13: "E010",
  E14: "E011", E15: "E012", E16: "E013", E17: "E014", E18: "E015",
  E19: "E016", E20: "E017", E21: "E018", E24: "E019", E26: "E020",
  E27: "E021", E28: "E022", E29: "E023", E31: "E024", E32: "E025",
  E33: "E026", E34: "E027", E35: "E028", E44: "E029", E45: "E030",
  E46: "E031", E48: "E032", E49: "E033", E50: "E034", E51: "E035",
  E53: "E036", E54: "E037", E55: "E038",
};

const correctionDefinitions = [
  {
    id: "VC001",
    type: "redaction",
    before: "完整 Session UUID",
    after: "<SESSION>",
    reason: "公开报告不披露完整会话标识；不改变事件顺序或会话连续性。",
    evidence: ["E027", "E037"],
  },
  {
    id: "VC002",
    type: "evidence-map",
    before: "冻结源图中的 E01…E55 旧编号",
    after: "当前公开账本 E001…E038",
    reason: "消除悬空引用；只做已登记的一对一编号映射。",
    evidence: ["E001", "E038"],
  },
  {
    id: "VC003",
    type: "source-label",
    before: "APP.LOG / app.log",
    after: "冻结运行日志",
    reason: "避免误指仓库中后续产生的新 app.log。",
    evidence: ["E027", "E037"],
  },
  {
    id: "VC004",
    type: "version-boundary",
    before: "当前 HEAD / 当前 checkout",
    after: "审计参考提交 aa1b3173…",
    reason: "源码链接锁定到审计参考提交；运行日志未记录构建 Git SHA。",
    evidence: ["E038"],
  },
  {
    id: "VC005",
    type: "display-name",
    before: "GLM5.2",
    after: "GLM-5.2",
    reason: "统一公开展示名称；不改写冻结日志中的原始模型标识。",
    evidence: ["E023", "E027", "E037"],
  },
  {
    id: "VC006",
    type: "observation-boundary",
    before: "24 月记录",
    after: "代码目标最多 24 月；独立运行观察为 20 月",
    reason: "区分代码目标与完成后独立运行观察，避免把目标写成当次实测。",
    evidence: ["E006", "E019", "E028"],
  },
  {
    id: "VC007",
    type: "coverage-boundary",
    before: "7 家银行",
    after: "页面 7 行估算；指定 6 家覆盖 5 家，缺平安银行",
    reason: "区分页面行数、用户指定范围与实际银行覆盖。",
    evidence: ["E019", "E028"],
  },
  {
    id: "VC008",
    type: "historical-revision",
    before: "4 月净额 +17 吨",
    after: "冻结产物 +17 吨；WGC 后续修订值 +19 吨",
    reason: "同时保留冻结产物事实与权威后续修订，不静默覆盖历史。",
    evidence: ["E011", "E030"],
  },
  {
    id: "VC009",
    type: "reproducibility-boundary",
    before: "SGE 盘中值",
    after: "SGE 盘中值（部分公开复核；日行情不能复现盘中时刻）",
    reason: "日行情页面只能支持品种与日级数据，不能冒充盘中时刻复现。",
    evidence: ["E009", "E010"],
  },
  {
    id: "VC010",
    type: "timeline-boundary",
    before: "18:58:20",
    after: "18:58:20（任务完成后的独立运行观察）",
    reason: "不把完成后的浏览器观察接入冻结日志主链。",
    evidence: ["E006", "E027"],
  },
  {
    id: "VC011",
    type: "recovery-boundary",
    before: "Kimi → GLM",
    after: "Kimi 429 → 用户人工切换 GLM-5.2",
    reason: "本次换模由用户触发，不描述为自动模型 failover。",
    evidence: ["E023", "E027", "E037"],
  },
  {
    id: "VC012",
    type: "runtime-id-redaction",
    before: "截断 Session 前缀与 agent-xxxxxxxx 运行标识",
    after: "<SESSION> 与研究 Agent 脱敏标签",
    reason: "公开报告与生成脚本均不保留可关联单次运行的标识；研究方向由相邻资产名称表达。",
    evidence: ["E027", "E037"],
  },
  {
    id: "VC013",
    type: "clarification-ownership",
    before: "首批四题包含估算口径与不确定项处理",
    after: "首批四题为回购口径、金价品种、银行范围与交付形式",
    reason: "估算处理属于第二批澄清；按冻结日志恢复两个批次的真实归属。",
    evidence: ["E025", "E026", "E027"],
  },
  {
    id: "VC014",
    type: "canonical-phase-model",
    before: "任务编译、资产探索、工程执行、失败收敛、验证交付",
    after: "澄清、研究、约束收敛、实现接管、验证终止",
    reason: "统一 SVG 与证据 JSON 的五阶段模型，保留失败事件但不把它另立为阶段。",
    evidence: ["E025", "E027", "E037"],
  },
  {
    id: "VC015",
    type: "observed-capability-boundary",
    before: "完整 MCP 服务本次日志没有直接命中",
    after: "MCP 连接恢复被日志命中；其他外围能力未在任务主链触发",
    reason: "冻结日志记录了 MCP 断线、重连、initialize 与工具重新发现，不能标成未命中。",
    evidence: ["E027", "E038"],
  },
  {
    id: "VC017",
    type: "concurrency-boundary",
    before: "三个研究 Agent 并行探索",
    after: "三个不同方向研究 Agent 的运行时间窗重叠",
    reason: "日志证明时间窗重叠，不据此推断内部计算始终并行或产生性能收益。",
    evidence: ["E027", "E037"],
  },
  {
    id: "VC018",
    type: "model-scope-boundary",
    before: "GLM-5.2 是 ZhikunCode 核心执行模型",
    after: "GLM-5.2 是本任务人工换模后的主链执行模型",
    reason: "单任务日志不能推出产品级默认模型或通用核心模型定位。",
    evidence: ["E023", "E027", "E037"],
  },
  {
    id: "VC019",
    type: "post-completion-boundary",
    before: "把任务前与完成后的 MCP 恢复日志并列为任务主链",
    after: "区分任务前连接恢复与任务完成后的独立恢复观察",
    reason: "任务终止时间为 18:42:53，之后的恢复事件不能回接为任务执行阶段。",
    evidence: ["E027", "E037", "E038"],
  },
  {
    id: "VC020",
    type: "internal-usage-boundary",
    before: "日志内部 usage 累计数值",
    after: "公开叙事不展示未定义、不可横向比较的内部累计口径",
    reason: "该口径不能稳定映射为 Token、成本或模型工作量；原始值继续保留在冻结来源与结构化证据中。",
    evidence: ["E027"],
  },
];

const correctionHits = new Map(correctionDefinitions.map((item) => [item.id, new Set()]));
const mergedVisualTargets = new Map([
  ["ZhikunCode 国产模型工程控制面", "control-cutaway"],
  ["ZhikunCode 完整工程控制面与本次命中模块", "capability-coverage"],
  ["故障隔离与完成闭环", "completion-gate"],
  ["类型化失败、文件溯源和控制状态证据", "recovery-matrix"],
  ["黄金行情监控系统的代码架构与数据流", "zhikun-architecture"],
  ["Codex 与 ZhikunCode 最终产物的页面结构和状态语义", "zhikun-screen"],
  ["中心分与证据区间重叠关系", "score-overview"],
  ["请求、缓存、刷新、故障和测量边界", "dual-runtime"],
  ["ZhikunCode 三个主 Run 多泳道时间线与需求编译链", "trace-map"],
  ["五个子 Agent 的启动、终态与主链接管关系", "agent-dag"],
  ["工具调用分布、错误返回与最终完成闭环", "tool-fingerprint"],
  ["ZhikunCode 查询循环、上下文诊断、持久交互和工具安全执行链", "query-loop"],
]);

const applyCorrections = (value, sourceKey) => {
  let output = value;
  const sessionPlaceholder = /<svg\b/.test(value) ? "&lt;SESSION&gt;" : "<SESSION>";
  const mark = (id, next) => {
    if (next !== output) {
      correctionHits.get(id).add(sourceKey);
      output = next;
    }
  };
  mark("VC001", output.replaceAll(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, sessionPlaceholder));
  const legacyPattern = new RegExp(`\\b(${Object.keys(legacyEvidenceMap).sort((a, b) => b.length - a.length).join("|")})\\b`, "g");
  mark("VC002", output.replaceAll(legacyPattern, (match) => legacyEvidenceMap[match]));
  mark("VC003", output.replaceAll(/\bAPP\.LOG\b/gi, "冻结运行日志").replaceAll(/\bapp\.log\b/g, "冻结运行日志"));
  mark("VC004", output
    .replaceAll(/当前 HEAD/g, "审计参考提交 aa1b3173…")
    .replaceAll(/当前 checkout(?::\s*[0-9a-f]{7,40})?/gi, "审计参考提交 aa1b3173…"));
  mark("VC005", output.replaceAll(/\bGLM5\.2\b/g, "GLM-5.2"));
  mark("VC006", output
    .replaceAll("24 月记录 · 月度增持 + 累计储备", "目标≤24月 · 独立观察20月 · 月度增持 + 累计储备")
    .replaceAll("24月记录 · 月度增持 + 累计储备", "目标≤24月 · 独立观察20月 · 月度增持 + 累计储备"));
  mark("VC007", output
    .replaceAll("7 家银行积存金估算表", "7行估算 · 指定6家覆盖5家（缺平安）")
    .replaceAll("7 家银行估价表", "7行估算 · 指定6家覆盖5家（缺平安）"));
  mark("VC008", output.replaceAll("4 月净额使用 +17 吨，权威修订值为 +19 吨", "冻结产物 4 月净额 +17 吨；WGC 后续修订值 +19 吨"));
  mark("VC009", output.replaceAll("SGE Au99.99 / Au(T+D)", "SGE Au99.99 / Au(T+D) · 部分复核"));
  mark("VC010", output.replaceAll(/18:58:20(?!（任务完成后的独立运行观察）)/g, "18:58:20（任务完成后的独立运行观察）"));
  mark("VC011", output
    .replaceAll("Kimi → 人工切换 GLM", "Kimi 429 → 用户人工切换 GLM-5.2")
    .replaceAll("Kimi → GLM 本次为人工切换，不是自动 failover", "Kimi 429 → 用户人工切换 GLM-5.2；不是自动 failover"));
  mark("VC012", output
    .replaceAll(/\b[0-9a-f]{8}…/gi, sessionPlaceholder)
    .replaceAll(/\bagent-[0-9a-f]{8}\b/gi, "研究 Agent（运行标识已脱敏）"));
  mark("VC013", output.replaceAll(
    "数据范围 · 交付形式 · 估算口径 · 不确定项处理",
    "回购口径 · 金价品种 · 银行范围 · 交付形式",
  ));
  if (sourceKey === "zhikun-06") {
    mark("VC014", output
      .replaceAll(
        "从任务编译、资产探索、工程执行、失败收敛到验证交付。滚动阅读时仅高亮当前阶段与已经经过的主链。",
        "从澄清、研究、约束收敛、实现接管到验证终止；阶段口径与证据 JSON 及静态表格一致。",
      )
      .replaceAll("任务编译", "澄清")
      .replaceAll("6 问题 → 执行合同", "首批 4 题完成")
      .replaceAll("资产探索", "研究")
      .replaceAll("5 Agent · 3 完成", "3 研究 Agent · 时间重叠")
      .replaceAll("工程执行", "约束收敛")
      .replaceAll("44 轮 · 60 主工具", "后续 2 题 · Plan Mode")
      .replaceAll("失败收敛", "实现接管")
      .replaceAll("429 / max_turns / exit 1", "44 轮 · 60 次主工具")
      .replaceAll("验证交付", "验证终止"));
  }
  if (sourceKey === "zhikun-14") {
    mark("VC015", output
      .replaceAll(
        "本次任务从React和WebSocket进入Java QueryEngine，经模型与工具控制面生成产物。Python Capability Service、完整MCP服务和浏览器自动化属于源码或产品资料确认，但本次日志没有直接命中。",
        "本次任务从 React 和 WebSocket 进入 Java QueryEngine；日志直接命中 MCP 连接恢复，Python 分析域、Skills、插件和浏览器自动化未在任务主链触发。",
      )
      .replaceAll(
        "分析域存在；本次黄金监控日志未直接命中",
        "能力清单刷新被记录；任务未调用分析域",
      )
      .replaceAll(
        "外围能力需独立运行证据",
        "MCP 恢复已命中；其余能力未在主链触发",
      ));
  }
  if (sourceKey === "zhikun-02") {
    output = output
      .replaceAll(
        /从底部的开源交付、控制面源码，到[^。]+仓库级评测产物，再到黄金监控端到端案例。每层分别标注证据和边界。/g,
        "本图只解释黄金监控案例的公开证据层级；其他任务或基准结果不属于本案例证据链。",
      )
      .replaceAll(/[^<>]*仓库级评测产物/g, "本案例未覆盖的外部评测")
      .replaceAll("300 实例 · 284 非空 Patch · results.json 记录 168 resolved", "不纳入本页结论、评分或能力证明")
      .replaceAll("metadata checked:false · 不表述为外部排行榜认证", "如需引用，应在独立报告中单独核验")
      .replaceAll("评测产物", "边界声明");
  }
  mark("VC017", output
    .replaceAll("三个研究Agent并行探索", "三个不同方向研究 Agent 的运行时间窗重叠")
    .replaceAll("三个研究 Agent 并行探索", "三个不同方向研究 Agent 的运行时间窗重叠"));
  mark("VC018", output.replaceAll(
    "GLM-5.2是ZhikunCode核心执行模型",
    "GLM-5.2是本任务人工换模后的主链执行模型",
  ));
  if (sourceKey === "zhikun-23") {
    mark("VC019", output
      .replaceAll(
        "日志直接记录 API 熔断器从 OPEN 进入 HALF_OPEN 并在探测成功后 CLOSED；MCP 健康检查失败后自动退避重连、初始化、重新发现四个工具并恢复注册表。",
        "日志记录 API 熔断恢复；MCP 在任务前完成连接恢复，任务结束后另有独立的重连、初始化与工具重新发现观察。",
      )
      .replaceAll(
        "MCP CLIENT · LOG L25–L43 / L17058–L17076 / L17170–L17188",
        "MCP · L25–L43；完成后观察 L17058–L17188",
      ));
  }
  mark("VC020", output
    .replaceAll(" · usage 338,911", "")
    .replaceAll(" · TERMINATE_SUCCESS · usage 4,511,926", " · TERMINATE_SUCCESS"));
  return output;
};

const extractRawSvgs = (html) => [...html.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map((match) => match[0]);

const scopeCss = (css, family) => {
  const scope = `.source-visual-panel[data-source-family="${family}"]`;
  const root = postcss.parse(css);
  root.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
    rule.selectors = rule.selectors.map((selector) => {
      const trimmed = selector.trim();
      if (trimmed === ":root" || trimmed === "html" || trimmed === "body") return scope;
      if (/^(?:html|body)\s+/.test(trimmed)) return trimmed.replace(/^(?:html|body)\s+/, `${scope} `);
      if (/^(?:html|body)(?=[.#:[>+~])/.test(trimmed)) return trimmed.replace(/^(?:html|body)/, scope);
      return `${scope} ${trimmed}`;
    });
  });
  root.walkAtRules((rule) => {
    if (["font-face", "import"].includes(rule.name.toLowerCase())) rule.remove();
  });
  return root.toString();
};

const namespaceSvgIds = (svg, prefix) => {
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const uniqueIds = [...new Set(ids)];
  let output = svg;
  for (const id of uniqueIds.sort((a, b) => b.length - a.length)) {
    const next = `${prefix}-${id}`;
    output = output
      .replaceAll(new RegExp(`\\bid="${id.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}"`, "g"), `id="${next}"`)
      .replaceAll(new RegExp(`url\\(#${id.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\)`, "g"), `url(#${next})`)
      .replaceAll(new RegExp(`(["'])#${id.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\1`, "g"), `$1#${next}$1`);
  }
  for (const attribute of ["aria-labelledby", "aria-describedby"]) {
    output = output.replaceAll(new RegExp(`${attribute}="([^"]+)"`, "g"), (_, tokens) =>
      `${attribute}="${tokens.split(/\s+/).map((token) => uniqueIds.includes(token) ? `${prefix}-${token}` : token).join(" ")}"`);
  }
  return output;
};

const shapeTags = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "use"]);
const inspectSvg = (svg) => {
  const dom = new JSDOM(`<!doctype html><body>${svg}</body>`);
  const element = dom.window.document.querySelector("svg");
  assert(element, "unable to inspect SVG");
  const texts = [...element.querySelectorAll("title,desc,text,tspan")].map((node) => node.textContent.replace(/\s+/g, " ").trim());
  const geometry = [...element.querySelectorAll([...shapeTags].join(","))].map((node) => {
    const attrs = [...node.attributes]
      .filter((attribute) => !["id", "class", "aria-labelledby", "aria-describedby"].includes(attribute.name) && !attribute.value.includes("url(#"))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((attribute) => `${attribute.name}=${attribute.value}`).join("|");
    return `${node.tagName}:${attrs}`;
  });
  const result = {
    viewBox: element.getAttribute("viewBox") || "",
    textCount: texts.length,
    orderedTextSha256: sha256(JSON.stringify(texts)),
    shapeCount: geometry.length,
    geometrySha256: sha256(JSON.stringify(geometry)),
    groupCount: element.querySelectorAll("g").length,
    pathCount: element.querySelectorAll("path").length,
    idCount: element.querySelectorAll("[id]").length,
    orderedTexts: texts,
    description: element.querySelector("desc")?.textContent.replace(/\s+/g, " ").trim() || "",
  };
  dom.window.close();
  return result;
};

const sourceDocuments = {};
const snapshots = [];
const cssIdMaps = { zhikun: new Map(), comparison: new Map() };
for (const [family, sourcePath] of Object.entries(sourcePaths)) {
  const bytes = fs.readFileSync(sourcePath);
  const html = bytes.toString("utf8");
  const rawSvgs = extractRawSvgs(html);
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "https://audit-source.invalid/",
    beforeParse(window) {
      window.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
      window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
      window.scrollTo = () => {};
      window.CSS = {
        escape: (value) => String(value).replaceAll(/[^a-zA-Z0-9_-]/g, "\\$&"),
        supports: () => false,
      };
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
        get(target, property) {
          if (property === "measureText") return () => ({ width: 0 });
          if (property === "createLinearGradient") return () => ({ addColorStop() {} });
          if (!(property in target)) target[property] = () => {};
          return target[property];
        },
        set(target, property, value) {
          target[property] = value;
          return true;
        },
      });
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 120));
  const materialized = [...dom.window.document.querySelectorAll("svg")];
  const inventory = sourceVisualInventory.filter((item) => item.source === family);
  assert(rawSvgs.length === inventory.length, `${family} raw SVG count drifted`);
  assert(materialized.length === inventory.length, `${family} materialized SVG count drifted`);
  const styleText = [...dom.window.document.querySelectorAll("style")].map((node) => node.textContent).join("\n");
  sourceDocuments[family] = {
    sha256: sha256(bytes),
    svgCount: inventory.length,
    scopedCss: scopeCss(styleText, family),
  };
  for (const [index, item] of inventory.entries()) {
    const sourceKey = `${family}-${String(index + 1).padStart(2, "0")}`;
    const title = materialized[index].querySelector("title")?.textContent.trim();
    assert(title === item.title, `${sourceKey} title drift: ${title}`);
    let corrected = applyCorrections(materialized[index].outerHTML, sourceKey);
    for (const id of [...corrected.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])) {
      assert(!cssIdMaps[family].has(id), `${family} source SVG id is duplicated: ${id}`);
      cssIdMaps[family].set(id, `gold-${sourceKey}-${id}`);
    }
    corrected = namespaceSvgIds(corrected, `gold-${sourceKey}`);
    const appliedCorrections = correctionDefinitions.filter((definition) => correctionHits.get(definition.id).has(sourceKey)).map((definition) => definition.id);
    const originalInspection = inspectSvg(rawSvgs[index]);
    const materializedInspection = inspectSvg(materialized[index].outerHTML);
    const publishedInspection = inspectSvg(corrected);
    assert(materializedInspection.viewBox === publishedInspection.viewBox, `${sourceKey} viewBox changed during publication`);
    assert(materializedInspection.shapeCount === publishedInspection.shapeCount, `${sourceKey} shape count changed during publication`);
    assert(materializedInspection.groupCount === publishedInspection.groupCount, `${sourceKey} group count changed during publication`);
    assert(materializedInspection.pathCount === publishedInspection.pathCount, `${sourceKey} path count changed during publication`);
    assert(materializedInspection.geometrySha256 === publishedInspection.geometrySha256, `${sourceKey} geometry changed during publication`);
    assert(
      JSON.stringify(publishedInspection.orderedTexts) ===
        JSON.stringify(materializedInspection.orderedTexts.map((text) => applyCorrections(text, sourceKey))),
      `${sourceKey} contains an unregistered text change`,
    );
    snapshots.push({
      key: sourceKey,
      source: family,
      order: index + 1,
      title: item.title,
      description: publishedInspection.description || item.reason,
      status: item.status,
      reason: item.reason,
      originalSvgSha256: sha256(rawSvgs[index]),
      materializedSvgSha256: sha256(materialized[index].outerHTML),
      publishedSvgSha256: sha256(corrected),
      original: originalInspection,
      materialized: materializedInspection,
      published: publishedInspection,
      correctionIds: appliedCorrections,
      svg: corrected,
    });
  }
  dom.window.close();
}
for (const [family, idMap] of Object.entries(cssIdMaps)) {
  let css = sourceDocuments[family].scopedCss;
  for (const [id, namespacedId] of [...idMap.entries()].sort((a, b) => b[0].length - a[0].length)) {
    css = css.replaceAll(new RegExp(`#${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_-])`, "g"), `#${namespacedId}`);
  }
  sourceDocuments[family].scopedCss = css;
}

const targetByTitle = new Map();
for (const visual of visualManifest) {
  for (const title of visual.sourceReferences) {
    if (!targetByTitle.has(title)) targetByTitle.set(title, visual.id);
  }
}
for (const [title, target] of mergedVisualTargets) targetByTitle.set(title, target);
for (const snapshot of snapshots) {
  if (snapshot.status === "omitted") {
    assert(!targetByTitle.has(snapshot.title), `omitted visual is targeted: ${snapshot.title}`);
    snapshot.targetFigureId = null;
  } else {
    assert(targetByTitle.has(snapshot.title), `published source visual has no target: ${snapshot.title}`);
    snapshot.targetFigureId = targetByTitle.get(snapshot.title);
  }
}
assert(snapshots.length === 46, "expected forty-six source SVG snapshots");
assert(snapshots.filter((item) => item.status !== "omitted").length === 44, "expected forty-four published SVG snapshots");
assert(snapshots.filter((item) => item.status === "included").length === 32, "expected thirty-two primary SVG snapshots");
assert(snapshots.filter((item) => item.status === "merged").length === 12, "expected twelve merged SVG snapshots");
assert(snapshots.filter((item) => item.status === "omitted").length === 2, "expected two omitted SVG snapshots");

const visualCorrections = correctionDefinitions.map((definition) => ({
  ...definition,
  affectedSourceVisuals: [...correctionHits.get(definition.id)].sort(),
}));

const publicAudit = snapshots.map(({ svg, original, materialized, published, ...item }) => ({
  ...item,
  viewBox: published.viewBox,
  semanticUnits: {
    textNodes: published.textCount,
    shapes: published.shapeCount,
    groups: published.groupCount,
    paths: published.pathCount,
  },
  baseline: {
    viewBox: materialized.viewBox,
    textNodes: materialized.textCount,
    orderedTextSha256: materialized.orderedTextSha256,
    shapes: materialized.shapeCount,
    geometrySha256: materialized.geometrySha256,
    groups: materialized.groupCount,
    paths: materialized.pathCount,
  },
  published: {
    orderedTextSha256: published.orderedTextSha256,
    geometrySha256: published.geometrySha256,
  },
}));

const bundle = {
  sourceDocuments: Object.fromEntries(Object.entries(sourceDocuments).map(([key, value]) => [key, {
    sha256: value.sha256,
    svgCount: value.svgCount,
  }])),
  sourceVisualAudit: publicAudit,
  visualCorrections,
  snapshots: Object.fromEntries(snapshots.filter((item) => item.status !== "omitted").map((item) => [item.key, {
    key: item.key,
    title: item.title,
    description: item.description,
    source: item.source,
    order: item.order,
    status: item.status,
    reason: item.reason,
    targetFigureId: item.targetFigureId,
    originalSvgSha256: item.originalSvgSha256,
    correctionIds: item.correctionIds,
    svg: item.svg,
  }])),
  css: Object.values(sourceDocuments).map((item) => item.scopedCss).join("\n"),
};
const compressed = compactGzip(JSON.stringify(bundle));
const generated = `// Generated by capture-gold-audit-source-visuals.mjs from hash-registered private source reports.\n`
  + `// The private source paths and omitted SVG bodies are intentionally not embedded.\n`
  + `import zlib from "node:zlib";\n\n`
  + `const compressedBundle = \`${escapeTemplate(compressed)}\`;\n`
  + `const bundle = JSON.parse(zlib.gunzipSync(Buffer.from(compressedBundle, "base64")).toString("utf8"));\n\n`
  + `export const sourceDocumentAudit = bundle.sourceDocuments;\n`
  + `export const sourceVisualAudit = bundle.sourceVisualAudit;\n`
  + `export const visualCorrections = bundle.visualCorrections;\n`
  + `export const sourceVisualSnapshots = bundle.snapshots;\n`
  + `export const sourceVisualCss = bundle.css;\n`;

fs.writeFileSync(outputPath, generated);
console.log(`Captured ${snapshots.length} source SVGs; publishing 44 panels in 32 groups.`);
console.log(`Wrote ${path.relative(process.cwd(), outputPath)} (${Buffer.byteLength(generated)} bytes).`);
