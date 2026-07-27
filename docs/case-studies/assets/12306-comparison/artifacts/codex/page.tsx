"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const stages = [
  {
    id: "01",
    time: "T+000 ms",
    kicker: "INVENTORY EVENT",
    title: "一个席位回来了",
    desc: "退票、改签释放，或动态票额调整产生新的可售区间。库存事件进入候补兑现链路。",
    system: "余票 / 票额服务",
    event: "SEAT_RELEASED",
    color: "mint",
  },
  {
    id: "02",
    time: "T+018 ms",
    kicker: "EVENT ROUTING",
    title: "事件被可靠地送进队列",
    desc: "按车次、日期、席别与区间分区，让同一库存域的事件保持可控顺序并能重试。",
    system: "事件总线",
    event: "partition = G103:07-26:2ND",
    color: "cyan",
  },
  {
    id: "03",
    time: "T+041 ms",
    kicker: "ELIGIBILITY",
    title: "先筛掉不可能兑现的请求",
    desc: "校验候补截止时间、实名状态、行程冲突、乘车人约束与预付款有效性。",
    system: "资格 / 风控服务",
    event: "ELIGIBLE = TRUE",
    color: "violet",
  },
  {
    id: "04",
    time: "T+076 ms",
    kicker: "QUEUE RANKING",
    title: "在可匹配队列中确定次序",
    desc: "公开规则明确候补按订单生效时间顺序兑现；工程上还需在候选组合间做确定性排序。",
    system: "候补队列",
    event: "rank → #000128",
    color: "amber",
  },
  {
    id: "05",
    time: "T+109 ms",
    kicker: "INTERVAL MATCH",
    title: "席位不是一张票，而是一段区间",
    desc: "只有该席位在北京南→南京南的所有运行区段都空闲，才构成一次合法匹配。",
    system: "席位图 / 区间匹配",
    event: "mask & occupied = 0",
    color: "cyan",
  },
  {
    id: "06",
    time: "T+136 ms",
    kicker: "ATOMIC RESERVE",
    title: "用原子操作锁住这一个席位",
    desc: "带版本号更新库存；只有一个请求能把 FREE 改为 HELD，其他并发请求立即失败重算。",
    system: "库存事务服务",
    event: "CAS(v42 → v43) ✓",
    color: "mint",
  },
  {
    id: "07",
    time: "T+171 ms",
    kicker: "ORDER COMMIT",
    title: "候补单转成已支付订单",
    desc: "生成正式客票订单，关联乘车人、席位与电子客票；用事务消息保证订单与后续动作一致。",
    system: "订单 / 电子客票",
    event: "ORDER_CONFIRMED",
    color: "violet",
  },
  {
    id: "08",
    time: "T+224 ms",
    kicker: "MONEY SETTLEMENT",
    title: "预付款完成结算",
    desc: "实际票价从候补预付款中结算；若有差额则进入原支付渠道退款流程。",
    system: "支付 / 清结算",
    event: "¥553.00 → SETTLED",
    color: "amber",
  },
  {
    id: "09",
    time: "T+310 ms",
    kicker: "FAN-OUT",
    title: "成功状态向外扩散",
    desc: "缓存失效、订单查询更新、短信/应用通知投递；失败的通知可独立重试，不回滚车票。",
    system: "通知 / 查询服务",
    event: "PUSH DELIVERED",
    color: "cyan",
  },
  {
    id: "10",
    time: "T+∞",
    kicker: "OBSERVABILITY",
    title: "每一步都留下可追溯证据",
    desc: "链路追踪、审计日志、指标告警与对账任务持续检查：不能多卖，也不能少记。",
    system: "监控 / 审计平台",
    event: "TRACE CLOSED",
    color: "mint",
  },
];

const logLines = [
  ["14:32:08.001", "inventory", "seat 07-12F released", "mint"],
  ["14:32:08.019", "event-bus", "partition offset +1", "cyan"],
  ["14:32:08.042", "eligibility", "identity & time-window pass", "violet"],
  ["14:32:08.077", "queue", "128 candidates scanned", "amber"],
  ["14:32:08.110", "matcher", "segment mask 01110 hit", "cyan"],
  ["14:32:08.137", "inventory", "compare-and-swap success", "mint"],
  ["14:32:08.172", "order", "E-ticket committed", "violet"],
  ["14:32:08.225", "payment", "preauth captured ¥553", "amber"],
  ["14:32:08.311", "notify", "app push accepted", "cyan"],
  ["14:32:08.386", "audit", "trace integrity verified", "mint"],
];

const architecture = [
  { label: "12306 App / Web", sub: "查询 · 候补 · 订单状态", type: "edge" },
  { label: "接入与流量层", sub: "网关 · 限流 · 鉴权 · 风控", type: "gateway" },
  { label: "候补兑现域", sub: "规则引擎 · 分区队列 · 区间匹配", type: "core" },
  { label: "客票交易域", sub: "余票 · 席位 · 订单 · 电子客票", type: "transaction" },
  { label: "资金与触达域", sub: "预付款 · 退款 · 短信 · Push", type: "outbound" },
  { label: "数据与保障层", sub: "数据库 · 缓存 · 消息 · 审计 · 容灾", type: "data" },
];

function NetworkCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let width = 0;
    let height = 0;
    let nodes: { x: number; y: number; vx: number; vy: number; r: number }[] = [];

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      nodes = Array.from({ length: Math.max(24, Math.floor(width / 44)) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: Math.random() * 1.4 + 0.6,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const accent = getComputedStyle(document.documentElement)
        .getPropertyValue("--glow-rgb")
        .trim() || "88, 242, 199";
      nodes.forEach((node, i) => {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${accent}, .55)`;
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fill();
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = node.x - nodes[j].x;
          const dy = node.y - nodes[j].y;
          const distance = Math.hypot(dx, dy);
          if (distance < 115) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${accent}, ${0.12 * (1 - distance / 115)})`;
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      });
      frame = requestAnimationFrame(draw);
    };
    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas className="network-canvas" ref={ref} aria-hidden="true" />;
}

function AppIcon() {
  return (
    <div className="app-icon" aria-hidden="true">
      <span className="rail rail-a" />
      <span className="rail rail-b" />
      <span className="rail-spark" />
    </div>
  );
}

export default function Home() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [formula, setFormula] = useState(0);
  const stage = stages[active];
  const visibleLogs = useMemo(() => logLines.slice(0, active + 1), [active]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setActive((value) => (value + 1) % stages.length);
    }, 2100 / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFormula((value) => (value + 1) % 4);
    }, 3600);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main>
      <section className="hero">
        <NetworkCanvas />
        <nav className="nav shell">
          <a className="brand" href="#top" aria-label="返回顶部">
            <AppIcon />
            <span>
              <b>兑现时刻</b>
              <small>WAITLIST / 12306</small>
            </span>
          </a>
          <div className="nav-links">
            <a href="#journey">后台旅程</a>
            <a href="#math">数学原理</a>
            <a href="#architecture">系统架构</a>
          </div>
          <a className="source-button" href="#sources">公开信息说明 ↗</a>
        </nav>

        <div className="hero-content shell" id="top">
          <div className="eyebrow">
            <span className="live-dot" />
            REAL-TIME SYSTEM RECONSTRUCTION
          </div>
          <h1>
            你候补成功的那一刻，
            <br />
            <em>后台发送了什么？</em>
          </h1>
          <p className="hero-lede">
            一张突然释放的票，穿过事件流、优先队列、区间匹配和分布式事务，
            在几百毫秒内变成你手机上的那条「兑现成功」。
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#journey">
              <span>▶</span> 开始一次兑现
            </a>
            <div className="hero-stat">
              <span>候补逻辑</span>
              <strong>10 个关键阶段</strong>
            </div>
            <div className="hero-stat">
              <span>观察维度</span>
              <strong>事件 · 数学 · 架构</strong>
            </div>
          </div>
        </div>

        <div className="signal-deck shell" aria-hidden="true">
          <div className="train-line">
            {["北京南", "济南西", "徐州东", "南京南", "上海虹桥"].map(
              (station, index) => (
                <div className="station" key={station}>
                  <span className={index <= active % 5 ? "passed" : ""} />
                  <small>{station}</small>
                </div>
              ),
            )}
          </div>
          <div className="pulse-readout">
            <span>EVENT PULSE</span>
            <div className="pulse-line" />
            <b>{String(active + 1).padStart(2, "0")}/10</b>
          </div>
        </div>
      </section>

      <section className="journey-section" id="journey">
        <div className="shell">
          <div className="section-heading">
            <div>
              <span className="section-index">01 / BACKSTAGE JOURNEY</span>
              <h2>一次候补兑现的全链路</h2>
            </div>
            <p>
              自动播放正在模拟一条候补成功链路。点击任意节点，可查看该阶段的消息和系统动作。
            </p>
          </div>

          <div className="simulator">
            <div className="sim-topbar">
              <div className="sim-status">
                <span className={playing ? "status-light active" : "status-light"} />
                <b>{playing ? "LIVE SIMULATION" : "SIMULATION PAUSED"}</b>
                <span>TRACE ID · HB-7F2A-9C01</span>
              </div>
              <div className="sim-controls">
                <button
                  type="button"
                  onClick={() => setPlaying((value) => !value)}
                  aria-label={playing ? "暂停模拟" : "继续模拟"}
                >
                  {playing ? "Ⅱ" : "▶"}
                </button>
                {[0.5, 1, 2].map((value) => (
                  <button
                    type="button"
                    className={speed === value ? "selected" : ""}
                    onClick={() => setSpeed(value)}
                    key={value}
                  >
                    {value}×
                  </button>
                ))}
              </div>
            </div>

            <div className="sim-body">
              <aside className="stage-rail" aria-label="兑现阶段">
                <div className="rail-progress">
                  <span style={{ height: `${(active / (stages.length - 1)) * 100}%` }} />
                </div>
                {stages.map((item, index) => (
                  <button
                    type="button"
                    className={`stage-button ${index === active ? "active" : ""} ${index < active ? "done" : ""}`}
                    onClick={() => {
                      setActive(index);
                      setPlaying(false);
                    }}
                    key={item.id}
                  >
                    <span className="stage-number">{index < active ? "✓" : item.id}</span>
                    <span>
                      <b>{item.system}</b>
                      <small>{item.kicker}</small>
                    </span>
                  </button>
                ))}
              </aside>

              <div className="stage-visual">
                <div className="stage-meta">
                  <span>{stage.time}</span>
                  <span className={`color-${stage.color}`}>{stage.kicker}</span>
                </div>
                <div className="event-orbit" key={active}>
                  <div className={`orbit-ring ring-one color-${stage.color}`} />
                  <div className={`orbit-ring ring-two color-${stage.color}`} />
                  <div className="event-core">
                    <span>{stage.id}</span>
                    <b>{stage.event}</b>
                  </div>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <span
                      className={`orbit-particle particle-${index + 1}`}
                      key={index}
                    />
                  ))}
                </div>
                <div className="stage-copy">
                  <span className={`stage-chip color-${stage.color}`}>{stage.system}</span>
                  <h3>{stage.title}</h3>
                  <p>{stage.desc}</p>
                </div>

                <div className="seat-strip">
                  <div className="seat-strip-label">
                    <span>07车 12F · 区间占用向量</span>
                    <code>{active < 5 ? "0 1 1 1 0" : "0 1 1 1 0 → LOCKED"}</code>
                  </div>
                  <div className="segment-grid">
                    {[0, 1, 2, 3].map((segment) => (
                      <div
                        className={`${segment >= 1 && segment <= 2 ? "occupied" : ""} ${active >= 5 ? "matched" : ""}`}
                        key={segment}
                      >
                        <span />
                      </div>
                    ))}
                  </div>
                  <div className="segment-labels">
                    {["京→济", "济→徐", "徐→宁", "宁→沪"].map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="event-console">
                <div className="console-heading">
                  <span>EVENT STREAM</span>
                  <i />
                  <b>{visibleLogs.length} msgs</b>
                </div>
                <div className="console-lines">
                  {visibleLogs.map((line, index) => (
                    <div className="console-line" key={line[0]}>
                      <span>{line[0]}</span>
                      <b className={`color-${line[3]}`}>{line[1]}</b>
                      <code>{line[2]}</code>
                      <i className={index === visibleLogs.length - 1 ? "latest" : ""} />
                    </div>
                  ))}
                </div>
                <div className="console-foot">
                  <span>END-TO-END</span>
                  <b>{active === 9 ? "386 ms" : stage.time.replace("T+", "")}</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="math-section" id="math">
        <div className="shell">
          <div className="section-heading inverse">
            <div>
              <span className="section-index">02 / THE MATH INSIDE</span>
              <h2>把“有票”变成可计算的问题</h2>
            </div>
            <p>
              真正困难的不是找到一张空椅子，而是在海量并发请求中，快速找到区间兼容、次序正确且只能成功一次的解。
            </p>
          </div>

          <div className="formula-stage">
            <div className="formula-tabs" role="tablist" aria-label="数学原理">
              {[
                "区间位图",
                "稳定优先队列",
                "成功概率",
                "乐观并发控制",
              ].map((label, index) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={formula === index}
                  className={formula === index ? "active" : ""}
                  onClick={() => setFormula(index)}
                  key={label}
                >
                  <span>0{index + 1}</span>
                  {label}
                </button>
              ))}
            </div>

            <div className="formula-panel">
              {formula === 0 && (
                <div className="formula-content">
                  <span className="formula-tag">BITMASK / INTERVAL ALGEBRA</span>
                  <h3>一次按位与，判断整段旅程是否冲突</h3>
                  <div className="big-formula">
                    <span>M<sub>request</sub></span>
                    <b>&amp;</b>
                    <span>M<sub>occupied</sub></span>
                    <b>=</b>
                    <em>0</em>
                  </div>
                  <div className="bit-demo">
                    <div>
                      <label>请求：北京南 → 南京南</label>
                      <code><i>1</i><i>1</i><i>1</i><i>0</i></code>
                    </div>
                    <div>
                      <label>当前占用：南京南 → 上海虹桥</label>
                      <code><i>0</i><i>0</i><i>0</i><i className="hot">1</i></code>
                    </div>
                    <div className="bit-result">
                      <label>AND：无区间重叠</label>
                      <code><i>0</i><i>0</i><i>0</i><i>0</i></code>
                      <b>可复用同一席位 ✓</b>
                    </div>
                  </div>
                </div>
              )}
              {formula === 1 && (
                <div className="formula-content">
                  <span className="formula-tag">STABLE PRIORITY QUEUE</span>
                  <h3>先来先兑现，需要一个永远可复现的顺序</h3>
                  <div className="big-formula compact">
                    <span>key(i)</span>
                    <b>=</b>
                    <span>(t<sub>effective</sub>, id<sub>order</sub>)</span>
                  </div>
                  <div className="queue-demo">
                    {[
                      ["#127", "14:02:01.001", "不匹配此区间"],
                      ["#128", "14:02:01.083", "命中 · 正在锁票"],
                      ["#129", "14:02:01.083", "稳定次序等待"],
                      ["#130", "14:02:01.240", "等待"],
                    ].map((row, index) => (
                      <div className={index === 1 ? "winner" : ""} key={row[0]}>
                        <b>{row[0]}</b>
                        <code>{row[1]}</code>
                        <span>{row[2]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {formula === 2 && (
                <div className="formula-content">
                  <span className="formula-tag">CONDITIONAL PROBABILITY</span>
                  <h3>候补成功率，是不断被新事件更新的条件概率</h3>
                  <div className="big-formula probability">
                    <span>P(success | q, λ, μ, Δt)</span>
                  </div>
                  <div className="prob-chart">
                    {[28, 36, 43, 55, 62, 71, 79, 84].map((value, index) => (
                      <div key={value}>
                        <span style={{ height: `${value}%` }} />
                        <i style={{ bottom: `${value}%` }}>{value}%</i>
                        <small>{index + 1}×</small>
                      </div>
                    ))}
                  </div>
                  <p className="chart-note">
                    示意：增加可接受的“日期 × 车次 × 席别”组合，相当于增加独立或弱相关的兑现机会；并不保证成功。
                  </p>
                </div>
              )}
              {formula === 3 && (
                <div className="formula-content">
                  <span className="formula-tag">OPTIMISTIC CONCURRENCY CONTROL</span>
                  <h3>一张票面对万人并发，只允许一个事务获胜</h3>
                  <div className="big-formula compact">
                    <span>UPDATE seat</span>
                    <b>IF</b>
                    <span>version = 42</span>
                    <b>→</b>
                    <em>43</em>
                  </div>
                  <div className="race-demo">
                    <div className="race-source">席位 07-12F · v42</div>
                    <div className="race-lines">
                      <span className="race-win">事务 A · COMMIT</span>
                      <span>事务 B · RETRY</span>
                      <span>事务 C · RETRY</span>
                    </div>
                    <div className="race-target">唯一订单 · v43 ✓</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="principle-grid">
            <article>
              <span>O(log n)</span>
              <h3>队列调度</h3>
              <p>用堆或有序集合维护稳定优先级，避免每次从头扫描全部订单。</p>
            </article>
            <article>
              <span>Idempotency</span>
              <h3>幂等重试</h3>
              <p>同一事件重复到达也只产生一张票，网络超时不会制造重复订单。</p>
            </article>
            <article>
              <span>Saga / Outbox</span>
              <h3>最终一致性</h3>
              <p>订单先可信落库，再可靠驱动清算与通知；失败动作可以补偿与重放。</p>
            </article>
          </div>
        </div>
      </section>

      <section className="architecture-section" id="architecture">
        <div className="shell">
          <div className="section-heading">
            <div>
              <span className="section-index">03 / SYSTEM ARCHITECTURE</span>
              <h2>一条消息，穿过六层系统</h2>
            </div>
            <p>
              这是基于公开规则与大型票务系统通用模式的概念架构；真实生产拓扑、服务名和内部策略并未公开。
            </p>
          </div>

          <div className="architecture-map">
            <div className="packet packet-a" />
            <div className="packet packet-b" />
            <div className="packet packet-c" />
            {architecture.map((layer, index) => (
              <div className={`architecture-row ${layer.type}`} key={layer.label}>
                <span className="layer-index">L{index + 1}</span>
                <div className="layer-title">
                  <b>{layer.label}</b>
                  <span>{layer.sub}</span>
                </div>
                <div className="layer-nodes">
                  {Array.from({ length: index === 2 || index === 3 ? 5 : 3 }).map(
                    (_, nodeIndex) => (
                      <i key={nodeIndex}>
                        <span />
                      </i>
                    ),
                  )}
                </div>
                <code>
                  {["HTTPS", "TOKEN", "EVENT", "TXN", "ASYNC", "REPLICA"][index]}
                </code>
              </div>
            ))}
            <div className="architecture-spine">
              <span>request</span>
              <i />
              <span>commit</span>
            </div>
          </div>

          <div className="architecture-notes">
            <div>
              <span>强一致边界</span>
              <b>席位库存 ↔ 订单核心</b>
              <p>最关键的小范围事务边界，目标是“绝不超卖”。</p>
            </div>
            <div>
              <span>最终一致边界</span>
              <b>支付差额 · 通知 · 查询缓存</b>
              <p>允许短暂延迟，通过消息、重试与对账收敛。</p>
            </div>
            <div>
              <span>高可用边界</span>
              <b>多副本 · 熔断 · 降级 · 容灾</b>
              <p>局部故障不应让已锁定的席位与订单失联。</p>
            </div>
          </div>
        </div>
      </section>

      <section className="finale">
        <div className="shell finale-inner">
          <div className="success-badge">
            <span>✓</span>
          </div>
          <div>
            <span className="section-index">THE MOMENT OF SUCCESS</span>
            <h2>手机亮起时，最难的事已经发生了。</h2>
            <p>
              你看到的是一句“候补兑现成功”；后台刚完成的是一次跨队列、区间、库存、订单、资金与消息系统的协作。
            </p>
          </div>
          <div className="ticket">
            <span>候补兑现成功</span>
            <b>G103 · 07车 12F</b>
            <small>北京南 → 上海虹桥</small>
            <i />
            <code>ORDER · E7F2A9C01</code>
          </div>
        </div>
      </section>

      <footer id="sources">
        <div className="shell footer-grid">
          <div className="footer-brand">
            <AppIcon />
            <div>
              <b>兑现时刻</b>
              <span>一个关于系统如何协作的动态解释</span>
            </div>
          </div>
          <div>
            <b>公开事实锚点</b>
            <a
              href="https://www.beijing.gov.cn/fuwu/bmfw/sy/jrts/202604/t20260430_4629701.html"
              target="_blank"
              rel="noreferrer"
            >
              中国铁路候补购票十问十答 ↗
            </a>
            <a
              href="https://www.beijing.gov.cn/fuwu/bmfw/sy/jrts/tzxx/202401/t20240111_3532936.html"
              target="_blank"
              rel="noreferrer"
            >
              候补功能优化说明 ↗
            </a>
          </div>
          <div>
            <b>边界说明</b>
            <p>
              本页不是 12306 官方页面。系统拓扑、消息名、延迟数值与技术实现为教学性工程重建，不代表内部真实实现。
            </p>
          </div>
        </div>
        <div className="shell footer-bottom">
          <span>PUBLIC RULES × SYSTEMS THINKING × INTERACTIVE STORYTELLING</span>
          <span>2026</span>
        </div>
      </footer>
    </main>
  );
}
