import { readFileSync } from "node:fs";
const [treePath,auditPath,exit] = process.argv.slice(2);
const roots=["@tiptap/react","@tiptap/pm","@tiptap/starter-kit","mathlive","katex"];
const projects=JSON.parse(readFileSync(treePath,"utf8"));
const web=projects.find(p=>p.name==="web");
if(!web)throw new Error("Missing web dependency tree");
const nodes=new Map();
function visit(name,node){
 if(!node?.version)throw new Error("Missing dependency version: "+name);
 const versions=nodes.get(name)??new Set();
 versions.add(node.version);nodes.set(name,versions);
 for(const [key,value] of Object.entries(node.dependencies??{}))visit(key,value);
 for(const [key,value] of Object.entries(node.optionalDependencies??{}))visit(key,value);
}
for(const name of roots){
 const node=web.dependencies?.[name];if(!node)throw new Error("Missing editor dependency: "+name);
 visit(name,node);
}
const report=JSON.parse(readFileSync(auditPath,"utf8"));
if(report.error||!report.metadata?.vulnerabilities||!report.advisories||typeof report.advisories!=="object")throw new Error("Audit unavailable or invalid response; fail closed.");
const advisories=Object.values(report.advisories);
if(Number(exit)!==0&&advisories.length===0)throw new Error("Audit exited unsuccessfully without advisories.");
const relevant=advisories.filter(a=>nodes.has(a.module_name));
for(const a of relevant)console.log(a.severity,a.module_name,a.title,a.url);
console.log("Editor graph:",nodes.size,"packages; relevant advisories:",relevant.length,"; repository advisories:",advisories.length);
// Conservative: any high/critical advisory for a package in the new graph blocks
// until its installed version is reviewed; no silent exception for unrelated paths.
if(relevant.some(a=>["high","critical"].includes(a.severity)))process.exitCode=1;
