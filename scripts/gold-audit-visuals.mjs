import {
  sourceDocumentAudit,
  sourceVisualSnapshots,
  sourceVisualAudit,
  sourceVisualCss,
  visualCorrections,
} from "./gold-audit-source-visuals.mjs";

const x = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const refs = (ids = []) => ids.map((id) => `<a href="#evidence-${x(id)}">${x(id)}</a>`).join(" ");

export const sourceVisualInventory = [
  { source: "zhikun", title: "ZhikunCode 国产模型工程控制面", status: "merged", reason: "由控制面剖视图、三端系统和能力覆盖图共同承接。" },
  { source: "zhikun", title: "ZhikunCode 四层证据金字塔", status: "included", reason: "解释证据等级与公开复核状态的区别。" },
  { source: "zhikun", title: "Codex用户能力心智到ZhikunCode控制面的映射", status: "included", reason: "保留熟悉能力到实际机制的映射，同时标记未验证能力。" },
  { source: "zhikun", title: "Codex 与 ZhikunCode 的本次配置、工程路径和任务级结果", status: "included", reason: "提供同题运行边界总览。" },
  { source: "zhikun", title: "十四维加权贡献差值图", status: "included", reason: "解释总分相近背后的结构差异。" },
  { source: "zhikun", title: "黄金监控任务五阶段执行脉冲", status: "included", reason: "提供执行阶段与时间窗。" },
  { source: "zhikun", title: "ZhikunCode 黄金监控任务多泳道执行 Trace Map", status: "included", reason: "展示多角色事件顺序。" },
  { source: "zhikun", title: "从模糊需求到可执行约束集", status: "included", reason: "展示需求编译与证据边界。" },
  { source: "zhikun", title: "研究证据到交付资产的来源链", status: "included", reason: "展示研究资产与交付文件的控制流血缘。" },
  { source: "zhikun", title: "验证返工、失败隔离与完成门禁闭环", status: "included", reason: "解释 Verify 不是最终终止。" },
  { source: "zhikun", title: "主协调器六十次工具调用指纹", status: "included", reason: "保留完整有序工具调用指纹。" },
  { source: "zhikun", title: "ZhikunCode 控制面剖视图与本次日志命中路径", status: "included", reason: "区分日志命中、源码解释和未触发能力。" },
  { source: "zhikun", title: "ZhikunCode 完整工程控制面与本次命中模块", status: "merged", reason: "并入完整能力覆盖图和控制面剖视图，避免重复总览。" },
  { source: "zhikun", title: "三端系统与本次日志实际路径", status: "included", reason: "展示前端、控制面、模型与工具端边界。" },
  { source: "zhikun", title: "黄金监控任务端到端执行时序", status: "included", reason: "展示请求至消息持久化的时序。" },
  { source: "zhikun", title: "QueryEngine 八步 Agent Loop", status: "included", reason: "解释主循环的控制步骤。" },
  { source: "zhikun", title: "ContextCascade 六层上下文治理与本次触发层", status: "included", reason: "展示上下文诊断与压缩边界。" },
  { source: "zhikun", title: "主 Agent 与五个子 Agent 的执行 DAG", status: "included", reason: "展示五个子 Agent 的终态与主链接管。" },
  { source: "zhikun", title: "统一工具授权与唯一执行入口", status: "included", reason: "展示工具安全执行门禁。" },
  { source: "zhikun", title: "持久交互与会话恢复状态机", status: "included", reason: "展示澄清交互的恢复语义。" },
  { source: "zhikun", title: "故障隔离与完成闭环", status: "merged", reason: "并入完成门禁、恢复状态机和失败矩阵。" },
  { source: "zhikun", title: "ZhikunCode Capability Overview 完整能力地图与本次运行证据覆盖", status: "included", reason: "完整展示能力层级和本案例覆盖。" },
  { source: "zhikun", title: "API Circuit Breaker 与 MCP 自动恢复状态机", status: "included", reason: "区分协议自动恢复与人工换模。" },
  { source: "zhikun", title: "分阶段子 Agent 调度与轮内工具并发模型", status: "included", reason: "展示时间重叠、最大轮次与工具队列。" },
  { source: "zhikun", title: "类型化失败、文件溯源和控制状态证据", status: "merged", reason: "并入恢复方式与运行版本边界矩阵。" },
  { source: "zhikun", title: "黄金行情监控系统的代码架构与数据流", status: "merged", reason: "由 ZhikunCode 分层架构、生命周期和数据血缘分别承接。" },
  { source: "zhikun", title: "Codex 与 ZhikunCode 最终产物的页面结构和状态语义", status: "merged", reason: "拆为两侧独立屏幕所有权图，减少拥挤。" },
  { source: "zhikun", title: "模型候选与控制面机制共同形成可观察交付链", status: "omitted", reason: "带有难以由单任务隔离验证的模型与控制面因果暗示。" },
  { source: "comparison", title: "审计决策星图", status: "omitted", reason: "与十四维共享标尺和加权贡献图重复，且极坐标会放大形状印象。" },
  { source: "comparison", title: "两套系统综合评分与证据不确定区间", status: "included", reason: "展示中心分与不确定区间。" },
  { source: "comparison", title: "中心分与证据区间重叠关系", status: "merged", reason: "已并入综合评分与证据区间图。" },
  { source: "comparison", title: "两套系统十四维评分点图", status: "included", reason: "共享标尺展示结构差异。" },
  { source: "comparison", title: "黄金数据从权威来源到页面标签的血缘链", status: "included", reason: "解释数据准确性和页面标签的距离。" },
  { source: "comparison", title: "ZhikunCode 冻结代码的 Flask 分层架构", status: "included", reason: "完整呈现 Flask 冻结产物架构。" },
  { source: "comparison", title: "Codex 冻结代码的 Next.js 客户端与服务端聚合架构", status: "included", reason: "完整呈现 Next.js 冻结产物架构。" },
  { source: "comparison", title: "ZhikunCode 运行与数据生命周期", status: "included", reason: "独立展示刷新、缓存和降级生命周期。" },
  { source: "comparison", title: "ZhikunCode 屏幕解剖、代码归属与状态", status: "included", reason: "独立展示屏幕模块和代码所有权。" },
  { source: "comparison", title: "Codex 运行与数据生命周期", status: "included", reason: "独立展示轮询、聚合和静态数据边界。" },
  { source: "comparison", title: "Codex 屏幕解剖、代码归属与状态", status: "included", reason: "独立展示屏幕模块和代码所有权。" },
  { source: "comparison", title: "ZhikunCode 与 Codex 最终产物运行时执行链", status: "included", reason: "并排比较两侧运行链。" },
  { source: "comparison", title: "请求、缓存、刷新、故障和测量边界", status: "merged", reason: "并入双运行链和两侧生命周期图。" },
  { source: "comparison", title: "ZhikunCode 三个主 Run 多泳道时间线与需求编译链", status: "merged", reason: "拆入 Trace Map、需求编译图和端到端时序图。" },
  { source: "comparison", title: "五个子 Agent 的启动、终态与主链接管关系", status: "merged", reason: "由 Agent DAG 和并发模型共同承接。" },
  { source: "comparison", title: "工具调用分布、错误返回与最终完成闭环", status: "merged", reason: "由 60 次工具指纹和完成门禁共同承接。" },
  { source: "comparison", title: "ZhikunCode 查询循环、上下文诊断、持久交互和工具安全执行链", status: "merged", reason: "拆为 QueryEngine、ContextCascade、授权和持久交互四张图。" },
  { source: "comparison", title: "失败隔离、恢复方式、文件溯源和运行版本边界矩阵", status: "included", reason: "保留跨机制边界对照。" },
];

export const visualManifest = [
  { key: "evidencePyramid", id: "evidence-pyramid", section: "score-visuals", title: "证据分成四层", takeaway: "证据等级、作者核验和公开可查是三件不同的事。", sourceReferences: ["ZhikunCode 四层证据金字塔"], evidence: ["E001", "E027", "E037", "E038"] },
  { key: "configurationOverview", id: "configuration-overview", section: "score-visuals", title: "两次运行的条件并不相同", takeaway: "模型、人工介入、工程路径和交付方式都需要分别比较。", sourceReferences: ["Codex 与 ZhikunCode 的本次配置、工程路径和任务级结果"], evidence: ["E002", "E003", "E006", "E023", "E024", "E027"] },
  { key: "scoreOverview", id: "score-overview", section: "score-visuals", title: "总分接近，区间也重叠", takeaway: "68.3 与 68.4 的差距不足以说明哪一侧实质领先。", sourceReferences: ["两套系统综合评分与证据不确定区间", "中心分与证据区间重叠关系"], evidence: ["E022", "E023", "E024"] },
  { key: "scoreDimensions", id: "score-dimensions", section: "score-visuals", title: "相近总分来自不同的强弱项", takeaway: "十四个维度放在同一标尺上后，两侧的结构差异比总分更清楚。", sourceReferences: ["两套系统十四维评分点图"], evidence: ["E022", "E023", "E024"] },
  { key: "scoreWeightedDelta", id: "score-weighted-delta", section: "score-visuals", title: "各维度怎样影响总分", takeaway: "正负贡献相互抵消，最终只留下 0.1 分差距。", sourceReferences: ["十四维加权贡献差值图"], evidence: ["E022", "E023", "E024"] },
  { key: "executionPulse", id: "execution-pulse", section: "timeline", title: "五个执行阶段", takeaway: "任务依次经历澄清、研究、约束确认、实现和验证。", sourceReferences: ["黄金监控任务五阶段执行脉冲"], evidence: ["E025", "E027", "E037"] },
  { key: "traceMap", id: "trace-map", section: "timeline", title: "用户、主任务与子 Agent 时间线", takeaway: "时间线展示了交互、子任务、文件操作和验证事件如何交错。", sourceReferences: ["ZhikunCode 黄金监控任务多泳道执行 Trace Map", "ZhikunCode 三个主 Run 多泳道时间线与需求编译链"], evidence: ["E001", "E006", "E025", "E027", "E037"] },
  { key: "requirementCompiler", id: "requirement-compiler", section: "timeline", title: "需求如何被澄清", takeaway: "六个问题把模糊目标收敛为可执行的交付约束。", sourceReferences: ["从模糊需求到可执行约束集"], evidence: ["E001", "E025", "E026", "E027"] },
  { key: "executionSequence", id: "execution-sequence", section: "timeline", title: "一次任务请求的处理过程", takeaway: "请求依次经过上下文、模型、工具执行、结果回注和消息持久化。", sourceReferences: ["黄金监控任务端到端执行时序"], evidence: ["E027", "E037", "E038"] },
  { key: "researchLineage", id: "research-lineage", section: "timeline", title: "研究结果与最终文件", takeaway: "三份研究文档回到主任务后，继续形成六个应用文件。", sourceReferences: ["研究证据到交付资产的来源链"], evidence: ["E027", "E037"] },
  { key: "agentDag", id: "agent-dag", section: "timeline", title: "主任务与五个子 Agent", takeaway: "三个研究任务完成；两个实现任务达到轮次上限后由主任务接管。", sourceReferences: ["主 Agent 与五个子 Agent 的执行 DAG", "五个子 Agent 的启动、终态与主链接管关系"], evidence: ["E027", "E037"] },
  { key: "concurrencyModel", id: "concurrency-model", section: "timeline", title: "子 Agent 与工具如何并行", takeaway: "研究任务在时间上重叠，单轮工具则通过执行队列调度。", sourceReferences: ["分阶段子 Agent 调度与轮内工具并发模型"], evidence: ["E027", "E037", "E038"] },
  { key: "toolFingerprint", id: "tool-fingerprint", section: "timeline", title: "主任务的 60 次工具调用", takeaway: "完整顺序保留了 54 次正常返回和 6 次错误返回。", sourceReferences: ["主协调器六十次工具调用指纹", "工具调用分布、错误返回与最终完成闭环"], evidence: ["E027", "E037"] },
  { key: "completionGate", id: "completion-gate", section: "timeline", title: "为什么验证后还继续修改", takeaway: "VerifyJourney 是中间检查点，Brief 和成功终止事件才结束这次任务。", sourceReferences: ["验证返工、失败隔离与完成门禁闭环", "故障隔离与完成闭环"], evidence: ["E027", "E037"] },
  { key: "capabilityMapping", id: "capability-mapping", section: "control-plane", title: "常见 AI 编程功能在 ZhikunCode 中的实现", takeaway: "规划、委派、授权、上下文和验证分别对应到具体控制组件。", sourceReferences: ["Codex用户能力心智到ZhikunCode控制面的映射"], evidence: ["E027", "E038"] },
  { key: "threeSystemPath", id: "three-system-path", section: "control-plane", title: "前端、控制面与执行端", takeaway: "前端负责交互，Java 控制面组织任务，模型和工具端完成实际调用。", sourceReferences: ["三端系统与本次日志实际路径"], evidence: ["E027", "E037", "E038"] },
  { key: "controlCutaway", id: "control-cutaway", section: "control-plane", title: "ZhikunCode 的任务执行架构", takeaway: "图中区分了持久实体、本次运行路径和仅由源码确认的机制。", sourceReferences: ["ZhikunCode 控制面剖视图与本次日志命中路径", "ZhikunCode 国产模型工程控制面"], evidence: ["E027", "E037", "E038"] },
  { key: "capabilityCoverage", id: "capability-coverage", section: "control-plane", title: "本次案例实际验证了哪些能力", takeaway: "日志命中、源码确认和本案例未覆盖的能力使用不同状态标记。", sourceReferences: ["ZhikunCode Capability Overview 完整能力地图与本次运行证据覆盖", "ZhikunCode 完整工程控制面与本次命中模块"], evidence: ["E027", "E038"] },
  { key: "queryLoop", id: "query-loop", section: "control-plane", title: "QueryEngine 的八个步骤", takeaway: "主循环从构造上下文开始，在调用工具、继续推理或终止之间推进。", sourceReferences: ["QueryEngine 八步 Agent Loop", "ZhikunCode 查询循环、上下文诊断、持久交互和工具安全执行链"], evidence: ["E027", "E037", "E038"] },
  { key: "contextCascade", id: "context-cascade", section: "control-plane", title: "ContextCascade 的六层上下文处理", takeaway: "长任务先诊断上下文压力，再决定是否压缩以及保留哪些边界。", sourceReferences: ["ContextCascade 六层上下文治理与本次触发层"], evidence: ["E027", "E038"] },
  { key: "authorizationGateway", id: "authorization-gateway", section: "control-plane", title: "工具调用怎样获得授权", takeaway: "Schema 校验、风险判断和用户授权都通过同一个执行入口。", sourceReferences: ["统一工具授权与唯一执行入口"], evidence: ["E027", "E038"] },
  { key: "durableInteraction", id: "durable-interaction", section: "control-plane", title: "澄清弹窗怎样恢复", takeaway: "待回答问题会持久化，并在连接恢复后继续交付给前端。", sourceReferences: ["持久交互与会话恢复状态机"], evidence: ["E026", "E027", "E038"] },
  { key: "resilienceState", id: "resilience-state", section: "control-plane", title: "API 熔断、MCP 重连与人工换模", takeaway: "前两者有自动恢复状态机；本次模型切换由用户手动完成。", sourceReferences: ["API Circuit Breaker 与 MCP 自动恢复状态机"], evidence: ["E027", "E038"] },
  { key: "recoveryMatrix", id: "recovery-matrix", section: "control-plane", title: "失败处理与文件记录", takeaway: "不同故障使用不同恢复路径，文件活动则通过哈希和编辑者信息追踪。", sourceReferences: ["类型化失败、文件溯源和控制状态证据", "失败隔离、恢复方式、文件溯源和运行版本边界矩阵"], evidence: ["E027", "E037", "E038"] },
  { key: "dataLineage", id: "data-lineage", section: "product-audit", title: "数据来源与页面展示", takeaway: "页面数字分为动态报价、估算、静态快照和官方入口核验四类。", sourceReferences: ["黄金数据从权威来源到页面标签的血缘链"], evidence: ["E009", "E010", "E011", "E019", "E020", "E028", "E030", "E036"] },
  { key: "zhikunArchitecture", id: "zhikun-architecture", section: "product-audit", title: "ZhikunCode 产物的 Flask 架构", takeaway: "启动脚本、页面、六个路由、抓取器和月度缓存组成完整运行路径。", sourceReferences: ["ZhikunCode 冻结代码的 Flask 分层架构", "黄金行情监控系统的代码架构与数据流"], evidence: ["E006", "E007", "E019", "E028", "E032", "E034", "E036"] },
  { key: "zhikunLifecycle", id: "zhikun-lifecycle", section: "product-audit", title: "ZhikunCode 怎样刷新数据", takeaway: "行情和银行数据每 30 秒刷新，央行数据按月缓存并支持预热。", sourceReferences: ["ZhikunCode 运行与数据生命周期"], evidence: ["E006", "E007", "E019", "E028", "E034", "E036"] },
  { key: "zhikunScreen", id: "zhikun-screen", section: "product-audit", title: "ZhikunCode 页面模块与对应代码", takeaway: "每个可见模块都可以追到页面、路由、抓取器或配置文件。", sourceReferences: ["ZhikunCode 屏幕解剖、代码归属与状态", "Codex 与 ZhikunCode 最终产物的页面结构和状态语义"], evidence: ["E005", "E006", "E019", "E028", "E035", "E036"] },
  { key: "codexArchitecture", id: "codex-architecture", section: "product-audit", title: "Codex 产物的 Next.js 架构", takeaway: "页面通过单一 API 聚合五个并发任务，并组合动态报价和静态央行数据。", sourceReferences: ["Codex 冻结代码的 Next.js 客户端与服务端聚合架构"], evidence: ["E003", "E008", "E018", "E020", "E030", "E034", "E036"] },
  { key: "codexLifecycle", id: "codex-lifecycle", section: "product-audit", title: "Codex 怎样刷新数据", takeaway: "页面每 60 秒轮询，服务端并发聚合并设置缓存；央行数组不随请求更新。", sourceReferences: ["Codex 运行与数据生命周期"], evidence: ["E003", "E018", "E020", "E030", "E034", "E036"] },
  { key: "codexScreen", id: "codex-screen", section: "product-audit", title: "Codex 页面模块与对应代码", takeaway: "屏幕状态主要分布在页面组件、市场 API 和样式文件中。", sourceReferences: ["Codex 屏幕解剖、代码归属与状态"], evidence: ["E003", "E008", "E018", "E020", "E030", "E035", "E036"] },
  { key: "dualRuntime", id: "dual-runtime", section: "product-audit", title: "两套产物怎样获取和刷新数据", takeaway: "两侧在请求并发、缓存位置、刷新频率和失败反馈上采用了不同方案。", sourceReferences: ["ZhikunCode 与 Codex 最终产物运行时执行链", "请求、缓存、刷新、故障和测量边界"], evidence: ["E006", "E018", "E030", "E034", "E035", "E036"] },
];

const snapshotByTitle = new Map(
  Object.values(sourceVisualSnapshots).map((snapshot) => [snapshot.title, snapshot]),
);
const visualAuditByKey = new Map(sourceVisualAudit.map((visual) => [visual.key, visual]));

const renderSourcePanel = (snapshot, index, panelCount) => {
  const correctionIds = snapshot.correctionIds.join(" ");
  const viewBox = visualAuditByKey.get(snapshot.key)?.viewBox || "0 0 1180 680";
  const [, , nativeWidth = 1180, nativeHeight = 680] = viewBox.split(/\s+/).map(Number);
  const compactClass = nativeWidth < 800 ? " compact-source" : "";
  const portraitClass = nativeHeight > nativeWidth ? " portrait-source" : "";
  const sourceLabel = snapshot.source === "zhikun" ? "单系统报告" : "双系统报告";
  const heading = panelCount > 1
    ? `<header class="source-panel-heading"><div><span class="source-panel-index">${String(index + 1).padStart(2, "0")}</span>
          <span class="source-panel-copy"><strong>${x(snapshot.title)}</strong></span></div>
        <span>来源：${sourceLabel}</span></header>`
    : "";
  return `
    <section class="source-visual-panel ${snapshot.status}${compactClass}${portraitClass}" data-source-family="${x(snapshot.source)}"
      data-source-visual="${x(snapshot.key)}" data-original-svg-sha256="${x(snapshot.originalSvgSha256)}"
      data-correction-ids="${x(correctionIds)}"
      aria-label="${x(snapshot.title)}"
      style="--source-native-width:${nativeWidth}px;--source-native-height:${nativeHeight}px">
      ${heading}
      <div class="source-panel-stage">${snapshot.svg}</div>
    </section>`;
};

const phaseColorById = {
  clarify: "#43d8eb",
  research: "#a77bff",
  converge: "#5a95ff",
  implement: "#f6b94b",
  verify: "#2dd4a8",
};

const renderPhaseStory = (phases = []) => `
  <aside class="phase-story" aria-label="五阶段事实摘要">
    ${phases.map((phase) => `
      <article class="phase-story-card" style="--phase-color:${phaseColorById[phase.id] || "#82b7ff"}">
        <div class="phase-story-index">${String(phase.order).padStart(2, "0")}</div>
        <div class="phase-story-copy">
          <header><h4>${x(phase.label)}</h4><time>${x(phase.time)}</time></header>
          <p>${x(phase.summary)}</p>
          <div class="phase-story-meta">
            <span>${phase.facts.map((fact) => x(fact)).join(" · ")}</span>
            <span>${refs(phase.evidence)}</span>
          </div>
        </div>
      </article>`).join("")}
  </aside>`;

const renderSourceFigure = (visual, number, data) => {
  const panels = visual.sourceReferences.map((title) => {
    const snapshot = snapshotByTitle.get(title);
    if (!snapshot) throw new Error(`source SVG snapshot missing: ${title}`);
    if (snapshot.targetFigureId !== visual.id) {
      throw new Error(`source SVG target drift: ${title} -> ${snapshot.targetFigureId}, expected ${visual.id}`);
    }
    return snapshot;
  });
  const panelMarkup = panels.map((panel, index) => renderSourcePanel(panel, index, panels.length)).join("");
  const sourceBody = visual.id === "execution-pulse"
    ? `<div class="source-panel-stack phase-story-layout">${panelMarkup}${renderPhaseStory(data.executionPhases)}</div>`
    : `<div class="source-panel-stack">${panelMarkup}</div>`;
  return `
    <figure class="audit-visual source-visual-group" id="figure-${x(visual.id)}"
      data-core-visual="${x(visual.id)}" aria-labelledby="${x(visual.id)}-title" aria-describedby="${x(visual.id)}-desc">
      <div class="visual-heading">
        <span class="figure-number">FIG ${String(number).padStart(2, "0")}</span>
        <div><h3 id="${x(visual.id)}-title">${x(visual.title)}</h3>
          <p id="${x(visual.id)}-desc">${x(visual.takeaway)}</p></div>
        <span class="figure-evidence">${refs(visual.evidence)}</span>
      </div>
      ${sourceBody}
    </figure>`;
};

export const renderAuditVisuals = (data) =>
  Object.fromEntries(visualManifest.map((visual, index) => [visual.key, renderSourceFigure(visual, index + 1, data)]));

export { sourceDocumentAudit, sourceVisualAudit, visualCorrections };

export const auditVisualCss = `
  .audit-visual{margin:24px 0 34px;border:1px solid var(--line);border-radius:22px;background:linear-gradient(180deg,rgba(16,22,40,.94),rgba(8,12,24,.96));box-shadow:0 26px 70px rgba(0,0,0,.28);overflow:hidden}
  .visual-heading{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:start;padding:18px 20px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.018)}
  .visual-heading h3{margin:0;color:var(--text);font-size:18px}.visual-heading p{margin:5px 0 0;color:var(--muted);font-size:13px}
  .figure-number{font:700 11px var(--mono);letter-spacing:.15em;color:var(--cyan);padding-top:4px}.figure-evidence{white-space:nowrap}.figure-evidence a{color:var(--blue)}
  .source-panel-stack{display:grid;gap:18px;padding:18px;background-image:linear-gradient(rgba(90,149,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(90,149,255,.035) 1px,transparent 1px);background-size:24px 24px}
  .source-visual-panel{min-width:0;margin:0;overflow:hidden;border:1px solid #2c3850;border-radius:16px;background:#080d18;box-shadow:inset 0 1px rgba(255,255,255,.025)}
  .source-visual-panel.merged{border-color:#3f3b5f}.source-panel-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 15px;border-bottom:1px solid #26324a;background:rgba(255,255,255,.018)}
  .source-panel-heading div{display:flex;align-items:flex-start;gap:9px}.source-panel-heading strong{font-size:13px}.source-panel-copy{display:grid;gap:2px}.source-panel-copy small{max-width:820px;color:#8e9ab5;font-size:11px;line-height:1.45}.source-panel-heading>span{color:#77829f;font:10px var(--mono)}
  .source-panel-index{display:inline-grid;place-items:center;min-width:24px;height:24px;border:1px solid rgba(67,216,235,.35);border-radius:6px;color:#43d8eb;font:700 9px var(--mono)}
  .source-visual-panel.merged .source-panel-index{border-color:rgba(167,123,255,.4);color:#b99aff}
  .source-panel-stage{overflow-x:auto;padding:10px}.source-panel-stage>svg{display:block;width:100%;min-width:960px;height:auto;margin:auto}
  .source-visual-panel.compact-source{width:min(100%,calc(var(--source-native-width) + 22px));justify-self:center}
  .source-visual-panel.compact-source .source-panel-stage>svg{width:var(--source-native-width);min-width:var(--source-native-width);max-width:none}
  .phase-story-layout{grid-template-columns:minmax(322px,360px) minmax(0,1fr);align-items:stretch}
  .phase-story-layout>.source-visual-panel{width:100%;justify-self:stretch}
  .phase-story-layout .source-panel-stage{display:grid;place-items:center;height:100%;overflow:hidden}
  .phase-story-layout .source-panel-stage>svg{width:min(100%,var(--source-native-width));min-width:0}
  .phase-story{display:grid;grid-template-rows:repeat(5,minmax(0,1fr));gap:10px;min-width:0}
  .phase-story-card{display:grid;grid-template-columns:42px 1fr;gap:12px;align-items:start;padding:13px 15px;border:1px solid #30405a;border-color:color-mix(in srgb,var(--phase-color) 36%,#26324a);border-radius:13px;background:#0a101d;background:linear-gradient(100deg,color-mix(in srgb,var(--phase-color) 8%,#0a101d),#0a101d 42%);box-shadow:inset 3px 0 var(--phase-color)}
  .phase-story-index{display:grid;place-items:center;width:38px;height:38px;border:1px solid var(--phase-color);border-radius:50%;color:var(--phase-color);font:700 11px var(--mono)}
  .phase-story-copy{min-width:0}.phase-story-copy header{display:flex;align-items:baseline;justify-content:space-between;gap:12px}.phase-story-copy h4{margin:0;color:var(--text);font-size:16px}.phase-story-copy time{color:var(--phase-color);font:10px var(--mono);white-space:nowrap}
  .phase-story-copy p{margin:4px 0 7px;color:#aeb8d0;font-size:12px;line-height:1.55}.phase-story-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#76829d;font:10px/1.4 var(--mono)}.phase-story-meta>span:first-child{min-width:0}.phase-story-meta a{color:#82b7ff}
  @media(max-width:900px){.phase-story-layout{grid-template-columns:1fr}.phase-story-layout>.source-visual-panel{width:min(100%,382px);justify-self:center}.phase-story-layout .source-panel-stage{height:auto}.phase-story{grid-template-rows:none}.phase-story-card{grid-template-columns:38px 1fr}}
  @media(max-width:720px){.visual-heading{grid-template-columns:1fr}.figure-evidence{white-space:normal}.audit-visual{border-radius:16px}.source-panel-stack{padding:8px}.source-panel-heading{align-items:flex-start;flex-direction:column}.source-panel-stage{padding:5px}.source-panel-stage>svg{min-width:900px}.source-visual-panel.compact-source{width:100%}.source-visual-panel.compact-source .source-panel-stage>svg{min-width:var(--source-native-width)}.phase-story-layout>.source-visual-panel{width:min(100%,382px)}.phase-story-layout .source-panel-stage>svg{min-width:0}.phase-story-copy header,.phase-story-meta{align-items:flex-start;flex-direction:column;gap:4px}.phase-story-card{padding:12px}}
  @media print{.audit-visual{background:#fff;border-color:#bbb;box-shadow:none}.visual-heading{background:#fff;border-color:#ccc}.visual-heading h3{color:#111}.visual-heading p{color:#444}.source-panel-stack{padding:0;background:#fff}.source-visual-panel{break-inside:avoid;background:#fff;border-color:#bbb}.source-panel-heading{background:#fff;color:#111;border-color:#bbb}.source-panel-stage{overflow:visible}.source-panel-stage>svg{min-width:0}.source-panel-heading>span{color:#444}.phase-story-layout{grid-template-columns:320px 1fr}.phase-story-card{background:#fff;border-color:#bbb;box-shadow:none}.phase-story-copy h4{color:#111}.phase-story-copy p,.phase-story-meta{color:#444}}
  ${sourceVisualCss}
  /* Source reports used breakpoint-specific HTML fallbacks and scroll-driven state.
     The public audit embeds the static SVG itself, so it must remain visible and legible
     without the source page's companion DOM or runtime controller. */
  .source-panel-stage>svg.desktop-diagram{display:block!important}
  .source-visual-panel[data-source-visual="zhikun-06"] .run-stage-map{display:block!important;max-height:none!important}
  .source-visual-panel[data-source-visual="zhikun-06"] .run-stage-map .stage-node{opacity:1!important;filter:none!important}
  .source-visual-panel[data-source-visual="zhikun-06"] .run-stage-map .stage-path{opacity:.68!important;stroke-width:2!important}
  .source-visual-panel:is(
    [data-source-visual="zhikun-14"],[data-source-visual="zhikun-15"],
    [data-source-visual="zhikun-16"],[data-source-visual="zhikun-17"],
    [data-source-visual="zhikun-18"],[data-source-visual="zhikun-19"],
    [data-source-visual="zhikun-20"],[data-source-visual="zhikun-21"]
  ) .log-node{filter:drop-shadow(0 0 9px rgba(67,216,235,.18))}
  .source-visual-panel:is(
    [data-source-visual="zhikun-14"],[data-source-visual="zhikun-15"],
    [data-source-visual="zhikun-16"],[data-source-visual="zhikun-17"],
    [data-source-visual="zhikun-18"],[data-source-visual="zhikun-19"],
    [data-source-visual="zhikun-20"],[data-source-visual="zhikun-21"]
  ) .source-node{opacity:.9}
  .source-visual-panel:is(
    [data-source-visual="zhikun-14"],[data-source-visual="zhikun-15"],
    [data-source-visual="zhikun-16"],[data-source-visual="zhikun-17"],
    [data-source-visual="zhikun-18"],[data-source-visual="zhikun-19"],
    [data-source-visual="zhikun-20"],[data-source-visual="zhikun-21"]
  ) .docs-node{opacity:.58;stroke-dasharray:7 6}
  .source-visual-panel:is(
    [data-source-visual="zhikun-14"],[data-source-visual="zhikun-15"],
    [data-source-visual="zhikun-16"],[data-source-visual="zhikun-17"],
    [data-source-visual="zhikun-18"],[data-source-visual="zhikun-19"],
    [data-source-visual="zhikun-20"],[data-source-visual="zhikun-21"]
  ) .manual-node{stroke-dasharray:5 5}
  .source-visual-panel:is(
    [data-source-visual="zhikun-14"],[data-source-visual="zhikun-15"],
    [data-source-visual="zhikun-16"],[data-source-visual="zhikun-17"],
    [data-source-visual="zhikun-18"],[data-source-visual="zhikun-19"],
    [data-source-visual="zhikun-20"],[data-source-visual="zhikun-21"]
  ) .error-node{filter:drop-shadow(0 0 8px rgba(250,115,136,.16))}
  .source-visual-panel:is(
    [data-source-visual="zhikun-14"],[data-source-visual="zhikun-15"],
    [data-source-visual="zhikun-16"],[data-source-visual="zhikun-17"],
    [data-source-visual="zhikun-18"],[data-source-visual="zhikun-19"],
    [data-source-visual="zhikun-20"],[data-source-visual="zhikun-21"]
  ) text[font-size="9"],.source-visual-panel:is(
    [data-source-visual="zhikun-14"],[data-source-visual="zhikun-15"],
    [data-source-visual="zhikun-16"],[data-source-visual="zhikun-17"],
    [data-source-visual="zhikun-18"],[data-source-visual="zhikun-19"],
    [data-source-visual="zhikun-20"],[data-source-visual="zhikun-21"]
  ) text[font-size="10"]{font-size:11px}
  .source-visual-panel:is(
    [data-source-visual="zhikun-14"],[data-source-visual="zhikun-15"],
    [data-source-visual="zhikun-16"],[data-source-visual="zhikun-17"],
    [data-source-visual="zhikun-18"],[data-source-visual="zhikun-19"],
    [data-source-visual="zhikun-20"],[data-source-visual="zhikun-21"]
  ) text[font-size="11"]{font-size:12px}
  .source-visual-panel[data-source-visual="zhikun-22"] .observed-node{filter:drop-shadow(0 0 10px rgba(67,216,235,.2))}
  .source-visual-panel[data-source-visual="zhikun-22"] .source-only-node{opacity:.92;stroke-dasharray:7 6}
  .source-visual-panel[data-source-visual="zhikun-22"] .docs-only-node{opacity:.82;stroke:#65708e;stroke-dasharray:4 7}
  .source-visual-panel[data-source-visual="zhikun-22"] g[data-evidence="source"] text{fill:#aeb8d0}
  .source-visual-panel[data-source-visual="zhikun-22"] g[data-evidence="docs"] text{fill:#929db9}
  .source-visual-panel:is([data-source-visual="zhikun-23"],[data-source-visual="zhikun-24"]) .observed-node{filter:drop-shadow(0 0 8px rgba(67,216,235,.15))}
  .source-visual-panel:is([data-source-visual="zhikun-23"],[data-source-visual="zhikun-24"]) .source-node{opacity:.88;stroke-dasharray:7 6}
  .source-visual-panel:is([data-source-visual="zhikun-23"],[data-source-visual="zhikun-24"]) .manual-node{stroke-dasharray:5 5}
  .source-visual-panel[data-source-visual="zhikun-12"] .cut-observed{filter:drop-shadow(0 0 8px rgba(67,216,235,.17))}
  .source-visual-panel[data-source-visual="zhikun-12"] .cut-source{opacity:.72}
  .source-visual-panel[data-source-visual="zhikun-12"] .cut-docs{opacity:.34;stroke-dasharray:7 7}
  .source-visual-panel:is(
    [data-source-visual="zhikun-07"],[data-source-visual="zhikun-10"],
    [data-source-visual="zhikun-11"]
  ) text[font-size="8"],.source-visual-panel:is(
    [data-source-visual="zhikun-07"],[data-source-visual="zhikun-10"],
    [data-source-visual="zhikun-11"]
  ) text[font-size="9"]{font-size:10px}
  .source-visual-panel:is(
    [data-source-visual="zhikun-07"],[data-source-visual="zhikun-10"],
    [data-source-visual="zhikun-11"]
  ) text[font-size="10"]{font-size:11px}
  .source-visual-panel:is([data-source-visual="zhikun-08"],[data-source-visual="zhikun-09"]) text[font-size="8"],
  .source-visual-panel:is([data-source-visual="zhikun-08"],[data-source-visual="zhikun-09"]) text[font-size="9"]{font-size:10.5px}
  .source-visual-panel:is([data-source-visual="zhikun-08"],[data-source-visual="zhikun-09"]) text[font-size="10"],
  .source-visual-panel:is([data-source-visual="zhikun-08"],[data-source-visual="zhikun-09"]) text[font-size="11"]{font-size:11.5px}
  .source-visual-panel[data-source-visual="zhikun-22"] text[font-size="8"]{font-size:9px}
  .source-visual-panel[data-source-visual="zhikun-22"] text[font-size="9"]{font-size:10px}
  .source-visual-panel[data-source-visual="zhikun-22"] text[font-size="10"]{font-size:11px}
  /* The comparison source's last visual-QA layer was scoped to body.technical-audit.
     Only its SVG semantics are reattached here; page-shell and navigation rules must
     not leak into the independently embedded source panels. */
  .source-visual-panel[data-source-family="comparison"] .audit-svg .node-zhikun{
    fill:#e4eef2;stroke:var(--system-paper-zhikun)
  }
  .source-visual-panel[data-source-family="comparison"] .audit-svg .node-codex{
    fill:#f5ead1;stroke:var(--system-paper-codex)
  }
  .source-visual-panel[data-source-family="comparison"] :is(.story-svg .state-ok,.product-screen-svg .ownership-ok){
    fill:var(--status-ok-soft);stroke:var(--status-ok)
  }
  .source-visual-panel[data-source-family="comparison"] :is(.story-svg .state-partial,.product-screen-svg .ownership-partial){
    fill:var(--status-partial-soft);stroke:var(--status-partial)
  }
  .source-visual-panel[data-source-family="comparison"] :is(.story-svg .state-bad,.product-screen-svg .ownership-bad){
    fill:var(--status-bad-soft);stroke:var(--status-bad)
  }
  .source-visual-panel[data-source-family="comparison"] :is(.story-svg .state-unknown,.product-screen-svg .ownership-unknown){
    fill:var(--status-unknown-soft);stroke:var(--status-unknown)
  }
  .source-visual-panel[data-source-family="comparison"] .story-svg .state-partial-text{fill:#ffc38b}
  .source-visual-panel[data-source-family="comparison"] .control-proof-svg .cp-panel-amber{
    fill:#2b211b;stroke:var(--status-partial)
  }
  .source-visual-panel[data-source-family="comparison"] .control-proof-svg .cp-warn{fill:var(--status-partial)}
`;

export const auditReportCss = `
  :root{
    color-scheme:dark;
    --bg:#060811;--panel:#0e1424;--panel-2:#111a2d;--panel-3:#151f34;
    --text:#f5f7ff;--muted:#abb4cf;--soft:#77829f;--line:#26324a;--line-strong:#354560;
    --cyan:#43d8eb;--blue:#5a95ff;--purple:#a77bff;--amber:#f6b94b;--green:#2dd4a8;--red:#fa7388;
    --zhikun:#43d8eb;--codex:#f6b94b;
    --sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
    --mono:"SFMono-Regular","Cascadia Code","Liberation Mono",Menlo,monospace;
  }
  *{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:76px}
  body{margin:0;background:
    radial-gradient(circle at 14% 0,rgba(67,216,235,.09),transparent 31rem),
    radial-gradient(circle at 91% 16%,rgba(167,123,255,.075),transparent 27rem),
    linear-gradient(rgba(90,149,255,.025) 1px,transparent 1px),
    linear-gradient(90deg,rgba(90,149,255,.025) 1px,transparent 1px),var(--bg);
    background-size:auto,auto,40px 40px,40px 40px;color:var(--text);font:15px/1.72 var(--sans)}
  a{color:#82b7ff;text-underline-offset:3px}a:focus-visible,.button:focus-visible{outline:3px solid var(--cyan);outline-offset:3px}
  code,time,.mono{font-family:var(--mono)}code{font-size:.86em;overflow-wrap:anywhere;color:#d8e4ff}
  .shell{width:min(1240px,calc(100% - 48px));margin:auto}
  .hero{position:relative;isolation:isolate;overflow:hidden;padding:88px 0 72px;border-bottom:1px solid var(--line);background:linear-gradient(145deg,rgba(12,17,31,.96),rgba(7,10,20,.98))}
  .hero::before{content:"";position:absolute;z-index:-1;inset:0;background:
    linear-gradient(115deg,rgba(67,216,235,.08),transparent 28%,transparent 70%,rgba(246,185,75,.055)),
    repeating-linear-gradient(90deg,transparent 0 79px,rgba(255,255,255,.018) 80px),
    repeating-linear-gradient(0deg,transparent 0 79px,rgba(255,255,255,.018) 80px)}
  .hero::after{content:"";position:absolute;right:-170px;top:-280px;width:720px;height:720px;border:1px solid rgba(67,216,235,.2);border-radius:50%;box-shadow:0 0 0 90px rgba(90,149,255,.025),0 0 0 180px rgba(167,123,255,.018)}
  .hero-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(330px,.45fr);gap:70px;align-items:end}
  .eyebrow,.kicker{font:700 11px/1.3 var(--mono);letter-spacing:.16em;text-transform:uppercase}
  .eyebrow{display:flex;align-items:center;gap:12px;color:var(--cyan)}.eyebrow::before{content:"";width:28px;height:2px;background:var(--cyan);box-shadow:0 0 16px var(--cyan)}
  .hero h1{max-width:910px;margin:20px 0 25px;font-size:clamp(45px,5.7vw,76px);line-height:1.04;letter-spacing:-.052em}
  .hero .lead{max-width:880px;margin:0;color:#c2cae0;font-size:clamp(17px,1.8vw,21px)}
  .meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:32px}.meta span{padding:7px 11px;border:1px solid var(--line-strong);border-radius:999px;background:rgba(255,255,255,.025);color:#d2d8e8;font:11px/1 var(--mono)}
  .audit-plate{position:relative;padding:27px;border:1px solid #33425c;border-radius:4px 24px 4px 24px;background:linear-gradient(145deg,rgba(25,35,58,.9),rgba(10,15,28,.86));box-shadow:inset 0 1px rgba(255,255,255,.06),0 28px 70px rgba(0,0,0,.28)}
  .audit-plate::before{content:"AUDIT / CASE 01";position:absolute;right:18px;top:17px;color:#687593;font:700 9px var(--mono);letter-spacing:.13em}.audit-plate h2{margin:0 0 21px;font-size:15px}
  .plate-row{display:grid;grid-template-columns:1fr auto;gap:12px;padding:15px 0;border-top:1px solid var(--line)}.plate-row small{display:block;color:#8792ac}.plate-row strong{font:700 14px var(--mono);color:var(--cyan)}
  .plate-note{margin:16px 0 0;padding-top:15px;border-top:1px solid var(--line);color:#8994ae;font-size:12px}
  .nav{position:sticky;top:0;z-index:20;border-bottom:1px solid var(--line);background:rgba(6,8,17,.91);backdrop-filter:blur(16px)}
  .nav-inner{display:flex;gap:3px;overflow:auto;padding:9px 0;scrollbar-width:thin}.nav a{flex:0 0 auto;padding:8px 10px;border-radius:6px;color:#9ba6bf;text-decoration:none;font:650 10px var(--mono)}.nav a:hover{background:rgba(67,216,235,.08);color:var(--cyan)}
  .report-nav .nav-inner>a{position:relative;transition:color .18s ease,background-color .18s ease,box-shadow .18s ease}
  .report-nav .nav-inner>a[aria-current="location"]{color:#eafcff;background:rgba(67,216,235,.1);box-shadow:inset 0 -2px var(--cyan)}
  main{padding:66px 0 110px}section{position:relative;margin-bottom:104px}
  .section-head{display:grid;grid-template-columns:178px minmax(0,1fr);gap:34px;margin-bottom:30px;padding-bottom:22px;border-bottom:1px solid var(--line)}
  .kicker{display:inline-flex;width:max-content;padding:7px 9px;border:1px solid rgba(67,216,235,.3);border-radius:4px;background:rgba(67,216,235,.06);color:var(--cyan)}
  .section-head h2{margin:0;font-size:clamp(31px,3.7vw,48px);line-height:1.12;letter-spacing:-.04em}.section-head p{max-width:900px;margin:10px 0 0;color:var(--muted)}
  .panel,.question-card,.evidence-card,.shot,.disclosure{border:1px solid var(--line);background:linear-gradient(180deg,rgba(17,25,43,.96),rgba(11,16,30,.96));border-radius:15px;box-shadow:0 18px 50px rgba(0,0,0,.18)}
  .summary-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:18px}.prompt{padding:27px}.prompt blockquote{margin:18px 0 0;padding:21px 23px;border:0;border-left:4px solid var(--cyan);border-radius:0 10px 10px 0;background:rgba(67,216,235,.055);font-size:17px}
  .summary-side{display:grid;gap:14px}.fact-box{padding:22px;border-left:3px solid var(--line-strong)}.fact-box:first-child{border-left-color:var(--zhikun)}.fact-box:nth-child(2){border-left-color:var(--codex)}.fact-box:last-child{border-left-color:var(--green)}.fact-box h3{margin:0 0 7px}.fact-box p{margin:0;color:var(--muted)}
  .finding-grid,.boundary-grid{display:grid;gap:13px;margin-top:18px}.finding-grid{grid-template-columns:repeat(3,1fr)}.boundary-grid{grid-template-columns:repeat(4,1fr)}
  .finding,.boundary{padding:20px}.finding{border-left:3px solid}.finding.verified{border-left-color:var(--green)}.finding.limit{border-left-color:var(--amber)}.finding b{display:block;margin-bottom:6px}.finding p,.boundary p{margin:0;color:var(--muted);font-size:13px}.boundary .num{color:var(--cyan);font:700 11px var(--mono)}.boundary h3{margin:9px 0 7px;font-size:16px}
  .notice{margin-top:18px;padding:20px 22px;border-left:3px solid var(--amber);border-radius:0 12px 12px 0;background:linear-gradient(90deg,rgba(246,185,75,.1),rgba(246,185,75,.025));box-shadow:inset 0 0 0 1px rgba(246,185,75,.1)}.notice strong{color:#ffd47c}.notice p{margin:6px 0 0;color:#c2cae0}
  .table-wrap{overflow:auto;border:1px solid var(--line);border-radius:14px;background:#0b111f;box-shadow:0 16px 40px rgba(0,0,0,.15)}table{width:100%;min-width:850px;border-collapse:collapse}th,td{padding:15px 16px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}thead th{background:#151f34;color:#dbe2f1;font:650 10px var(--mono);letter-spacing:.05em;text-transform:uppercase}tbody tr:nth-child(even){background:rgba(255,255,255,.012)}tbody tr:hover{background:rgba(90,149,255,.035)}tbody th{width:180px;color:#e2e7f2}td p,th p{margin:5px 0 0;color:var(--muted);font-size:13px}th small{display:block;color:var(--soft);font-weight:400}
  .event-order{display:inline-grid;place-items:center;width:31px;height:31px;border:1px solid rgba(67,216,235,.35);border-radius:50%;background:rgba(67,216,235,.07);color:var(--cyan);font:700 10px var(--mono)}
  .subsection{margin-top:40px}.subsection>h3{display:flex;align-items:center;gap:11px;margin:0 0 9px;font-size:23px}.subsection>h3::before{content:"";width:22px;height:3px;background:var(--cyan);box-shadow:0 0 12px rgba(67,216,235,.45)}.subsection>p{margin:0 0 16px;color:var(--muted)}
  .question-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:0;padding:0;list-style:none}.question-card{position:relative;padding:20px;overflow:hidden}.question-card::before{content:"";position:absolute;inset:0 auto 0 0;width:3px;background:var(--cyan)}.boundary-card::before{background:var(--amber)}.question-card header{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:start}.question-card ul{display:grid;gap:8px;margin:15px 0 0;padding:0;list-style:none}.question-card ul>li{padding:10px 12px;border-left:2px solid #384965;background:rgba(255,255,255,.025)}.question-card ul>li b,.question-card ul>li span{display:block}.question-card ul>li span{color:var(--muted);font-size:12px}.boundary-card p{color:var(--muted);font-size:12px}
  .mechanism-legend,.legend-row{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 15px}
  .capability header{display:flex;justify-content:space-between;gap:12px}.capability h3{margin:0}.capability dl{display:grid;gap:9px}.capability dl div{display:grid;grid-template-columns:72px 1fr;gap:10px;padding-top:9px;border-top:1px solid var(--line)}dt{font-weight:700;color:#bdc6d9}dd{margin:0}.capability dd{color:var(--muted);font-size:13px}
  .status,.system-tag,.data-status{display:inline-flex;align-items:center;border-radius:999px;padding:4px 8px;font:700 10px/1 var(--mono);white-space:nowrap}.status.verified{color:var(--green);background:rgba(45,212,168,.08)}.status.limited{color:var(--amber);background:rgba(246,185,75,.08)}.status.failed{color:var(--red);background:rgba(250,115,136,.08)}.status.grade{color:#b9c4dc;background:rgba(167,123,255,.09)}.system-tag.zhikun{color:var(--zhikun);background:rgba(67,216,235,.08);border:1px solid rgba(67,216,235,.24)}.system-tag.codex{color:var(--codex);background:rgba(246,185,75,.08);border:1px solid rgba(246,185,75,.24)}
  .data-status{margin-bottom:9px;border:1px solid currentColor}.status-dynamic-public{color:var(--green)}.status-derived-estimate,.status-different-instrument{color:var(--amber)}.status-static-snapshot,.status-verification-only{color:var(--purple)}.status-missing{color:var(--red)}.matrix-details{display:grid;gap:5px;margin:0}.matrix-details div{display:grid;grid-template-columns:46px 1fr;gap:7px;padding-bottom:4px;border-bottom:1px dashed var(--line);font-size:11px}.matrix-details dt{color:#7f8ba5}.data-matrix td{min-width:350px}
  .pressure-label{display:flex;justify-content:space-between;margin-bottom:6px;color:#cad2e2;font:700 10px var(--mono)}.pressure-scale{height:6px;margin-bottom:9px;overflow:hidden;border-radius:99px;background:#202a3d}.pressure-scale i{display:block;height:100%;background:linear-gradient(90deg,var(--cyan),var(--amber))}
  .evidence-ref{display:inline-block;margin:2px;padding:2px 5px;border:1px solid rgba(90,149,255,.34);border-radius:5px;background:rgba(90,149,255,.07);color:#8bbcff;font:700 9px var(--mono);text-decoration:none}.evidence-ref:hover{background:rgba(90,149,255,.15)}
  .gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.shot{margin:0;overflow:hidden}.shot-frame{height:620px;overflow:auto;background:#05070d}.shot-frame.short{height:auto}.shot img{display:block;width:100%;height:auto}.shot figcaption{padding:16px 18px;border-top:1px solid var(--line)}.shot figcaption strong,.shot figcaption span{display:block}.shot figcaption span,.shot-note{color:var(--muted);font-size:12px}.shot-note{grid-column:1/-1}
  .score-summary{display:grid;grid-template-columns:1fr 1fr .8fr;gap:14px;margin-bottom:18px}.score-panel{padding:22px}.score-panel .score{font:750 42px/1 var(--mono)}.score-panel small{display:block;margin-top:8px;color:var(--muted)}.score-panel.zhikun{border-top:4px solid var(--zhikun)}.score-panel.codex{border-top:4px solid var(--codex)}.formula{padding:22px;border:1px solid var(--line);border-radius:15px;background:#111a2d}.formula code{display:block;margin-bottom:8px;color:var(--cyan)}.formula span{color:var(--muted);font-size:12px}
  .score-table td{min-width:310px}.score-cell{display:flex;align-items:center;gap:12px}.score-cell b{width:34px;color:var(--zhikun);font:700 14px var(--mono)}.score-cell.codex b{color:var(--codex)}.meter{display:block;height:7px;flex:1;overflow:hidden;border-radius:99px;background:#202a3d}.meter i{display:block;height:100%;background:var(--zhikun)}.score-cell.codex .meter i{background:var(--codex)}.delta{font:700 12px var(--mono)}.delta.zhikun{color:var(--zhikun)}.delta.codex{color:var(--codex)}
  .runtime-check{margin-top:16px;padding:18px 20px;border:1px dashed #40506d;border-radius:12px;background:rgba(90,149,255,.035)}.runtime-check strong{display:block}.runtime-check span{color:var(--muted)}
  .evidence-tools{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:18px}.evidence-tools p{margin:0;color:var(--muted)}.button{display:inline-flex;padding:9px 12px;border:1px solid #42516c;border-radius:8px;background:#131c30;color:#dbe2f2;text-decoration:none;font-weight:700;font-size:12px}.button:hover{border-color:var(--cyan)}
  .evidence-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.evidence-card{position:relative;padding:20px;scroll-margin-top:90px;overflow:hidden}.evidence-card::before{content:"";position:absolute;inset:0 auto 0 0;width:3px;background:#50678a}.evidence-card:target{outline:3px solid var(--cyan)}.evidence-card header{display:flex;justify-content:space-between;gap:12px}.evidence-badges{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px}.evidence-id{color:var(--cyan);font:750 12px var(--mono)}.legacy-id{margin-left:7px;color:#6f7b96;font:10px var(--mono)}.evidence-card h3{margin:12px 0 7px;font-size:16px}.evidence-card>p{margin:0 0 13px;color:var(--muted);font-size:13px}.evidence-card dl{display:grid;gap:4px;margin:0}.evidence-card dl div{display:grid;grid-template-columns:90px 1fr;gap:8px;padding:3px 0;border-bottom:1px dashed var(--line);font-size:11px}.evidence-card dt{color:#7d89a3}.evidence-card dd{overflow-wrap:anywhere}.private-source{color:var(--amber)}.redaction{padding-top:9px;border-top:1px dashed var(--line);color:var(--amber)!important}
  .hashes code{font-size:10px}.limitations{columns:2;gap:34px}.limitations li{break-inside:avoid;margin-bottom:11px}.disclosure{margin-top:20px;padding:22px}
  footer{padding:34px 0;border-top:1px solid var(--line);background:#070a13;color:#9ca7be}.footer-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}.footer-grid p{margin:0}
  @media(max-width:900px){.shell{width:min(100% - 30px,1240px)}.hero{padding:62px 0 52px}.hero-grid,.summary-grid,.section-head,.footer-grid{grid-template-columns:1fr}.finding-grid,.boundary-grid{grid-template-columns:repeat(2,1fr)}.gallery,.evidence-grid,.question-list{grid-template-columns:1fr}.score-summary{grid-template-columns:1fr}.section-head{gap:10px}.shot-note{grid-column:auto}.limitations{columns:1}}
  @media(max-width:580px){.shell{width:min(100% - 22px,1240px)}.hero h1{font-size:39px}.hero .lead{font-size:16px}.meta span{font-size:10px}main{padding-top:46px}section{margin-bottom:76px}.finding-grid,.boundary-grid{grid-template-columns:1fr}.question-card header{grid-template-columns:auto 1fr}.question-card header .status{grid-column:2}.evidence-tools{align-items:flex-start;flex-direction:column}.evidence-card header{flex-direction:column}.evidence-badges{justify-content:flex-start}.shot-frame{height:480px}}
  @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
  @media print{
    @page{size:A4;margin:12mm}:root{color-scheme:light}body{background:#fff;color:#111;font-size:10pt}.shell{width:100%}.hero{padding:0 0 20px;background:#fff;color:#111}.hero::before,.hero::after{display:none}.hero .lead,.plate-note{color:#444}.audit-plate,.panel,.question-card,.evidence-card,.shot,.disclosure,.table-wrap{background:#fff;color:#111;border-color:#bbb;box-shadow:none}.audit-plate h2,.plate-row strong{color:#111}.nav{display:none}main{padding:20px 0}section{margin-bottom:34px}.section-head h2,.fact-box h3,.evidence-card h3{color:#111}.section-head p,.fact-box p,.evidence-card>p{color:#444}.shot-frame{height:auto;overflow:visible;background:#fff}.gallery,.evidence-grid{grid-template-columns:1fr 1fr}.evidence-grid{font-size:8pt}.evidence-tools .button{display:none}a{color:#111;text-decoration:none}.limitations{columns:2}footer{background:#fff;color:#333;border-top:1px solid #bbb}
  }
`;
