#!/usr/bin/env ruby
require 'pathname'

ROOT = Pathname.new(__dir__).join('..')
TARGET = ROOT.join('apps/web/src')

def client_file?(src)
  src.lstrip.start_with?("\"use client\"", "'use client'")
end

def prune_file(path)
  src = File.read(path)
  return false unless client_file?(src)
  changed = false
  idx = 0
  regex = /import\s*\{([\s\S]*?)\}\s*from\s*["']next\/navigation["']/m
  while (m = regex.match(src, idx))
    block = m[1]
    names = block.split(',').map { |s| s.strip }.reject(&:empty?)
    start = m.begin(0); stop = m.end(0)
    before = src[0...start]
    after  = src[stop..-1]
    body = before + after
    used = []
    names.each do |n|
      re = /(^|[^A-Za-z0-9_])#{Regexp.escape(n)}(\b|[^A-Za-z0-9_])/m
      used << n if body.match(re)
    end
    if used.size == names.size
      idx = stop
      next
    end
    if used.empty?
      # drop entire import
      src = before + after
      idx = start
    else
      new_import = "import { #{used.join(', ')} } from 'next/navigation'"
      src = before + new_import + after
      idx = start + new_import.length
    end
    changed = true
  end
  if changed
    File.write(path, src)
  end
  changed
end

changed = []
Dir.glob(TARGET.join('**/*.{ts,tsx}')).each do |file|
  begin
    next unless File.read(file).include?("from \"next/navigation\"") || File.read(file).include?("from 'next/navigation'")
    changed << file if prune_file(file)
  rescue => e
    warn "Failed #{file}: #{e.message}"
  end
end

puts "Pruned next/navigation in #{changed.size} client files"
changed.each { |f| puts "- #{Pathname.new(f).relative_path_from(ROOT)}" }

