module.exports = function stripLucideSourceMap(source) {
  if (this && typeof this.cacheable === "function") {
    this.cacheable();
  }

  const sourceText = Buffer.isBuffer(source) ? source.toString("utf8") : source;
  const stripped = sourceText.replace(/\/\/\# sourceMappingURL=.*\.map\s*$/gm, "");

  return Buffer.from(stripped, "utf8");
};
