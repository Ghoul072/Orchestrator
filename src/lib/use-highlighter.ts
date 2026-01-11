import { useState, useEffect } from 'react'
import { createHighlighter, type Highlighter, type BundledLanguage } from 'shiki'

// Singleton highlighter instance
let highlighterPromise: Promise<Highlighter> | null = null
let highlighterInstance: Highlighter | null = null

// Common languages for code diffs
const LANGUAGES: BundledLanguage[] = [
  'typescript',
  'javascript',
  'tsx',
  'jsx',
  'json',
  'html',
  'css',
  'scss',
  'python',
  'rust',
  'go',
  'java',
  'c',
  'cpp',
  'csharp',
  'ruby',
  'php',
  'swift',
  'kotlin',
  'sql',
  'yaml',
  'toml',
  'markdown',
  'bash',
  'shell',
  'dockerfile',
]

// Map file extensions to shiki language IDs
const EXTENSION_TO_LANGUAGE: Record<string, BundledLanguage> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'css',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  kts: 'kotlin',
  sql: 'sql',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  md: 'markdown',
  mdx: 'markdown',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  Dockerfile: 'dockerfile',
}

async function getHighlighter(): Promise<Highlighter> {
  if (highlighterInstance) {
    return highlighterInstance
  }

  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: LANGUAGES,
    })

    highlighterInstance = await highlighterPromise
  }

  return highlighterPromise
}

export function getLanguageFromPath(filePath: string): BundledLanguage | null {
  // Handle Dockerfile
  if (filePath.endsWith('Dockerfile') || filePath.includes('Dockerfile.')) {
    return 'dockerfile'
  }

  const extension = filePath.split('.').pop()?.toLowerCase()
  if (extension && extension in EXTENSION_TO_LANGUAGE) {
    return EXTENSION_TO_LANGUAGE[extension]
  }

  return null
}

export interface HighlightedLine {
  tokens: Array<{
    content: string
    color?: string
    fontStyle?: string
  }>
}

export function useHighlighter() {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    getHighlighter()
      .then((h) => {
        setHighlighter(h)
        setIsLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error('Failed to load highlighter'))
        setIsLoading(false)
      })
  }, [])

  const highlightLine = (
    code: string,
    language: BundledLanguage | string | null,
    theme: 'github-dark' | 'github-light' = 'github-dark'
  ): HighlightedLine => {
    if (!highlighter || !language || !code) {
      return { tokens: [{ content: code }] }
    }

    try {
      // Check if language is loaded
      const loadedLangs = highlighter.getLoadedLanguages()
      if (!loadedLangs.includes(language as BundledLanguage)) {
        return { tokens: [{ content: code }] }
      }

      const result = highlighter.codeToTokens(code, {
        lang: language as BundledLanguage,
        theme,
      })

      // Flatten tokens from all lines (should be just one line)
      const tokens: HighlightedLine['tokens'] = []
      for (const line of result.tokens) {
        for (const token of line) {
          tokens.push({
            content: token.content,
            color: token.color,
            fontStyle: token.fontStyle === 1 ? 'italic' : undefined,
          })
        }
      }

      return { tokens }
    } catch {
      return { tokens: [{ content: code }] }
    }
  }

  const highlightCode = (
    code: string,
    language: BundledLanguage | string | null,
    theme: 'github-dark' | 'github-light' = 'github-dark'
  ): string => {
    if (!highlighter || !language || !code) {
      return code
    }

    try {
      const loadedLangs = highlighter.getLoadedLanguages()
      if (!loadedLangs.includes(language as BundledLanguage)) {
        return code
      }

      return highlighter.codeToHtml(code, {
        lang: language as BundledLanguage,
        theme,
      })
    } catch {
      return code
    }
  }

  return {
    highlighter,
    isLoading,
    error,
    highlightLine,
    highlightCode,
    getLanguageFromPath,
  }
}
