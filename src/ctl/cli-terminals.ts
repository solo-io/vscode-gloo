/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Context } from "./ctl";
import { Terminal } from "vscode";

export async function invokeInTerminal(context: Context, command: string, pipeTo: string | undefined, terminal: Terminal): Promise<void> {
  const fullCommand = pipeTo ? `${command} | ${pipeTo}` : command;
  terminal.sendText(fullCommand);
  terminal.show();
}
