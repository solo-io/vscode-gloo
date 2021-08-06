/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from "vscode";

import { schemeStorage } from "./gloo-schema-storage";
import { readFile } from "fs-extra";



export function generateScheme(vsDocument: vscode.TextDocument, schemaPath: string): Promise<string> {

  return schemeStorage.getScheme(vsDocument, doc => generate(doc, schemaPath));
}


async function generate(doc: vscode.TextDocument, schemaPath: string): Promise<string> {
  const template = await readFile(schemaPath, "UTF8");
  return template;
}
