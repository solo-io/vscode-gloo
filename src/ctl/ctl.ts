/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import path = require("path");
import * as vscode from "vscode";
import { CliCommand } from "../cli";
import { FS } from "../fs";
import { Host } from "../host";
import { Shell } from "../shell";

export interface ExecOpts{
  cwd: string 
  name: string
  shared: boolean
}
export interface Context {
    readonly host: Host;
    readonly fs: FS;
    readonly shell: Shell;
    binFound: boolean;
    binPath: string;
}

export enum CheckPresentMode {
    Alert,
    Silent
}

export class ToolVersionInfo {
  readonly currentVersion: string;
  readonly availableVersion: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function verbose(_target: unknown, key: string, descriptor: any): void {
  let fnKey: string | undefined;
  // eslint-disable-next-line @typescript-eslint/ban-types
  let fn: Function;

  if (typeof descriptor.value === "function") {
    fnKey = "value";
    fn = descriptor.value;
  } else {
    throw new Error("not supported");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  descriptor[fnKey] = function (...args: any[]) {
    const v: number = vscode.workspace.getConfiguration("vs-gloo").get("outputVerbosityLevel");
    const command: CliCommand = fn.apply(this, args);
    if (v > 0) {
      command.cliArguments.push("-v", v.toString());
    }
    return command;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dryRun(_target: unknown, key: string, descriptor: any): void {
  let fnKey: string | undefined;
  // eslint-disable-next-line @typescript-eslint/ban-types
  let fn: Function;

  if (typeof descriptor.value === "function") {
    fnKey = "value";
    fn = descriptor.value;
  } else {
    throw new Error("not supported");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  descriptor[fnKey] = function (...args: any[]) {
    const command: CliCommand = fn.apply(this, args);
    command.cliArguments.push("--dry-run");
    return command;
  };
}

export function addToolPathToEnv(toolLocation: string,env = process.env): NodeJS.ProcessEnv{
  const toolPath = path.dirname(toolLocation);
  const finalEnv: NodeJS.ProcessEnv = {};
  Object.assign(finalEnv, env);
  const key = process.platform === "win32" ? "Path" : "PATH";
  if (toolPath && env[key] && !env[key].includes(toolPath)) {
    finalEnv[key] = `${toolPath}${path.delimiter}${env[key]}`;
  }
  return finalEnv;
}
