#!/usr/bin/env node
// Add frontmatter to all course articles
import { join, resolve, dirname, basename } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { glob } from 'tinyglobby'
import GrayMatter from 'gray-matter'

const docsDir = resolve('docs')

async function processFile(filePath) {
  const content = await readFile(filePath, 'utf-8')
  const { data: frontmatter, content: rawContent } = GrayMatter(content)

  // Skip if already has title in frontmatter
  if (frontmatter.title) {
    console.log(`  ⏭️  ${basename(filePath)} (already has frontmatter)`)
    return
  }

  // Extract title from H1
  let title = ''
  const h1Match = rawContent.match(/^#\s+(.+)$/m)
  if (h1Match) {
    title = h1Match[1]
      .replace(/^\d+[\.\s]+/, '')
      .replace(/^第\s+\d+\s*讲\s*\|\s*/, '')
      .trim()
  }

  // Extract description from first meaningful paragraph
  let description = ''
  const lines = rawContent.split('\n').filter(line => {
    const trimmed = line.trim()
    return trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('>') && !trimmed.startsWith('|') && !trimmed.startsWith('---')
  })
  description = lines.slice(0, 2).join(' ').substring(0, 120)

  // Extract keywords from content (first few unique Chinese words)
  const keywords = ['AI架构', 'AI应用架构']

  if (!title) {
    console.log(`  ⚠️  ${basename(filePath)} (no title found)`)
    return
  }

  // Build frontmatter
  const fm = {
    title,
    description,
    keywords: keywords.join(', '),
    author: '军尉',
    date: new Date().toISOString().split('T')[0],
  }

  // Check if file starts with frontmatter delimiter
  const hasFrontmatter = rawContent.startsWith('---')

  let newContent
  if (hasFrontmatter) {
    // Replace existing empty frontmatter
    const newRaw = GrayMatter.stringify(rawContent, fm)
    newContent = newRaw
  } else {
    // Add frontmatter at top
    newContent = GrayMatter.stringify(rawContent, fm)
  }

  await writeFile(filePath, newContent, 'utf-8')
  console.log(`  ✅ ${basename(filePath)}`)
}

async function main() {
  const files = await glob(['**/*.md'], {
    cwd: docsDir,
    ignore: ['node_modules/**', '.vitepress/**', 'public/**'],
  })

  console.log('\n📝 Adding frontmatter...\n')

  for (const file of files.sort()) {
    const filePath = join(docsDir, file)
    await processFile(filePath)
  }

  console.log('\n✓ Done!\n')
}

main().catch(console.error)
