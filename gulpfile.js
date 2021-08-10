/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
const { src, dest, series } = require("gulp");
const { createGulpEsbuild } = require("gulp-esbuild");
const gulpEsbuild = createGulpEsbuild({
  incremental: true,
  pipe: true,
});
const rimraf = require("rimraf");
const vsce = require("vsce");

const buildOpts = {
  bundle: true,
  external: ["vscode", "shelljs", "bufferutil", "utf-8-validate", "spawn-sync"],
  platform: "node",
  format: "cjs",
  outfile: "extension.js",
  write: true,
};

function clean(cb) {
  rimraf.sync("./out");
  cb();
}

function build() {
  const prodBuildOpts = Object.assign({ minify: true }, buildOpts);
  return src("./src/extension.ts")
    .pipe(gulpEsbuild(prodBuildOpts))
    .pipe(dest("./out"));
}

function package() {
  return vsce.createVSIX({ useYarn: true });
}

exports.clean = clean;
exports.build = build;
exports.package = package;
exports.default = series(clean, build);
