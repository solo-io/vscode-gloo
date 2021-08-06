/* eslint-disable header/header */

/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

export async function showWorkspaceFolderPick(): Promise<vscode.WorkspaceFolder | undefined> {
  if (!vscode.workspace.workspaceFolders) {
    vscode.window.showErrorMessage("This command requires an open folder.");
    return undefined;
  } else if (vscode.workspace.workspaceFolders.length === 1) {
    return vscode.workspace.workspaceFolders[0];
  }
  return await vscode.window.showWorkspaceFolderPick();
}
