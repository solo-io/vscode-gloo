/* eslint-disable header/header */

/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

export async function refreshExplorer(): Promise<void> {
  await vscode.commands.executeCommand("extension.vsKubernetesRefreshExplorer");
}
