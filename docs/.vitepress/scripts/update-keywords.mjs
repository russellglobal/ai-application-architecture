#!/usr/bin/env node
// Update frontmatter with unique long-tail keywords
import { join, resolve, basename } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { glob } from 'tinyglobby'
import GrayMatter from 'gray-matter'
import keywordMap from './keyword-map.mjs'

const docsDir = resolve('docs')

async function processFile(filePath) {
  const fileName = basename(filePath, '.md')
  const keywords = keywordMap[fileName]

  if (!keywords) {
    console.log(`  ⏭️  ${fileName} (no keywords mapped)`)
    return
  }

  const content = await readFile(filePath, 'utf-8')
  const { data: frontmatter, content: rawContent } = GrayMatter(content)

  // Skip if already has unique keywords (check if contains comma - our custom keywords have commas)
  if (frontmatter.keywords && frontmatter.keywords.includes(',')) {
    console.log(`  ✅ ${fileName} (already updated)`)
    return
  }

  frontmatter.keywords = keywords

  const newContent = GrayMatter.stringify(rawContent, frontmatter)
  await writeFile(filePath, newContent, 'utf-8')
  console.log(`  ✅ ${fileName}`)
}

async function main() {
  const files = await glob(['**/*.md'], {
    cwd: docsDir,
    ignore: ['node_modules/**', '.vitepress/**', 'public/**'],
  })

  console.log('\n Updating keywords...\n')

  for (const file of files.sort()) {
    const filePath = join(docsDir, file)
    await processFile(filePath)
  }

  console.log('\n✓ Done!\n')
}

main().catch(console.error)
