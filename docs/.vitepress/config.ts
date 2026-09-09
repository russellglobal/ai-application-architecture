import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { buildEndGenerateOpenGraphImages } from '@nolebase/vitepress-plugin-og-image'
import { generateVerticalPosters } from './scripts/generate-posters.mjs'

export default withMermaid(defineConfig({
  lang: 'zh-CN',
  title: 'AI应用架构 · 一士一',
  description: 'AI应用架构开源课程 - 一士一 | AI Agent Architecture, RAG, LLM Applications',
  titleTemplate: ':title | AI应用架构 · 一士一',

  lastUpdated: true,
  cleanUrls: true,
  metaChunk: true,

  // Fix image resolution issue
  ignoreDeadLinks: true,
  vite: {
    assetsInclude: ['**/*.jpg', '**/*.png', '**/*.svg'],
    build: {
      rollupOptions: {
        external: [/^\/images\//, /^\/avatar\.jpg$/, /^\/tokslash-screenshot\.jpg$/, /^\/stratsapien-logo\.png$/],
      },
    },
  },

  buildEnd: async (siteConfig) => {
    await buildEndGenerateOpenGraphImages({
      hostname: 'https://ai.stratsapien.com',
      themeColor: '#FF8C42',
      fontFamily: 'Noto Sans SC',
      fontWeight: 700,
      logo: {
        light: 'https://ai.stratsapien.com/logo.svg',
        dark: 'https://ai.stratsapien.com/logo.svg',
      },
    })(siteConfig)

    // Generate vertical posters for WeChat sharing
    await generateVerticalPosters(siteConfig)
  },

  head: [
    // Favicon
    ['link', { rel: 'icon', href: '/favicon.svg' }],

    // Baidu SEO
    ['meta', { name: 'baidu-site-verification', content: 'codeva-2ZaMq7OaVV' }],

    // Google SEO
    ['meta', { name: 'google-site-verification', content: 'xxxxxx' }],

    // Open Graph (Facebook, LinkedIn, WeChat, etc.)
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'zh_CN' }],
    ['meta', { property: 'og:title', content: 'AI应用架构开源课程 - 一士一' }],
    ['meta', { property: 'og:description', content: 'AI应用架构开源课程，涵盖Agent架构、RAG、LLM应用等企业级AI系统设计与实现' }],
    ['meta', { property: 'og:url', content: 'https://ai.stratsapien.com/' }],
    ['meta', { property: 'og:site_name', content: 'AI应用架构 · 一士一' }],
    ['meta', { property: 'og:image', content: 'https://ai.stratsapien.com/og-image.png' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],

    // Twitter Card
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'AI应用架构开源课程 - 一士一' }],
    ['meta', { name: 'twitter:description', content: 'AI应用架构开源课程，涵盖Agent架构、RAG、LLM应用等企业级AI系统设计与实现' }],
    ['meta', { name: 'twitter:image', content: 'https://ai.stratsapien.com/og-image.png' }],

    // Additional SEO
    ['meta', { name: 'keywords', content: 'AI架构,Agent架构,RAG,LLM应用,架构师课程,AI Application Architecture' }],
    ['meta', { name: 'author', content: '一士一 (Russell)' }],
    ['meta', { name: 'robots', content: 'index,follow' }],

    // JSON-LD Structured Data for Course
    ['script', { type: 'application/ld+json' }, `
      {
        "@context": "https://schema.org",
        "@type": "Course",
        "name": "AI应用架构开源课程",
        "description": "AI应用架构开源课程，涵盖Agent架构、RAG、LLM应用等企业级AI系统设计与实现",
        "provider": {
          "@type": "Person",
          "name": "一士一 (Russell)",
          "url": "https://ai.stratsapien.com"
        },
        "url": "https://ai.stratsapien.com",
        "inLanguage": "zh-CN",
        "license": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
        "keywords": "AI架构,Agent架构,RAG,LLM应用,架构师课程",
        "hasCourseInstance": {
          "@type": "CourseInstance",
          "courseMode": "online",
          "courseWorkload": "P40H"
        }
      }
    `],
  ],

  themeConfig: {
    siteTitle: '一士一',

    nav: [
      { text: '课程', link: '/preface/00-intro-preface' },
      { text: '关于作者', link: '/about' },
      { text: '产品案例', link: '/products' },
      { text: 'GitHub', link: 'https://github.com/russellglobal/ai-application-architecture' },
    ],

    sidebar: [
      {
        text: '开篇',
        items: [
          { text: '00. 序言：为什么做这套课程', link: '/preface/00-intro-preface' },
          { text: '01. AI 应用架构师：现在最稀有的人才', link: '/part1-agentic/01-ai-architect-capability' },
          { text: '02. AI 应用架构的七层思维框架', link: '/part1-agentic/02-ai-architecture-panorama' },
        ]
      },
      {
        text: '第一篇：Agentic Engineering',
        items: [
          { text: '03. Agent 核心范式', link: '/part1-agentic/03-agent-core-paradigms' },
          { text: '04. Agent 进阶范式', link: '/part1-agentic/04-advanced-paradigms' },
          { text: '05. Agent 编排与工作流', link: '/part1-agentic/05-orchestration-workflow' },
          { text: '06. Agent 支撑技术', link: '/part1-agentic/06-supporting-technologies' },
          { text: '07. 多 Agent 协作', link: '/part1-agentic/07-multi-agent-collaboration' },
          { text: '08. Agent 评测与护栏', link: '/part1-agentic/08-agent-evaluation' },
        ]
      },
      {
        text: '第二篇：LLM 集成与知识增强',
        items: [
          { text: '09. LLM 架构', link: '/part2-llm-integration/09-llm-architecture' },
          { text: '10. RAG 架构', link: '/part2-llm-integration/10-rag-architecture' },
        ]
      },
      {
        text: '第三篇：AI 生产运维',
        items: [
          { text: '11. 运行时治理', link: '/part3-ai-ops/11-llm-runtime-governance' },
          { text: '12. 安全合规', link: '/part3-ai-ops/12-ai-security-compliance' },
          { text: '13. 成本与容灾', link: '/part3-ai-ops/13-cost-optimization-disaster-recovery' },
        ]
      },
      {
        text: '第四篇：AI Coding',
        items: [
          { text: '14. AI 辅助编码与 Vibe Coding', link: '/part4-ai-coding/14-ai-assisted-coding' },
          { text: '15. 企业级 AI 平台', link: '/part4-ai-coding/15-enterprise-ai-platform' },
        ]
      },
      {
        text: '深度专题',
        items: [
          { text: 'AI 原生研发范式', link: '/deep-dive/ai-native-rd-paradigm' },
          { text: 'LLM 输出清洗管道', link: '/deep-dive/llm-output-cleaning-tutorial' },
          { text: 'AI 成本框架', link: '/deep-dive/ai-cost-frameworks' },
        ]
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/russellglobal/ai-application-architecture' },
    ],

    editLink: {
      pattern: 'https://github.com/russellglobal/ai-application-architecture/edit/russell_main/docs/:path',
      text: '在 GitHub 上编辑此页',
    },

    footer: {
      message: '<a href="https://ai.stratsapien.com">AI应用架构</a> · <a href="/about">军尉</a> · <a href="https://github.com/russellglobal/ai-application-architecture">GitHub</a>',
      copyright: 'Copyright © 2024-2026 王军尉 | <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>',
    },

    search: {
      provider: 'local',
    },

    docFooter: {
      prev: '上一页',
      next: '下一页',
    },

    outline: {
      level: [2, 3],
      label: '页面导航',
    },
  },

  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
    },
  },
}))
