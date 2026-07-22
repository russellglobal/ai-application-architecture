# 第 05 讲 | 编排与工作流：让 Agent 跑在生产环境里

> **本节我们将掌握**：
>
> - Agentic Workflow 和纯 Agent 的本质区别
> - LangGraph 状态机编排的核心机制（State / Node / Edge）
> - 低代码平台（Dify / Langflow）的定位与局限
> - Human-in-the-Loop 的工程实现：中断、审批、恢复
> - 选型决策：我们的场景该用哪种编排方案

---

## 生产环境的真相

第 03、04 讲讲了各种 Agent 范式。回到生产环境，有一个关键事实：

**真正跑稳的 AI 应用，绝大多数是 Workflow，不是 Agent。**

- AI 客服被外界称为"Agent"，但架构上是 Workflow——意图分类路由 + 标准化工具调用 + 人工升级机制
- 完全自主 Agent 在生产环境跑稳的案例，仍然非常少

**原因**：生产环境需要**可预测性**。用户点"提交"后，我们无法承受 Agent "自由发挥"带来的不确定性。

编排与工作流要解决的问题：**怎么让 Agent 既能智能决策，又在可控的流程里运行。**

---

## Workflow 和 Agent 的关系

大模型能力越来越强，Agent能力范围在快速增长，不过目前（2026年）的主流实现中，为了可控和成本，业界真实形态产品仍然保持以下实现，但是在coding/research等场景，纯Agent基本已经可以跑通。

企业应用当前主流形态：

```
Workflow 负责"宏观流程拓扑"——步骤顺序、分支条件、异常处理
Agent  负责"节点微观决策"——信息解析、工具选择、内容生成
```

两者不是对立的，而是**嵌套关系**：

| 维度 | Workflow | Agent |
|------|----------|-------|
| **控制者** | 开发者预定义的流程 | LLM 自主决策 |
| **确定性** | 高（流程固定） | 低（模型自由度高） |
| **适合** | 业务流程、审批链路 | 信息提取、工具选择、内容生成 |
| **失败模式** | 流程设计缺陷 | 幻觉、跑飞、死循环 |

**一个经验法则**：

业务流程可以画成一张有限流程图 → 用 Workflow；如果更像"给定目标，让 AI 自己想办法"这种尽可能利用大模型能力的灵活场景 → 用 Agent。

**目前大多数企业级场景是两者的混合**——大框架用 Workflow 保证可控，局部节点用 Agent 提供灵活性。

以后，越来越多的场景可能被Agent蚕食，但Workflow因其稳定、低成本仍会在生产环境有竞争力。

---

## LangGraph：状态机编排的事实标准（非IT企业/专业应用可以略过）

LangGraph 是目前生产级 Agent 工作流使用最多的编排框架。2025 年 10 月发布 1.0 正式版。Replit、Uber、LinkedIn、Klarna、J.P. Morgan 等都在生产环境使用。

### 三个核心概念

```
State（状态）→ 全局共享数据，所有节点读写同一个状态对象
Node（节点）→ 一个执行步骤（可以是 LLM 调用、工具调用、人工确认）
Edge（边）  → 步骤之间的流转规则（固定边 or 条件边）
```

用一句话概括：**LangGraph 的本质不是"更复杂的 Chain"，而是"状态驱动的工作流引擎"。**

### 它怎么工作

> **场景**：用户问客服一个问题，系统判断是简单问题还是复杂问题，简单问题直接答，复杂问题转人工。

```
── 初始化 State ────────────────────────────────────────
state = { question: "我的订单什么时候到？", answer: "", need_human: false }

── classify 节点 ────────────────────────────────────
LLM 判断意图："查物流" → 简单问题
state.need_human = false

── 条件边 route ────────────────────────────────────
need_human = false → 走 answer 节点

── answer 节点 ────────────────────────────────────
LLM 生成回答："您的订单预计明天下午送达"
state.answer = "您的订单预计明天下午送达"
→ END
```

如果用户问的是"我要投诉，你们发错货了"：

```
── classify 节点 ────────────────────────────────────
LLM 判断意图："投诉" → 复杂问题
state.need_human = true

── 条件边 route ────────────────────────────────────
need_human = true → 走 human 节点

── human 节点 ────────────────────────────────────
转接人工客服处理
→ END
```

整个流程就 3 个节点：classify → answer / human → END。State 只有 3 个字段。这就是 LangGraph 的最小可用形态。

骨架代码：

> 代码只为想了解原理同学准备，非编程场景可不看

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict

# 1. 定义状态
class AgentState(TypedDict):
    question: str
    answer: str
    need_human: bool

# 2. 定义节点
def classify(state: AgentState) -> dict:
    intent = llm.invoke(f"判断意图：{state['question']}")
    return {"need_human": intent == "复杂问题"}

def answer(state: AgentState) -> dict:
    return {"answer": llm.invoke(f"回答：{state['question']}")}

def human(state: AgentState) -> dict:
    return {"answer": "已转接人工客服"}

def route(state: AgentState) -> str:
    return "human" if state["need_human"] else "answer"

# 3. 组装图
graph = StateGraph(AgentState)
graph.add_node("classify", classify)
graph.add_node("answer", answer)
graph.add_node("human", human)
graph.set_entry_point("classify")
graph.add_conditional_edges("classify", route, {"answer": "answer", "human": "human"})
graph.add_edge("answer", END)
graph.add_edge("human", END)
app = graph.compile()
```

### LangGraph 的杀手锏：Checkpointer

LangGraph 最关键的工程能力是 **Checkpointer**——每一步状态自动持久化，服务挂了能从断点恢复。

> 代码只为想了解原理同学准备，非编程场景可不看

```python
from langgraph.checkpoint.postgres import PostgresSaver

# 用 PostgreSQL 做持久化
checkpointer = PostgresSaver.from_conn_string("postgresql://...")
app = graph.compile(checkpointer=checkpointer)

# 用户关掉页面，过一会儿回来 → 从上次断点继续
result = app.invoke(
    {"query": "分析这份合同的风险"},
    config={"configurable": {"thread_id": "user-123"}}
)
```

**为什么这很重要？** 因为生产环境的 Agent 任务往往不是秒级完成的。一个合同审核可能跑 5 分钟，一个研报生成可能跑 30 分钟。中间服务重启、用户断开连接，都是常态。没有 Checkpointer，这些场景根本跑不了。

### 代价

**学习曲线陡**。从"函数调用"思维切换到"状态图"思维，需要时间。

**和 LangChain 耦合深**。LangGraph 的基础组件依赖 LangChain 生态，如果我们不用 LangChain，单独用 LangGraph 会有额外的集成成本。

**调试不直观**。图结构的执行路径不像线性代码那样容易追踪。虽然 LangSmith 提供了 time-travel debugging，但又是一层复杂度。

---

## 低代码方案：Dify、Langflow 和扣子

不是所有场景都需要写代码。低代码可视化编排平台已经非常成熟。

### Dify

GitHub 高星项目，TypeScript 构建，企业级 Agentic 工作流平台。

| 特点 | 说明 |
|------|------|
| **可视化编排** | 拖拽式搭建 Workflow，支持 Agent/Workflow/Chatflow 三种模式 |
| **全栈能力** | RAG + Agent + Workflow + 模型管理 + LLMOps 一体化 |
| **企业友好** | 多租户、权限管控、审计日志、私有化部署 |
| **中文社区** | 社区活跃度极高，国内落地案例最多 |

### Langflow

GitHub 高星项目，Python 构建，可视化 Agent 工作流搭建工具。

| 特点 | 说明 |
|------|------|
| **拖拽搭建** | 组件化开发，拖拽连线即可构建 Agent 工作流 |
| **三层架构** | 基础层（兼容主流 LLM 和向量库）→ 中间层（工作流引擎）→ 应用层（预置模板） |
| **开源灵活** | MIT 协议，社区模板丰富 |

### 扣子（Coze）

字节跳动出品，国内低代码 Agent 平台的主流选择。

| 特点 | 说明 |
|------|------|
| **零代码搭建** | 拖拽式构建 Agent 和工作流，无需编程基础 |
| **插件生态** | 内置丰富插件，支持自定义 API 接入 |
| **多渠道发布** | 一键发布到飞书、微信、网页等多个渠道 |
| **知识库** | 内置 RAG 能力，支持文档上传构建知识库 |

### 和 LangGraph 的定位差异

| 维度 | LangGraph | Dify / Langflow / 扣子 |
|------|-----------|------------------------|
| **目标用户** | 开发者 | 开发者 + 业务人员 |
| **使用方式** | 编程 | 可视化拖拽 |
| **灵活度** | 极高（代码级控制） | 较高（组件化配置） |
| **定制深度** | 可以魔改任何细节 | 平台组件+自定义服务接口 |
| **适合场景** | 复杂定制工作流 | 标准化业务流程快速上线 |
| **运维成本** | 自己管 | 平台托管 |

**选型信号**：
非开发人员 / 20步以内固定工作流 / 无多Agent等复杂场景 / 快速上线 -> 用Dify/Flow/Coze

IT 公司 / 业务逻辑复杂 / 需要深度定制 → LangGraph 或自研状态机

---

## 一句话编程：从编排到生成（选读）

因为工作流需要学习，不易维护，随着大模型能力增强，2025-2026 年出现了一个新趋势：**不用拖拽，不用写代码，用一句话描述需求，AI 直接生成完整应用**。

代表工具：

| 工具 | 定位 | 核心特点 |
|------|------|----------|
| **Bolt.new** | 全栈应用生成 | 一句话生成完整 Web 应用，支持实时预览和部署 |
| **Lovable** | 前端应用生成 | 专注 React/Next.js，UI 生成质量高 |
| **Replit Agent** | 全栈开发助手 | 从需求到代码到部署，全流程自动化 |
| **v0 by Vercel** | UI 组件生成 | 专注前端组件，生成高质量 React 代码 |
| **扣子编程（国内，字节）** | 国内一句话编程 | 字节跳动出品，自然语言生成完整应用，支持一键部署 |

### 和低代码平台的区别

| 维度 | Dify / Langflow / 扣子 | Bolt / Lovable / 扣子空间 |
|------|------------------------|---------------------------|
| **使用方式** | 拖拽组件 + 连线 | 自然语言描述需求 |
| **输出物** | 工作流配置 | 完整可运行的代码 |
| **灵活度** | 受限于平台组件 | 生成任意代码，可二次开发 |
| **适合场景** | 固定业务流程 | 快速原型、MVP、内部工具 |
| **可控性** | 流程可视化，易调试 | 代码可看，但复杂逻辑难维护 |

### 适用场景

| 场景 | 为什么适合 |
|------|-----------|
| 快速原型验证 | 10 分钟出 MVP，验证想法 |
| 内部工具开发 | 非技术人员也能提需求，AI 直接生成 |
| 个人项目 | 独立开发者效率拉满 |

### 代价

**复杂业务逻辑扛不住**。生成的代码往往缺乏错误处理、边界条件、安全考虑，生产环境需要人工重构。

**维护成本高**。AI 生成的代码风格不统一，后续维护困难。

**不适合企业级应用**。没有状态管理、没有权限控制、没有审计日志，这些都需要人工补充。

**选型信号**：

快速原型 / 个人项目 / 内部工具 → Bolt / Lovable；

生产级应用 → 还是得回到 LangGraph 、自研；简单的可以使用Dify等工作流产品。



---

## 人在循环（Human-in-the-Loop）：生产级编排的关键

纯自动化在理论上很美好，但生产环境里，**高风险操作必须有人工把关**。

### 哪些操作需要人工介入

| 操作类型 | 为什么需要人 |
|----------|-------------|
| 用户要求转人工 | 特殊场景，要有人工兜底方案。 |
| 支付/退款 | 涉及资金安全 |
| 外发邮件/消息 | 发出去就收不回来 |
| 内容发布 | 影响品牌形象 |
| 超出权限范围 | Agent 不应自主决策，尤其不能帮别的部门决策 |

### LangGraph 的实现方式：Interrupt / Resume

> **场景**：客服 Agent 要回复客户邮件，但涉及退款操作，需要主管确认。

```
── 客服 Agent 执行到“发送退款邮件” ─────────────────
Agent 判断：涉及退款，属于高风险操作 → 触发 interrupt

── 中断发生 ────────────────────────────────────────
系统暂停 Agent 执行
把当前状态推给前端：
  { draft_email: "尊敬的客户...已为您办理退款 ¥299...",
    recipient: "customer@example.com",
    message: "请审核这封邮件内容，确认后发送" }

── 主管审批 ────────────────────────────────────────
主管查看邮件内容，发现金额有误
主管反馈：approved=false, revised_content="...退款 ¥199..."

── 恢复执行 ────────────────────────────────────────
Agent 收到反馈，用修订后的内容继续确认...直到无误后
邮件发送 → 任务完成
```

骨架代码：

> 代码只为想了解原理同学准备，非编程场景可不看，编码场景也有成熟框架

```python
from langgraph.types import interrupt, Command

def human_review_node(state: AgentState):
    """人工审核节点：暂停执行，等待人工审批"""
    # 暂停，把当前状态发给前端
    human_feedback = interrupt({
        "draft_email": state["draft_response"],
        "recipient": state["customer_email"],
        "message": "请审核这封邮件内容，确认后发送"
    })
    
    # 人工恢复后，拿到反馈继续
    if human_feedback["approved"]:
        return {"needs_human": False}
    else:
        return {
            "draft_response": human_feedback["revised_content"],
            "needs_human": False
        }
```

**核心设计**：Agent 遇到高风险操作时**暂停** → 把上下文推给前端 → 等人工审批 → 拿到反馈后**恢复**执行。

进一步做，可以让 Agent 评估自己决策的**置信度**。信心不够就主动请求人工介入，避免硬着头皮执行。这比"所有操作都要人审"灵活得多。

### 工程要点

**超时机制**：人工审批不能无限等待。设置超时（如 30 分钟），超时后走降级路径（取消操作 / 转人工处理）。

**状态快照**：中断时的完整状态必须持久化。用户可能关掉页面第二天再来审批。

**审计日志**：每一次中断和恢复都要记录，方便事后排查和合规审计。

---

## 自研状态机：什么时候需要（非IT企业/专业应用可以略过）

> 状态机：是一种思想，
>
> 举例：”当上课铃响” （事件），小明的状态从“在操场玩“（状态 A)，切换到“在教室上课”(状态 B),并执行“跑向教室”/“记笔记”等事前、事后（动作）。
>
> 因此，状态机简化公式： 当Event 发生，则“State A”->“ State B”，并执行某些Action。
>
> 如果类似事情反复出现，往往在IT产品里，通过“状态机”模式解决。比如常见的报销这种“层层审批流转”的流程。

当以下情况出现时，框架可能不够用：

- **极高并发**（万级 QPS），框架的 overhead 扛不住
- **深度业务耦合**，编排逻辑和现有系统紧密交织
- **特殊运行时要求**（如 Java/Go 技术栈，LangGraph 是 Python only）

自研的核心思路不变：**把 Agent 执行过程建模成状态机，每一步状态落盘，服务挂了也能从断点恢复。**

| 技术选型 | 适用场景 |
|----------|---------|
| 自研轻量状态机 | 简单场景，不想引入重框架 |
| Spring State Machine | Java 企业级应用 |

---

## 研发过程视角：Superpowers 就是一台状态机

前面讲的 Workflow 和 Human-in-the-Loop，不只是"为用户造产品"的架构。我们自己的日常研发流程（如使用Claude Code/Codex/OpenClaw)，也可以是一台状态机。

第 03、04 讲已经介绍了 Superpowers。从编排的角度看，它的七步流水线就是一张精心设计的状态图：

```
Brainstorm → Spec → Plan → TDD → Subagent Dev → Review → Finalize
    ↑                                    |
    └──── 不通过，回到 Brainstorm ─────┘
```

对应到本讲的核心概念：

| 编排概念 | Superpowers 怎么做的 |
|----------|---------------------|
| **状态机** | 七步强制流水线，每步有明确的进入条件和退出条件 |
| **Human-in-the-Loop** | 每一步完成后都要人确认才进入下一步（Brainstorm 确认需求、Spec 确认规格、Plan 确认任务拆分） |
| **中断 / 恢复** | Plan 阶段生成的任务清单可持久化，中断后可以从任意任务继续 |
| **条件边** | Review 不通过 → 回到 Brainstorm 重新澄清；TDD 红灯 → 继续修复直到绿灯 |
| **子 Agent** | Subagent Dev 阶段，每个任务可以分配给独立的子 Agent 并行执行 |

**关键洞察**：Superpowers 证明了"用 Workflow 框住主流程，在节点内嵌入 Agent"这个原则，不只适用于产品架构，同样适用于开发者自己的工具链。我们每天用 Claude Code 写代码，Superpowers 在后台强制执行这套状态机，让我们从"和 AI 随机对话"变成"按工程纪律协作"。

这也是为什么第 03 讲说"大多数成功的 AI 应用是 Workflow 而非纯 Agent"——Superpowers 本身就是这个原则的最佳实践。

---

## 从 Workflow 到 Loop：工程范式的自然延伸

### AI 协作的四级进化路径

| 级别 | 模式 | 我们在做什么 | 典型场景 | 瓶颈 |
|------|------|-----------|---------|------|
| **L1：Vibe Coding** | 人机乒乓 | 我说一句，它改一次 | 探索性原型、快速试错 | 效率低，人卡在 loop 内 |
| **L2：Harness（狭义的）** | 工程纪律 | 给它 Spec + Plan + 测试，它按流程跑 | 有明确需求的开发任务 | 仍需要人逐轮引导 |
| **L3：Sub-Agent Loop** | 自主执行 | 给它 Goal + Eval + Stop，它自己跑 | 重构、Bug 修复、测试生成 | Eval 质量决定上限 |
| **L4：Multi-Agent Loop** | 多 Agent 协作 | 设计多个 Loop，让它们互相衔接 | 全栈开发、端到端交付 | 通信开销和一致性 |

**判断我们现在在哪一级**：

- 我们在和大模型"一句一句"改代码 → **L1**
- 我们用 Superpowers 跑 Spec → Plan → TDD 流程 → **L2**
- 我们给 Claude Code 一个任务，它自己跑测试、改代码、直到全通过 → **L3**
- 我们设计了一个 Lead Agent 拆任务分给多个 Sub-Agent，各跑各的 Loop → **L4**

**升级方向**：

- L1 → L2：别直接跟模型聊，先把需求写进 Spec.md，让它按 Spec 跑
- L2 → L3：把人工 Review 换成自动化测试，Eval 越强，Agent 自主度越高
- L3 → L4：单任务能自主跑了，把大任务拆成子任务，分给多个 Agent 并行跑 Loop

💡 核心原则：每一级的升级，都是把"人在 loop 内做的事"交给系统。L1 人写每一句，L2 人写 Spec，L3 人写 Eval，L4 人设计 Loop 拓扑。

### 我们已经在用的 Loop

我们在日常开发中已经在用 Loop，只是没这么叫它。

| 工程实践 | 它的 Loop 长什么样 |
|---------|-------------------|
| **TDD** | 写测试 → 红灯 → 写代码 → 绿灯 → 重构 → 下一轮 |
| **CI/CD** | 代码提交 → 自动构建 → 测试 → 失败自动重试 N 次 → 成功则部署 |
| **Retry Policy** | 请求失败 → 指数退避重试 → 最多 M 次 → 超限则熔断降级 |
| **Code Review** | PR 提交 → Review 不通过 → 改 → 再 Review → 直到通过 |

这些 Loop 的共同结构：**Goal → Action → Eval → Retry/Stop**。

Loop Engineering 本质上就是把这套程序员已经熟悉的工程逻辑，系统化地应用到 Agent 自主执行上。与其自己逐轮 prompt Agent，不如设计一个让 Agent 自主循环、自动验证、知道何时停止的系统。

### Loop 的 5 组件

每个 Loop 都由 5 个组件构成：

| 组件 | 工程等价物 | Claude Code 中的体现 |
|------|-----------|---------------------|
| **Goal**（目标） | 需求文档 / 任务描述 | "实现 auth 模块，保持 API 不变" |
| **Context**（上下文） | 代码库 + 文档 | Superpowers 的 Spec + Plan 文件 |
| **Action**（执行） | 写代码 + 跑测试 | Agent 修改文件 + 调用 pytest |
| **Eval**（验证） | CI 绿灯 / Lint 通过 / Review 通过 | 测试反馈（强 Eval）、人工确认（弱 Eval） |
| **Stop**（终止） | 测试全通过 / 达到最大重试次数 | PR 合并 / 达到 max_steps 熔断 |

### Eval 的层级：这是核心瓶颈

Loop 的质量上限不取决于模型有多强，而取决于 **Eval 有多可靠**。分三个层级：

| Eval 层级 | 说明 | 可靠性 | 例子 |
|----------|------|--------|------|
| **强 Eval** | 客观对错，机器可判 | 高 | 单元测试、Lint、类型检查 |
| **工具反馈** | 工具返回结果，需要解读 | 中 | API 返回错误码、编译器警告 |
| **人工 Review** | 人判断质量 | 主观但全面 | PR Review、规格合规审查 |

**原则**：强 Eval 越多的 Loop，Agent 自主度可以越高。如果我们的项目测试覆盖率高，Agent Loop 几乎可以全自动跑。如果只有人工 Review，Agent 每一步都要等人。

### 反例：什么时候 Loop 会失败

| 反模式 | 症状 | 熔断手段 |
|--------|------|----------|
| **假 Eval** | Eval 太弱，Agent "通过"了但实际没做好 | 提升 Eval 层级，至少加 Lint |
| **无休止 Loop** | Eval 一直不过，Agent 无限重试 | max_steps 硬上限 + 相似 Action 去重 |
| **Goal 漂移** | Loop 跑着跑着偏离了原始目标 | 每 N 轮回查 Goal，偏差超阈值则暂停 |
| **Eval 冲突** | 两个 Eval 互相矛盾（如 Lint 通过但测试失败） | 定义优先级，强 Eval 优先 |

### 和 Reflexion 的关系

第 03 讲的 Reflexion（失败→反思→重试）是 Loop 的一个特例。Loop Engineering 是更通用的元框架：

- Reflexion 只管"反思重试"这一种策略
- Loop 管整个自主迭代系统，包含 Goal 定义、Eval 选择、终止条件、熔断机制

💡 **一句话总结**：Prompt Engineering 是"怎么问"，Loop Engineering 是"设计一个自己会问、会改、会停的系统"。2026 年的核心技能从"写好 prompt"变成了"设计好 Eval"。

---
## 选型决策

> **架构师决策清单**：
>
> - **流程确定 + 步骤固定** → 纯 Workflow。LLM 只做节点内的推理，不参与流程路由。
> - **流程确定 + 节点内需要智能决策** → Workflow + Agent 节点（大多数企业场景）。
> - **流程不确定 + 需要 LLM 决定下一步** → Agentic Workflow（LangGraph 状态图，但加护栏）。
> - **快速上线 + 标准流程** → Dify / Langflow（低代码平台，业务人员也能搭）。
> - **复杂定制 + 深度集成** → LangGraph（代码级控制力最强）。
> - **非 Python 技术栈** → Temporal.io / Spring State Machine / 自研。
> - **Human-in-the-Loop 必加** → 高风险操作（写库、支付、外发）必须有人工审批节点。
> - **拍板点**：先用 Workflow 框住主流程，只在需要的节点嵌入 Agent。不要反过来。

---

## 面试回答要点

**Q：Agent 的工作流你怎么设计？和传统工作流有什么区别？**

答（抓本质 + 讲工程）：

**核心区别**——传统工作流的每个节点是确定性代码；Agentic Workflow 的节点里嵌了 LLM，节点内部有智能决策能力，但流程的流转仍由状态机控制。

**设计原则**——Workflow 管宏观拓扑（先审核、再分析、再输出），Agent 管微观决策（信息提取、工具选择、内容生成）。2026 年的共识是：大多数成功的 AI 应用是 Workflow 而非纯 Agent。

**工程实现**——用 LangGraph 做状态编排，核心是 State + Node + Edge。Checkpointer 做状态持久化，支持中断恢复。高风险操作加 Human-in-the-Loop（Interrupt / Resume）。

**深度追问**：

- "LangGraph 和 Dify 怎么选？" → 能用平台组件拼出来的用 Dify，上线快。需要深度定制的用 LangGraph。两者不是替代关系，是互补关系。
- "Human-in-the-Loop 怎么设计？" → 关键在 Interrupt / Resume 机制。Agent 遇到高风险操作暂停，状态持久化，等人工审批后恢复。必须有超时降级和审计日志。
- "状态机编排和 Temporal 有什么区别？" → LangGraph 是 AI 原生的编排框架，状态定义和 LLM 节点集成紧密。Temporal 是通用分布式工作流引擎，更适合非 AI 的微服务编排。两者可以配合：LangGraph 管 AI 决策流程，Temporal 管后续的业务系统对接。

---

## 小结

1. **Workflow 和 Agent 是嵌套关系**：Workflow 管流程拓扑，Agent 管节点决策。大多数企业场景是"Workflow 为主 + 节点内嵌 Agent"
2. **LangGraph 是状态机编排的事实标准**：State + Node + Edge + Checkpointer，支持持久化、中断恢复、Human-in-the-Loop
3. **低代码平台适合快速上线**：Dify（企业级）和 Langflow（开源灵活）覆盖标准化场景
4. **Human-in-the-Loop 是生产级编排的关键**：高风险操作必须有人工审批节点，通过 Interrupt / Resume 实现

---

## 思考题

1. 我们正在设计一个"自动合同审核系统"。流程包括：上传合同 → 提取关键条款 → 风险评估 → 生成审核报告 → 法务确认 → 发送结果。哪些步骤适合用 Workflow 固定流程？哪些步骤需要嵌入 Agent 做智能决策？哪些步骤需要 Human-in-the-Loop？画出我们的状态图。

2. 我们的团队用 Dify 搭了一个客服工作流，运行半年后业务变复杂了（需要多轮对话、动态分支、自定义状态持久化），平台能力不够用了。我们会怎么评估是继续扩展 Dify 还是迁移到 LangGraph？迁移的核心成本在哪里？
