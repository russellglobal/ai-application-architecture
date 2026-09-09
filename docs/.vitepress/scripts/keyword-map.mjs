// Unique long-tail keywords for each article
// Based on actual content, not generic tags
const articleKeywords = {
  // 开篇
  '00-intro-preface': 'AI应用架构课程介绍,为什么学AI架构,架构师vs开发者能力差异,22讲课程大纲,Russell军尉',
  '01-ai-architect-capability': 'AI应用架构师能力模型,架构师和开发者区别,AI人才稀缺,转型AI架构师,七层架构思维',
  '02-ai-architecture-panorama': 'AI应用七层架构,传统架构vsAI架构,LLM系统分层,接入层到基础设施,架构全景图',

  // 第一篇
  '03-agent-core-paradigms': 'Agent核心范式,ReAct模式,Plan-and-Execute范式,Reflexion自我反思,Agent选型决策',
  '04-advanced-paradigms': 'Agent进阶范式,Tree of Thoughts,Graph of Thoughts,AutoGPT,自主度与成本权衡,Meta-Agent',
  '05-orchestration-workflow': 'Agent编排框架,LangGraph工作流,Dify编排,状态机设计,人工介入点,编排五维度',
  '06-supporting-technologies': 'MCP协议,Tool Calling工具调用,Agent记忆系统,语义缓存,无框架Agent趋势',
  '07-multi-agent-collaboration': '多Agent协作模式,CrewAI,AutoGen,四种协作模式,五种通信机制,框架选型',
  '08-agent-evaluation': 'Agent评测体系,六维质量评估,五道防线,Guardrails护栏,工程闭环,Agent测试',

  // 第二篇
  '09-llm-architecture': 'LLM模型选型,模型容灾策略,四阶段清洗管道,结构化输出,一致性验证,LLM质量管控',
  '10-rag-architecture': 'RAG全链路架构,文档分块策略,向量检索,混合检索,RAG后处理,知识库构建实战',

  // 第三篇
  '11-llm-runtime-governance': 'LLM版本管理,Prompt版本控制,知识库版本,灰度发布策略,AB测试,模型切换',
  '12-ai-security-compliance': 'AI安全合规,数据隐私,内容安全审核,AI输出合规,企业AI治理,敏感信息防护',
  '13-cost-optimization-disaster-recovery': 'AI成本优化,Token成本核算,语义缓存降本,大小模型路由,多模型容灾,SLO指标',

  // 第四篇
  '14-ai-assisted-coding': 'AI辅助编程,Claude Code实战,Vibe Coding,Cursor编程,Copilot工作流,人机协作编码',
  '15-enterprise-ai-platform': '企业级AI平台,代码智能体架构,安全管控,AI开发平台设计,模型治理',

  // 深度专题
  'llm-output-cleaning-tutorial': 'LLM输出清洗,JSON格式化,60%到99%清洗管道,结构化输出实战,输出质量保证',
  'ai-cost-frameworks': 'AI成本框架,Token成本分析,LLM定价模型,ROI评估,成本优化策略',
}

export default articleKeywords
