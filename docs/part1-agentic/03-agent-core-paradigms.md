# 第 03 讲 | Agent 怎么"想"：三种核心范式 

> **本节我们将掌握**：
>
> - Agent 的三种核心范式：ReAct、Plan-and-Execute、Reflexion
> - 每种范式的运行机制、适用场景和代价
> - 为什么"自主度越高 ≠ 越好"
> - 选型决策：我们的场景该用哪种范式 

---

## 什么是Agent 范式？

- 写一堆 if-else？→ 传统工作流，不是 Agent
- 让大模型直接回答？→ 纯LLM对话，不用工具，不用MCP，查不了文档，查不了内部订单数据。
- 写一个循环，让模型"先想，后做，再检查"？→ **这就是 Agent 范式**

**Agent 范式的本质**：定义"大模型怎么思考、怎么行动、怎么从结果中学习"的循环模式。

不同的范式，决定了 Agent 的自主度、成本、失败率和可控性。

选错了范式，后面的工程全是坑。

---

## 范式一：ReAct（边想边做）

ReAct（Reasoning + Acting）是工程落地最广的 Agent 范式。

核心循环就四步：

```
Thought（想） → Action（做） → Observation（看） → Thought（再想） → ...
```

### 它怎么工作

> **场景**：用户问 AI 助手——"帮我查北京今天天气，看适不适合跑步。"  
> 可用工具：`get_weather(city, date)`，返回温度、湿度、风速。

```
初始 context：
  "系统提示词：你是天气助手，
  工具：get_weather(city, date)。
  用户输入的提示词：北京今天适合跑步吗？"

── Step 0 ──────────────────────────────────────────────
想：LLM 读 context → "需要先查北京天气"
做：调用 get_weather("北京", "2026-07-03")
看：返回 35°C，湿度80%，风速5km/h → 追加到 context
判断：没有 Final Answer → 继续

此时 context：
  [系统提示 + 用户问题]
  Thought: 需要先查北京天气
  Action: get_weather("北京", "2026-07-03")
  Observation: 35°C，湿度80%，风速5km/h    ← 新增信息

── Step 1 ──────────────────────────────────────────────
想：LLM 看到天气数据 → "35°C+80%湿度，闷热，不适合跑步"
做：无 Action，直接输出最终答案
  Final Answer: 北京今天35°C、湿度80%，体感闷热，不建议户外跑步...
判断：检测到 Final Answer → 循环结束，返回答案
```

骨架代码就四行：

> 代码只为想了解原理同学准备，非编程场景可不看，编码场景也有成熟框架

```python
for step in range(max_steps):
    thought = llm.invoke(context + "Thought: 我需要...")      # 想: Thought
    action = parse_action(thought)     # 做 Action：调用工具
    context += f"Observation: {tools[action.name](action.input)}"  # 看 Observation：结果塞回上下文
    if is_done(thought): return thought  # 判断是否完毕
```

### 适用场景

| 场景 | 为什么适合 |
|------|-----------|
| 工具调用不确定（搜索、查询） | 需要根据上一步结果决定下一步 |
| 任务步骤少（3-5步） | 循环次数可控，成本可接受——循环多了成本太高，问题太多。 |
| 实时交互（对话式） | 用户能看到"思考过程"，体验好 |

### 代价

**Token 消耗大**。每一步都要调一次 LLM，一个简单任务跑下来，Token 消耗是 Plan-and-Execute 的 3-5 倍。

**容易跑飞**。没有全局规划，模型可能"走一步看一步"失去方向。典型症状：连续 3 步在做同一件事但换着说法。

**上下文膨胀**。每轮的 Thought + Action + Observation 都堆在上下文里，跑到第 10 步时，窗口里一半是历史噪音。

---

## 范式二：Plan-and-Execute（先规划再执行）

如果说 ReAct 是"走一步想一步"，Plan-and-Execute 就是"先画地图再走路"。

核心架构三个组件：

```
Planner（规划器）→ 输出步骤列表
    ↓
Executor（执行器）→ 逐步执行
    ↓
Replanner（重规划器）→ 某步失败时调整计划
```

### 它怎么工作

> **场景**：让 AI 生成一份"竞品分析报告"——搜竞品信息 → 提取数据 → 生成对比表 → 写结论。

```
── 阶段 1：Planner 出计划（只调一次 LLM）──────────────
输入："生成 Cursor 和 Windsurf 的竞品分析报告"
Planner 输出：
  Step 1: 搜索两款产品的官网和评测文章
  Step 2: 提取定价、功能列表、用户评分
  Step 3: 生成对比表格
  Step 4: 撰写分析结论和推荐建议

── 阶段 2：Executor 逐步执行 ──────────────────────────
Step 1 ✓ → 拿到 5 篇搜索结果
Step 2 ✓ → 提取出定价和功能数据
Step 3 ✗ → Windsurf 定价页面改版了，抓不到价格

── 阶段 3：Replanner 介入 ─────────────────────────────
输入："Step 3 失败，Windsurf 定价数据缺失。剩余：Step 3, 4"
Replanner 输出：
  Step 3': 改用 G2、Capterra 获取 Windsurf 定价
  Step 4': 基于补充数据生成对比表格
  Step 5': 撰写分析结论

Executor 继续执行 → 最终汇总输出报告
```

骨架代码：

> 代码只为想了解原理同学准备，非编程场景可不看，编码场景也有成熟框架

```python
class PlanExecuteAgent:
    def run(self, goal):
        plan = self.planner.invoke(f"为完成'{goal}'制定步骤计划")
        results = []
        for i, step in enumerate(plan["steps"]):
            result = self.executor.run(step)
            results.append(result)
            if is_failed(result):  # 失败 → 重规划剩余步骤
                new_plan = self.replanner.invoke(f"步骤'{step}'失败，调整剩余计划")
                plan["steps"] = plan["steps"][:i+1] + new_plan["steps"]
        return self.summarize(goal, results)
```

### 和 ReAct 的核心差异

| 维度 | ReAct | Plan-and-Execute |
|------|-------|-----------------|
| **思考节奏** | 每步都想 | 规划时集中想，执行时按计划走 |
| **LLM 调用次数** | 每步 1 次（N 步 = N 次） | 规划 1 次 + 执行 N 次（可用轻量模型） |
| **Token 成本** | 高 | 中（执行阶段可用小模型） |
| **可控性** | 低（模型自由度高） | 高（计划可人审、可缓存、可重排） |
| **容错** | 靠重试 | 靠重规划（更系统） |
| **适合任务长度** | 短（3-5步） | 长（5-20步） |

### 适用场景

| 场景 | 为什么适合 |
|------|-----------|
| 长任务（研报生成、代码开发） | 步骤多，需要全局视角 |
| 需要人工审核计划 | 计划输出后可以先让人看一眼 |
| 成本敏感 | 执行阶段可以用轻量模型 |
| 步骤间有依赖关系 | 规划阶段可以理清 DAG |

### 2026 年的新证据

AAAI 2026 论文《Beyond ReAct》提出了以 Planner 为中心的范式，在 StableToolBench 基准上取得了最先进的执行性能。

GAIA 基准研究进一步发现：**仅脚手架选择就可在同一模型内将精度移动多达 28 个百分点**。Gemini 配合 Plan-and-Execute 配置，在困难任务上精度最高且成本最低。

**结论**：Plan-and-Execute 不再是"备选方案"，在很多场景下已经是首选。

### 代价

**规划错了后面全歪**。Plan 的质量直接决定执行效果。如果 Planner 漏了一个关键步骤，Executor 再努力也补不回来。（Russell经验⭐：所以成熟的Planner框架一般有Review机制，以及如果是编辑代码，往往还会触发"测试通过"这种可验证的条件）

**计划粒度难拿捏**。太粗 → Executor 不知道怎么干；太细 → Planner 容易过度承诺，执行时环境变了计划就废了。（Russell经验⭐：一般Executor 是Planner的3倍左右内容）

**重规划本身也消耗 Token**。如果修改内容过多，相当于文档重写，尤其是规划出来后需要多个模型反复审视的。（Russell经验⭐：如果没想好，多次规划理清思路是很值得的。）

---

## 范式三：Reflexion（自我反思迭代）

Reflexion 不是独立的范式，而是在 ReAct 或 Plan-and-Execute 外面**套一层"失败 → 反思 → 重试"的循环**。

### 它怎么工作

> **场景**：让 AI 写一个 Python 函数 `parse_csv(file_path)`，要求支持引号内逗号和换行符。

```
── Round 0：第一次执行 ─────────────────────────────────
Executor 输出：
  def parse_csv(file_path):
      with open(file_path) as f:
          return [line.split(",") for line in f.readlines()]

Evaluator 跑测试 → 失败：
  FAIL: test_quoted_comma — '"hello, world",foo' 被错误切分
  FAIL: test_multiline — 引号内换行符被错误切分

Reflector 反思 → Lesson 0:
  "不能用简单 split(',')，需要状态机追踪引号状态，
   只在 in_quotes=False 时才按逗号切分。"

── Round 1：带着 Lesson 0 重新执行 ────────────────────
Executor → 实现了引号状态机逻辑
Evaluator → test_quoted_comma ✓，test_multiline ✗

Reflector 反思 → Lesson 1:
  "状态机方向正确，但 readlines() 按行切断，破坏引号内换行。
   应该先读整个文件，再逐字符解析。"

── Round 2：带着 Lesson 0 + Lesson 1 第三次执行 ──────
Executor → 改为逐字符解析，正确处理引号内换行
Evaluator → 全部通过 ✓ → 返回结果
```

骨架代码：

> 代码只为想了解原理同学准备，非编程场景可不看，编码场景也有成熟框架

```python
class ReflexionAgent:
    def run(self, goal, max_rounds=3):
        lessons = []
        for round in range(max_rounds):
            result = self.executor.run(goal, context=lessons)  # 带着教训执行
            feedback = self.evaluator.evaluate(result)
            if feedback.passed: return result
            lesson = self.reflector.invoke(  # 反思：具体错在哪？
                f"目标：{goal}\n结果：{result}\n反馈：{feedback}\n历史教训：{lessons}\n给出一条具体改进建议"
            )
            lessons.append(lesson)
        return self._fallback("多轮反思仍失败")
```

### 三类反馈来源

| 来源 | 例子 | 适用场景 |
|------|------|---------|
| **LLM自省** | "我上一步推理跳过了关键条件" | 推理类任务 |
| **环境信号** | 单元测试没过、SQL 执行报错 | 代码生成、数据操作 |
| **外部批评** | 用户直接反馈说"方向错了/不满意/重新生成" | 高风险高可控场景 |

### 适用场景

| 场景 | 为什么适合 |
|------|-----------|
| 代码生成 | 有客观对错（编译/测试），反馈明确 |
| 数学推理 | 答案唯一，可以自动验证 |
| 多步决策 | 每轮可以修正策略 |

### 代价

**慢**。每轮都要多一次"评估 + 反思"的 LLM 调用。

**反思质量不稳定**。模型可能反思出"正确的废话"（"我需要更仔细"），而不是具体可操作的改进。

**可能陷入"反思循环"**。如果根本问题不在执行策略而在任务理解，反思再多也没用。

---

## 三家关系：一张图看懂

```
ReAct          → 基础循环骨架（想→做→看→想）
    ↓ 加前置规划
Plan-and-Execute → 加了地图的 ReAct（先规划→再执行→失败重规划）
    ↓ 加外层反思
Reflexion      → 加了记忆的循环（执行→评估→反思→带着教训重跑）
```

**不是三选一，而是可以叠加**：

- 简单任务 → 纯 ReAct
- 长任务 → Plan-and-Execute
- 高准确性要求 → Plan-and-Execute + Reflexion

---

## 研发过程的 Agentic Engineering

前面讲的场景都是"为用户构建 AI 产品"。但 Agent 范式还有一个同样重要的用途——**用 AI 提升我们自己的研发效率**。

2026 年最典型的例子是 **Superpowers**（GitHub 216K+ Stars）。它不是一个 Agent 框架，而是一套**给 AI 编程工具装上的工程纪律**——本质上是把 Plan-and-Execute + Reflexion 嵌入了我们的日常开发流程。

它的核心流程：

```
Brainstorm（需求澄清）→ Spec（写规格说明）→ Plan（拆成可执行任务）
    → TDD（红→绿→重构）→ Subagent Dev（子 Agent 执行）→ Review（双轮审查）
```

对应到三种范式：

| Superpowers 阶段 | 对应的 Agent 范式 | 在做什么 |
|------------------|------------------|----------|
| Brainstorm | ReAct | AI 反过来问我们问题，边想边澄清需求 |
| Plan | Plan-and-Execute | 把工作拆成 2-5 分钟粒度的任务，每个任务有文件、代码、验证方式 |
| TDD + Review | Reflexion | 红→绿→重构循环 + 规格合规审查 + 代码质量审查 |
| Subagent Dev | Plan-and-Execute 的 Executor | 子 Agent 按计划逐步执行 |

**关键洞察**：Superpowers 证明了一件事——Agent 范式不只是"造产品"的工具，它同样可以重塑"用 AI 做研发"的方式。我们用 Claude Code 写代码时，Superpowers 在后台强制执行 Plan-and-Execute + Reflexion，让我们从"和 AI 随机对话"变成"按工程纪律协作"。

这种"用 AI 构建"的视角，在后续讲次中会反复出现（第 14-16 讲 AI Coding 是主场）。Karpathy 把这种工作方式称为 **Agentic Engineering**——与其自己写代码，不如设计 Agent 来完成，我们做规格定义、测试验证和编排。

---
## 选型决策

> **架构师决策清单**：
>
> - **任务确定 + 步骤少（≤5步）** → ReAct。灵活、快速、实现简单。
> - **任务确定 + 步骤多（>5步）** → Plan-and-Execute。先规划再执行，成本可控，计划可人审。
> - **任务需要纠错能力** → + Reflexion。有客观评判标准（测试、编译、评分）时才有效。
> - **任务开放 + 探索性强** → 考虑进阶范式（详见第 04 讲（Agent 进阶范式）：ToT/GoT）。
> - **几乎别直接用 AutoGPT 范式** → 自主度拉满 = 失败率拉满，除非场景容错高、预算足。
> - **拍板点**：生产里 80% 的场景 ReAct + 必要时的 Plan 就够了。不要一上来就搞复杂。

---

## 面试回答要点

**Q：Agent 的主流范式有哪些，你怎么选型？**

答（分层 + 抓差异）：

**基础三层**——

- **ReAct**：Thought → Action → Observation 循环，适合短任务、工具调用。代价是 Token 消耗大、容易跑飞。
- **Plan-and-Execute**：先出计划再执行，适合长任务、可人审计划。2026 年 AAAI 论文验证了它在多工具场景的优势。
- **Reflexion**：外层包反思循环，靠环境/自省反馈迭代，适合有客观评判的场景（代码、数学）。

**选型原则**：自主度和失败率正相关。任务越确定、越用低自主范式；任务越开放、才往上走。生产里 80% 场景 ReAct + 必要时的 Plan 就够了。

**深度追问**：

- "ReAct 和 Plan-and-Execute 能混用吗？" → 能。Planner 出计划，Executor 内部用 ReAct 循环执行每个子任务。这是最常见的组合。
- "Reflexion 的反思质量怎么保证？" → 关键在 evaluator 的设计。有客观标准（测试、编译）的场景反思质量高；纯主观任务反思容易变成"正确的废话"。

---

## 小结

1. **三种核心范式**：ReAct（边想边做）、Plan-and-Execute（先规划再执行）、Reflexion（自我反思迭代）
2. **核心权衡**：自主度 ↑ → 复杂度 ↑ → 成本 & 失败率 ↑
3. **不是三选一**：可以叠加，ReAct 是骨架，Plan 是前置规划，Reflexion 是外层反思
4. **选型口诀**：短任务用 ReAct，长任务加 Plan，要纠错加 Reflexion

---

## 思考题

1. 我们正在设计一个"自动生成竞品分析报告"的 Agent。任务包括：搜索竞品信息 → 提取关键数据 → 生成对比表格 → 撰写分析结论。我们会选哪种范式？为什么？如果报告质量不达标，怎么加 Reflexion？

2. 假设我们的 ReAct Agent 在某个场景下连续 5 步都在"搜索 → 没找到 → 换个关键词搜索"循环。从架构层面，我们会加什么机制来检测和终止这种循环？（提示：详见第 08 讲（Agent 评测与护栏））
