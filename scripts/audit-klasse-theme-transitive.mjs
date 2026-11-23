#!/usr/bin/env node
/**
 * Evidence-based operational UI dependency audit. Static imports/re-exports,
 * literal import(), require() and CSS dependencies are followed transitively.
 * Dynamic computed imports are reported explicitly, never treated as resolved.
 *
 * No runtime data, network, credentials, RLS or school records.
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webSrc = path.join(root, "apps/web/src");
const app = path.join(webSrc, "app");
const requireWeb = createRequire(path.join(root, "apps/web/package.json"));
const ts = requireWeb("typescript");
const extensions = [".tsx", ".ts", ".jsx", ".js", ".mjs", ".css", ".module.css", ".scss"];
const knownRoots = [
  "apps/web/src/app/layout.tsx",
  "apps/web/src/components/CommandPalette.tsx",
  "apps/web/src/components/ui/NotificacoesDropdown.tsx",
  "apps/web/src/components/layout/klasse/Sidebar.tsx",
  "apps/web/src/components/layout/klasse/Topbar.tsx",
  "apps/web/src/components/layout/shared/SidebarNav.tsx",
  "apps/web/src/components/escola-admin/Sidebar.tsx",
  "apps/web/src/components/Sidebar.tsx",
  "apps/web/src/components/feedback/FeedbackSystem.tsx",
  "apps/web/src/components/providers/ThemeProvider.tsx",
];
const lines = (source, pos) => source.slice(0, pos).split("\n").length;
const relative = p => path.relative(root, p).split(path.sep).join("/");
const isWithin = (dir,p) => p.startsWith(dir + path.sep);
const recursive = dir => readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? recursive(path.join(dir,e.name)) : [path.join(dir,e.name)]);
const operationalPages = ["escola", "secretaria"].flatMap(dir =>
  recursive(path.join(app,dir)).filter(p => /\.(tsx|ts)$/.test(p) && /(page|layout|loading|error|template|default|not-found)\.(tsx|ts)$/.test(p))
);
const entrypoints = [...new Set([...operationalPages, ...knownRoots.map(p=>path.join(root,p))])].filter(existsSync);
function resolve(specifier, from) {
  if (!specifier) return null;
  let p;
  if (specifier.startsWith("@/") || specifier.startsWith("~/")) p = path.join(webSrc, specifier.slice(2));
  else if (specifier.startsWith("./") || specifier.startsWith("../")) p = path.resolve(path.dirname(from),specifier);
  else if (specifier.startsWith("@moxi/design-tokens")) p = path.join(root,"packages/design-tokens/src",specifier.split("/").slice(2).join("/"));
  else return null;
  const tries = [p, ...extensions.map(ext => p+ext), ...extensions.map(ext=>path.join(p,"index"+ext))];
  return tries.find(candidate => existsSync(candidate) && statSync(candidate).isFile()) || null;
}
const colorRe = /(?:#[0-9a-fA-F]{3,8}\b|(?:rgb|hsl|oklch|color-mix)\s*\(|\b(?:white|black|transparent)\b)/i;
const scalarProps = new Set(["color","backgroundColor","borderColor","borderTopColor","borderBottomColor","borderLeftColor","borderRightColor","outlineColor","fill","stroke","stopColor","caretColor","boxShadow"]);
const chartLibraries = /^(?:recharts|chart\.js|react-chartjs|apexcharts|react-apexcharts|victory|nivo|@nivo|d3|echarts|react-google-charts|react-plotly)/;
const visited = new Set();
const graph = [];
const missing = [];
const dynamic = [];
const cssFiles = [];
const chartSources = [];
const inlineStyle = [];
const propColors = [];
const stack=entrypoints.slice();
function literal(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
}
function valueText(node, source) { return source.slice(node.getStart(),node.getEnd());}
while(stack.length){
  const file=stack.pop();
  if(visited.has(file))continue;
  visited.add(file);
  if (!existsSync(file)) continue;
  const source=readFileSync(file,"utf8");
  const name=relative(file);
  if (/\.(css|scss)$/.test(file)){
    cssFiles.push({path:name,lines:source.split("\n").length,rawColors:[...source.matchAll(/#[a-fA-F0-9]{3,8}\b|(?:rgb|hsl|oklch)\(/g)].length});
    continue;
  }
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const imports=[];
  function add(spec, kind, pos) {
    const to=resolve(spec,file);
    if(to){imports.push({specifier:spec,source:relative(to),kind});stack.push(to);}
    else if (spec.startsWith("@/") || spec.startsWith("~/") || spec.startsWith("./") || spec.startsWith("../")){
      missing.push({source:name,line:lines(source,pos),specifier:spec,kind});
    }
    if(chartLibraries.test(spec))chartSources.push({source:name,line:lines(source,pos),module:spec});
  }
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      const spec=literal(node.moduleSpecifier);if(spec)add(spec,ts.isImportDeclaration(node)?"import":"export",node.getStart());
    }
    if (ts.isCallExpression(node)) {
      const callee=node.expression;
      const isImport=callee.kind===ts.SyntaxKind.ImportKeyword;
      const isRequire=ts.isIdentifier(callee)&&callee.text==="require";
      if(isImport||isRequire){
        const spec=literal(node.arguments[0]);
        if(spec)add(spec,isImport?"dynamic-literal":"require",node.getStart());
        else {dynamic.push({source:name,line:lines(source,node.getStart()),kind:isImport?"computed-import":"computed-require",expr:valueText(node,source).slice(0,180)});}
      }
    }
    if (ts.isJsxAttribute(node)) {
      const attr=node.name.getText(ast);
      if(attr==="style" && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression){
        const expr=node.initializer.expression;
        if(ts.isObjectLiteralExpression(expr)){
          for(const prop of expr.properties){
            if(!ts.isPropertyAssignment(prop))continue;
            const key=prop.name?.getText(ast).replace(/^["']|["']$/g,"");
            if(!key)continue;
            const val=valueText(prop.initializer,source);
            const isLiteral=ts.isStringLiteralLike(prop.initializer);
            const isColor=scalarProps.has(key)||/color|fill|stroke|shadow/i.test(key);
            if(isColor || colorRe.test(val)){
              inlineStyle.push({source:name,line:lines(source,prop.getStart()),property:key,value:val.slice(0,160),literal:isLiteral,colorLiteral:isLiteral&&colorRe.test(val)});
            }
          }
        } else {
          inlineStyle.push({source:name,line:lines(source,node.getStart()),property:"style-non-object",value:valueText(expr,source).slice(0,120),literal:false,colorLiteral:false});
        }
      }
      if (["fill","stroke","color","backgroundColor","stopColor"].includes(attr)&&node.initializer){
        let val=node.initializer.getText(ast);
        if(colorRe.test(val))propColors.push({source:name,line:lines(source,node.getStart()),attr,value:val.slice(0,120)});
      }
    }
    ts.forEachChild(node,visit);
  }
  visit(ast);
  graph.push({source:name,imports});
}
const nodes=[...visited].map(relative);
const tsx=nodes.filter(p=>p.endsWith(".tsx"));
const styles=cssFiles.map(x=>x.path);
const seen=new Set(nodes);
const allTsx=recursive(webSrc).filter(p=>p.endsWith(".tsx"));
const missedOperational=allTsx.filter(p=>isWithin(path.join(webSrc,"components"),p)&& !seen.has(relative(p))).map(relative);
const approvedTransitiveClasses = JSON.parse(
  readFileSync(path.join(root,"scripts/klasse-theme-transitive-exceptions.json"),"utf8")
);
const fixedClasses = /(?<![\w/-])(?:(?:hover|focus|group-hover|disabled|placeholder):)?(?:bg|text|border|ring|divide|placeholder:text)-(?:slate|gray|zinc)-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\/\d+)?|(?<![\w/-])bg-white(?:\/\d+)?/g;
export function overBudgetFixedClasses(name,source,exceptions) {
  const seen = {};
  for(const match of source.matchAll(fixedClasses)){
    const token=match[0];
    seen[token]=(seen[token]||0)+1;
  }
  const approved=exceptions[name]?.tokens||{};
  return Object.entries(seen).filter(([token,count])=>
    count>(approved[token]||0)).map(([token,count])=>({
      source:name,token,count,allowed:approved[token]||0
    }));
}
const transitiveComponents = tsx.filter(name =>
  name.startsWith("apps/web/src/components/") &&
  !/\/fiscal\/|\/print\/|\/_print\/|\/pdf\/|Recibo|Print|Ficha/.test(name)
);
const unexpectedTransitiveClasses = transitiveComponents.flatMap(name =>
  overBudgetFixedClasses(name,readFileSync(path.join(root,name),"utf8"),approvedTransitiveClasses)
);
const exceptionPaths = Object.keys(approvedTransitiveClasses);
const unreviewedExceptions = exceptionPaths.filter(name =>
  !approvedTransitiveClasses[name].reason ||
  approvedTransitiveClasses[name].reason === "REVIEW REQUIRED");
const approvedClassCount = Object.values(approvedTransitiveClasses)
  .reduce((sum,item)=>sum+Object.values(item.tokens).reduce((n,v)=>n+v,0),0);
const report={
  entrypoints:entrypoints.length, operationalEntrypoints:operationalPages.length,
  nodes:nodes.length,tsx:tsx.length,ts:nodes.filter(p=>p.endsWith(".ts")).length,
  css:cssFiles, chartSources,dynamic,missing,inlineStyle,propColors,
  graph,missedOperational,roots:entrypoints.map(relative),
  transitiveComponents:transitiveComponents.length,approvedClassCount,unexpectedTransitiveClasses,
};
const out=process.env.KLASSE_THEME_AUDIT_OUTPUT;
if(out)writeFileSync(out,JSON.stringify(report,null,2));
export function unexpectedOperationalCssColors(source) {
  // Central semantic token definitions and light-only portal classes are reviewed.
  const rest = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(?:^|\n)\s*:root\s*\{[^}]*\}/g, "")
    .replace(/(?:^|\n)\s*\.dark\s*\{[^}]*\}/g, "")
    .replace(/(?:^|\n)\s*\.klasse-portal-theme[^{}]*\{[^}]*\}/g, "");
  return [...rest.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl|oklch)\s*\(/g)].map(x=>x[0]);
}
const globalCssColorViolations = unexpectedOperationalCssColors(
  readFileSync(path.join(root, "apps/web/src/app/globals.css"),"utf8")
);
const nonPrintColorLiterals = inlineStyle.filter(item =>
  item.colorLiteral && !item.source.includes("/templates/pdf/") &&
  !item.source.includes("/print/") && !item.source.includes("/pdf/"));
const unexpectedCss = cssFiles.filter(item =>
  item.path !== "apps/web/src/app/globals.css" &&
  item.path !== "apps/web/src/app/theme-print.css" &&
  !item.path.includes("/print/") && !item.path.includes("/_print/"));
const keys = {
  entrypoints:report.entrypoints,operationalEntrypoints:report.operationalEntrypoints,
  totalNodes:report.nodes,tsx:report.tsx,ts:report.ts,css:styles.length,
  unresolvedImports:missing.length,computedImports:dynamic.length,
  chartModules:chartSources.length,inlineStyles: inlineStyle.length,
  inlineColorLiterals:inlineStyle.filter(x=>x.colorLiteral).length,
  colorProps: propColors.length,
  jsxOutsideTree:missedOperational.length,
  protectedTransitiveComponents:transitiveComponents.length,
  approvedTransitiveFixedClasses:approvedClassCount,
  unapprovedTransitiveFixedClasses:unexpectedTransitiveClasses.length,
};
console.log("KLASSE THEME TRANSITIVE AUDIT:", JSON.stringify(keys));
for(const [group,arr,max] of [["UNRESOLVED",missing,22],["DYNAMIC",dynamic,35],["CHART",chartSources,30],["INLINE",inlineStyle.filter(x=>x.colorLiteral),95],["COLOR-PROPS",propColors,45],["CSS",cssFiles,25]]) {
  console.log("\n"+group+" ("+arr.length+")");
  for(const item of arr.slice(0,max))console.log(JSON.stringify(item));
}


if (process.argv.includes("--check")) {
  const failures = [];
  if(missing.length) failures.push("Unresolved project imports: "+missing.length);
  if(dynamic.length) failures.push("Computed dynamic imports requiring manual resolution: "+dynamic.length);
  if(nonPrintColorLiterals.length) failures.push("Operational inline fixed colors: "+
    nonPrintColorLiterals.map(x=>x.source+":"+x.line).join(", "));
  if(unexpectedCss.length) failures.push("New CSS files requiring theme review: "+
    unexpectedCss.map(x=>x.path).join(", "));
  if(globalCssColorViolations.length) failures.push("Unscoped fixed colors in globals.css: "+globalCssColorViolations.join(", "));
  if(unreviewedExceptions.length) failures.push("Undocumented theme exceptions: "+unreviewedExceptions.join(", "));
  if(unexpectedTransitiveClasses.length) failures.push("New fixed colors in indirectly imported UI: "+
    JSON.stringify(unexpectedTransitiveClasses.slice(0,25)));
  if(failures.length) {
    for(const failure of failures)console.error("FAIL:",failure);
    process.exitCode = 1;
  } else {
    console.log("PASS: transitive imports, dynamic imports, operational inline colors and CSS inventory");
  }
}
