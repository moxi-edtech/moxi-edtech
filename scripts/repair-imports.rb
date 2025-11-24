#!/usr/bin/env ruby
require 'pathname'

ROOT = Pathname.new(__dir__).join('..')
TARGET_DIR = ROOT.join('apps/web/src')

REACT_HOOKS = %w[
  useState useEffect useMemo useCallback useRef useReducer useLayoutEffect
  useTransition useId Fragment
]
NEXT_NAV_ALLOWED = %w[useRouter usePathname useSearchParams redirect notFound]

def files
  Dir.glob(TARGET_DIR.join('**/*.{ts,tsx}'))
end

def ensure_react_import(src, hooks)
  hooks = hooks.uniq
  return src if hooks.empty?
  if (m = src.match(/import\s*\{([^}]*)\}\s*from\s*['"]react['"]/))
    existing = m[1].split(',').map(&:strip)
    add = hooks - existing
    return src if add.empty?
    replacement = "import { #{(existing + add).uniq.join(', ')} } from 'react'"
    return src.sub(m[0], replacement)
  else
    insert_at = 0
    if (ua = src.index("'use client'"))
      insert_at = src.index("\n", ua) + 1
    elsif (ua = src.index('"use client"'))
      insert_at = src.index("\n", ua) + 1
    end
    addition = "import { #{hooks.join(', ')} } from 'react'\n"
    return src[0...insert_at] + addition + src[insert_at..-1]
  end
end

def ensure_heroicons_import(src, icons)
  icons = icons.uniq
  return src if icons.empty?
  if (m = src.match(/import\s*\{([^}]*)\}\s*from\s*['"]@heroicons\/react\/24\/outline['"]/))
    existing = m[1].split(',').map(&:strip)
    add = icons - existing
    return src if add.empty?
    replacement = "import { #{(existing + add).uniq.join(', ')} } from '@heroicons/react/24/outline'"
    return src.sub(m[0], replacement)
  else
    addition = "import { #{icons.join(', ')} } from '@heroicons/react/24/outline'\n"
    # place after any react/next imports
    insert_at = src.lines.find_index { |l| l !~ /^\s*import\b/ } || src.length
    prefix = src.lines[0...insert_at].join
    rest = src.lines[insert_at..-1].join
    return prefix + addition + rest
  end
end

def repair_file(path)
  src = File.read(path)
  changed = false

  # Fix lucide-react: keep only PascalCase names; move hooks to react
  idx = 0
  regex_lucide = /import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/m
  while (m = regex_lucide.match(src, idx))
    block = m[1]
    full = m[0]
    names = block.split(',').map { |s| s.strip }.reject(&:empty?)
    hooks = names.select { |n| REACT_HOOKS.include?(n) || n =~ /^[a-z]/ }
    icons = names - hooks
    if hooks.any?
      new_import = icons.any? ? "import { #{icons.join(', ')} } from 'lucide-react'" : ''
      src = src[0...m.begin(0)] + new_import + src[m.end(0)..-1]
      src.gsub!(/\n\n\n+/, "\n\n")
      src = ensure_react_import(src, hooks)
      changed = true
      idx = m.begin(0)
    else
      idx = m.end(0)
    end
  end

  # Fix next/navigation: only allowed set; move hooks to react
  idx = 0
  regex_nav = /import\s*\{([^}]*)\}\s*from\s*['"]next\/navigation['"]/m
  while (m = regex_nav.match(src, idx))
    block = m[1]
    full = m[0]
    names = block.split(',').map { |s| s.strip }.reject(&:empty?)
    keep = names.select { |n| NEXT_NAV_ALLOWED.include?(n) }
    move_to_react = names - keep
    if move_to_react.any?
      new_import = keep.any? ? "import { #{keep.join(', ')} } from 'next/navigation'" : ''
      src = src[0...m.begin(0)] + new_import + src[m.end(0)..-1]
      src = ensure_react_import(src, move_to_react & REACT_HOOKS)
      changed = true
      idx = m.begin(0)
    else
      idx = m.end(0)
    end
  end

  # If any import from next/navigation contains Icon-suffixed names, move them to heroicons
  idx = 0
  while (m = regex_nav.match(src, idx))
    block = m[1]
    full = m[0]
    names = block.split(',').map { |s| s.strip }.reject(&:empty?)
    icon_names = names.select { |n| n =~ /Icon$/ }
    if icon_names.any?
      remaining = names - icon_names
      new_import = remaining.any? ? "import { #{remaining.join(', ')} } from 'next/navigation'" : ''
      src = src[0...m.begin(0)] + new_import + src[m.end(0)..-1]
      src = ensure_heroicons_import(src, icon_names)
      changed = true
      idx = m.begin(0)
    else
      idx = m.end(0)
    end
  end

  # Special case: users/delete route - ensure NextResponse and revalidatePath imports
  if path.include?('/app/api/super-admin/users/delete/route.ts')
    unless src.include?("from 'next/server'")
      src = "import { NextResponse } from 'next/server'\n" + src
      changed = true
    end
    unless src.include?("from 'next/cache'")
      src = "import { revalidatePath } from 'next/cache'\n" + src
      changed = true
    end
  end

  if changed
    File.write(path, src)
  end
  changed
end

changed = []
files.each do |f|
  begin
    changed << f if repair_file(f)
  rescue => e
    warn "Failed #{f}: #{e.message}"
  end
end

puts "Repaired #{changed.size} files"
changed.each { |f| puts "- #{Pathname.new(f).relative_path_from(ROOT)}" }
