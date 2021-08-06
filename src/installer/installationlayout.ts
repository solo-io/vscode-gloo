/* eslint-disable header/header */

//https://github.com/Azure/vscode-kubernetes-tools

/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as fs from "fs";

import { Platform, Shell } from "../shell";

export async function initPluginDirs(shell:Shell): Promise<boolean> {
  const pluginDirs = path.join(shell.home(), ".vs-gloo","tools");
  const pluginDirsExist = fs.existsSync(pluginDirs);
  if (pluginDirsExist) return pluginDirsExist;
  const result = await fs.promises.mkdir(pluginDirs,{recursive: true});
  return result === undefined;
}

export function baseInstallFolder(shell: Shell): string {
  return path.join(shell.home(), ".vs-gloo","tools");
}

export function getInstallFolder(shell: Shell, tool: string): string {
  return path.join(baseInstallFolder(shell), tool);
}

export function platformUrlString(platform: Platform, supported?: Platform[]): string | null {
  if (supported && supported.indexOf(platform) < 0) {
    return null;
  }
  switch (platform) {
    case Platform.Windows: return "windows";
    case Platform.MacOS: return "darwin";
    case Platform.Linux: return "linux";
    default: return null;
  }
}

export function formatBin(tool: string, platform: Platform): string | null {
  const platformString = platformUrlString(platform);
  if (!platformString) {
    return null;
  }
  const platformArchString = platformArch(platformString);
  const toolPath = `${platformString}-${platformArchString}/${tool}`;
  if (platform === Platform.Windows) {
    return toolPath + ".exe";
  }
  return toolPath;
}

export function platformArch(os: string) {
  if (os !== "linux") {
    return "amd64";
  }
  switch (process.arch) {
    case "arm": return "arm";
    case "arm64": return "arm64";
    default: return "amd64";
  }
}
