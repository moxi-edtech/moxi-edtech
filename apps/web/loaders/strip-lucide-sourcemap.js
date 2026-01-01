module.exports = function stripLucideSourceMap(source) {
  if (this && typeof this.cacheable === "function") {
    this.cacheable();
  }

  return source.replace(/\/\/\# sourceMappingURL=.*\.map\s*$/gm, "");
};
