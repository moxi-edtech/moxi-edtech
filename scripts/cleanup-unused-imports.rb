#!/usr/bin/env ruby
require 'pathname'

# Simple cleanup for unused named imports from selected modules.
# Heuristic: remove imported specifiers that don't appear elsewhere in file.
# Supports multi-line import blocks.

ROOT = Pathname.new(__dir__).join('..')
TARGET_DIR = ROOT.join('apps/web/src')
MODULES = [
  'lucide-react',
  'next/navigation',
  'next/server',
]

def find_files
  Dir.glob(TARGET_DIR.join('**/*.{ts,tsx}'))
end

def cleanup_file(path)
  src = File.read(path)
  changed = false

  MODULES.each do |mod|
    regex = /import\s*\{([\s\S]*?)\}\s*from\s*["']#{Regexp.escape(mod)}["']/m
    idx = 0
    while (m = regex.match(src, idx))
      imports_block = m[1]
      block_start = m.begin(0)
      block_end = m.end(0)

      # Build list of specifiers (strip aliases)
      specifiers = imports_block.split(',').map { |s| s.strip }.reject(&:empty?).map do |s|
        s.split(/\s+as\s+/).first.strip
      end
      break if specifiers.empty?

      # Count usage outside the import block
      before = src[0...block_start]
      after  = src[block_end..-1]
      body = before + after
      unused = []
      specifiers.each do |name|
        re = /(^|[^A-Za-z0-9_])#{Regexp.escape(name)}(\b|[^A-Za-z0-9_])/m
        unused << name if body.scan(re).empty?
      end

      if unused.empty?
        idx = block_end # move past this match
        next
      end

      remaining = specifiers - unused
      if remaining.empty?
        src = src[0...block_start] + src[block_end..-1]
        changed = true
        idx = block_start # continue from here as content shifted
      else
        new_import = "import { #{remaining.join(', ')} } from '#{mod}'"
        src = src[0...block_start] + new_import + src[block_end..-1]
        changed = true
        idx = block_start + new_import.length
      end
    end
  end

  if changed
    File.write(path, src)
  end
  changed
end

changed_files = []
find_files.each do |file|
  begin
    if cleanup_file(file)
      changed_files << file
    end
  rescue => e
    warn "Failed to process #{file}: #{e.message}"
  end
end

puts "Updated #{changed_files.size} files"
changed_files.each { |f| puts "- #{Pathname.new(f).relative_path_from(ROOT)}" }
