/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { commands } from "vscode";
import { CliCommand, createCliCommand } from "./cli";

export enum VSCodeCommands {
  SetContext = "setContext",
}

export enum CommandContext {
  GlooCli = "gloo:glooctl",
  GlooMeshCli = "gloo:meshctl",
}

export function setCommandContext(key: CommandContext | string, value: string | boolean): PromiseLike<void> {
  return commands.executeCommand(VSCodeCommands.SetContext, key, value);
}

export function newK8sCommand(...k8sArguments: string[]): CliCommand {
  return createCliCommand("kubectl", ...k8sArguments);
}
