# 黄金监控公开审计案例：生成与复核

本目录发布 ZhikunCode 与 Codex 黄金监控任务的静态审计报告、结构化证据、脱敏日志摘录、公开脱敏截图和 SHA-256 清单。报告生成不依赖网络、远程字体或第三方 npm 包。

## 公开文件

- `zhikuncode-codex-gold-monitor-audit.html`：静态、自包含的公开审计报告。
- `zhikuncode-codex-gold-monitor-evidence.json`：38 条证据、14 维评分及可视化所需结构化数据。
- `zhikuncode-gold-monitor-log-excerpts.txt`：保留原始行号的脱敏关键日志摘录。
- `assets/gold-audit/`：由冻结报告解码的公开运行截图；ZhikunCode 开发过程图对一处本机绝对路径做了确定性遮蔽。
- `zhikuncode-codex-gold-monitor-SHA256SUMS.txt`：上述公开文件及本说明的 SHA-256。

完整运行日志、两份冻结源 HTML 和冻结产物 ZIP 含本机路径、会话标识或未公开材料，不属于公开发布物。完整日志受仓库 `*.log` 忽略规则保护，不应使用 `git add -f` 强制加入版本控制。

## 公开构建

要求：Node.js 22（本次验证环境；脚本无第三方依赖）。

从仓库根目录执行：

```bash
node scripts/build-gold-audit-report.mjs
```

公开构建使用已提交的证据 JSON、脱敏摘录和截图。完整日志不存在时，生成器不会尝试补造缺失事件；它会验证公开摘录的来源声明、必需行号、敏感信息和证据引用，然后生成 HTML 与 SHA-256 清单。

## 私有源核验

拥有两份登记哈希对应的冻结源 HTML 时，可额外运行：

```bash
node scripts/build-gold-audit-report.mjs \
  --verify-private-sources \
  --zhikun-report /absolute/path/to/zhikuncode.html \
  --comparison-report /absolute/path/to/zhikuncode对比codex.html
```

该模式会核对源 HTML 的 SHA-256、46 张源 SVG 的原始顺序与逐图哈希、60 次工具调用指纹、评分与澄清问题等冻结事实。若本地存在被 Git 忽略的 `docs/case-studies/zhikuncode黄金监控运行日志.log`，生成器还会先核验其字节数、行数和 SHA-256，再从指定原始行段重新生成脱敏摘录；完整日志不会写入 HTML 或哈希清单。

只有在登记哈希对应的源 HTML 确实发生受控更新时，维护者才需要重新捕获 SVG 快照。此步骤依赖仓库前端开发依赖中的 `jsdom` 与 `postcss`，并把两张运行时评分图物化为静态 SVG：

```bash
node scripts/capture-gold-audit-source-visuals.mjs \
  --zhikun-report /absolute/path/to/zhikuncode.html \
  --comparison-report /absolute/path/to/zhikuncode对比codex.html
```

捕获器登记 46 张源图，公开 32 张完整主面板和 12 张完整次级面板；另外 2 张只保留标题、哈希和排除理由，不把未脱敏 SVG 本体写入仓库。常规公开构建直接读取已提交的压缩快照，不需要源 HTML、完整日志或前端依赖。

私有路径仅作为命令行参数使用，不会进入公开文件。

## 校验公开产物

```bash
cd docs/case-studies
shasum -a 256 -c zhikuncode-codex-gold-monitor-SHA256SUMS.txt
```

生成器还会检查：

- 证据编号、引用闭包、评分权重和 68.3 / 68.4 复算结果；
- 60 次工具调用的完整顺序及六个错误位置；
- 46 张源图登记、44 张公开面板、逐图 viewBox/节点/几何指纹、命名空间 SVG ID、标题和证据引用；
- 本机绝对路径、UUID、令牌、Cookie、认证请求头等敏感信息；
- 禁止重新出现的已纠正表述和旧版简化 SVG。

修改报告数据、生成器或公开资产后，应连续执行两次公开构建并比较输出哈希，确认生成结果确定，再提交全部相互匹配的 HTML、JSON、摘录、截图和 SHA-256 清单。
