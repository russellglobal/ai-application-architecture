import { join, resolve, dirname, relative, basename } from 'node:path'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { glob } from 'tinyglobby'
import GrayMatter from 'gray-matter'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
import satori from 'satori'

const POSTER_WIDTH = 750
const POSTER_HEIGHT = 1334

// Load font (use system CJK fonts - prefer TTF/OTF over TTC)
async function loadFont() {
  const fontPaths = [
    '/usr/share/fonts/truetype/unifont/unifont.ttf',
    '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansSC-Regular.otf',
    '/usr/share/fonts/noto-cjk/NotoSansCJKsc-Regular.otf',
  ]

  for (const fontPath of fontPaths) {
    try {
      const font = await readFile(fontPath)
      console.log(`  Using font: ${fontPath}`)
      return font
    } catch {}
  }

  throw new Error('No CJK font found. Install: sudo apt install fonts-unifont')
}

async function generatePoster(articlePath, title, description, category, outputDir, fontBuffer) {
  const svg = await satori({
    type: 'div',
    props: {
      style: {
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        background: '#1a1a2e',
        display: 'flex',
        flexDirection: 'column',
        padding: '60px 40px',
        boxSizing: 'border-box',
      },
      children: [
        // Top brand bar
        {
          type: 'div',
          props: {
            style: {
              height: '4px',
              background: '#FF8C42',
              marginBottom: '40px',
              borderRadius: '2px',
              display: 'flex',
            },
          },
        },
        // Brand
        {
          type: 'div',
          props: {
            style: {
              color: '#FF8C42',
              fontSize: '24px',
              fontWeight: 700,
              marginBottom: '60px',
              letterSpacing: '2px',
              display: 'flex',
            },
            children: 'AI 应用架构 · 军尉',
          },
        },
        // Category badge
        category ? {
          type: 'div',
          props: {
            style: {
              background: 'rgba(255, 140, 66, 0.15)',
              border: '1px solid #FF8C42',
              borderRadius: '999px',
              padding: '8px 20px',
              marginBottom: '30px',
              alignSelf: 'flex-start',
              display: 'flex',
            },
            children: {
              type: 'span',
              props: {
                style: {
                  color: '#FF8C42',
                  fontSize: '18px',
                  fontWeight: 500,
                },
                children: category,
              },
            },
          },
        } : null,
        // Title
        {
          type: 'div',
          props: {
            style: {
              color: '#ffffff',
              fontSize: '42px',
              fontWeight: 800,
              lineHeight: '1.3',
              marginBottom: '30px',
              letterSpacing: '-1px',
              display: 'flex',
            },
            children: title || 'AI 应用架构',
          },
        },
        // Description
        description ? {
          type: 'div',
          props: {
            style: {
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '20px',
              lineHeight: '1.6',
              marginBottom: 'auto',
              display: 'flex',
            },
            children: description,
          },
        } : null,
        // Bottom section
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '60px',
              paddingTop: '30px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  },
                  children: [
                    {
                      type: 'span',
                      props: {
                        style: {
                          color: '#FF8C42',
                          fontSize: '22px',
                          fontWeight: 700,
                        },
                        children: '军尉',
                      },
                    },
                    {
                      type: 'span',
                      props: {
                        style: {
                          color: 'rgba(255, 255, 255, 0.4)',
                          fontSize: '16px',
                        },
                        children: 'ai.stratsapien.com',
                      },
                    },
                  ],
                },
              },
              // QR Code placeholder (text for now)
              {
                type: 'div',
                props: {
                  style: {
                    width: '80px',
                    height: '80px',
                    background: 'white',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    color: '#333',
                    textAlign: 'center',
                    padding: '8px',
                  },
                  children: '扫码阅读',
                },
              },
            ],
          },
        },
      ].filter(Boolean),
    },
  }, {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    fonts: [
      {
        name: 'Noto Sans SC',
        data: fontBuffer,
        weight: 400,
        style: 'normal',
      },
    ],
  })

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: POSTER_WIDTH,
    },
  })

  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()

  // Extract filename from article path
  const articleName = basename(articlePath, '.md')
  const outputName = `poster-${articleName}.png`
  const outputPath = join(outputDir, outputName)

  await writeFile(outputPath, pngBuffer)
  console.log(`  ✓ Generated: ${outputName}`)

  return outputName
}

export async function generateVerticalPosters(siteConfig) {
  const docsDir = resolve(siteConfig.srcDir)
  const distDir = resolve(siteConfig.outDir)
  const posterDir = join(distDir, 'posters')

  console.log('\n🎨 Generating vertical posters...')
  await mkdir(posterDir, { recursive: true })

  const fontBuffer = await loadFont()

  // Find all markdown files
  const files = await glob(['**/*.md'], {
    cwd: docsDir,
    ignore: ['node_modules/**', '.vitepress/**', 'public/**'],
  })

  let generated = 0
  let skipped = 0

  for (const file of files.sort()) {
    const filePath = join(docsDir, file)
    const content = await readFile(filePath, 'utf-8')
    const { data: frontmatter } = GrayMatter(content)

    // Extract title from frontmatter or first H1
    let title = frontmatter.title
    if (!title) {
      const h1Match = content.match(/^#\s+(.+)$/m)
      if (h1Match) {
        title = h1Match[1].replace(/^\d+[\.\s]+/, '').replace(/^第\s+\d+\s*讲\s*\|\s*/, '')
      }
    }

    // Extract description from frontmatter or first paragraph
    let description = frontmatter.description
    if (!description) {
      const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#') && !line.startsWith('>'))
      description = lines.slice(0, 2).join(' ').substring(0, 100)
    }

    if (!title) {
      skipped++
      continue
    }

    // Extract category from path
    const parts = file.split('/')
    let category = ''
    if (parts[0].startsWith('part')) {
      category = parts[0].replace('part', '第') + '篇'
    } else if (parts[0] === 'deep-dive') {
      category = '深度专题'
    } else if (parts[0] === 'preface') {
      category = '开篇'
    }

    try {
      await generatePoster(file, title, description, category, posterDir, fontBuffer)
      generated++
    } catch (err) {
      console.error(`  ✗ Failed: ${file}`, err.message)
      skipped++
    }
  }

  console.log(`\n✓ Posters: ${generated} generated, ${skipped} skipped`)
}
