/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window, workspace } from "vscode";
import { getOutputFormat } from "./config/config";
import { GlooCtl } from "./ctl/glooctl";
import { GlooEdgeNode } from "./gloo/glooEdgeNode";
import { GlooEdgeExplorer } from "./tree/glooEdgeExplorer";
import { glooFSUri } from "./utils/glooVfsPovider";


export abstract class GlooItem {
  static readonly glooctl: GlooCtl;
  static readonly glooEdgeExplorer: GlooEdgeExplorer;

  static validateUniqueName(data: Array<GlooEdgeNode>, value: string): string {
    const glooEdgeNode = data.find((glooEdgeNode) => glooEdgeNode.getName() === value);
    return glooEdgeNode && "This name is already used, please enter different name.";
  }

  static openInEditor(context: GlooEdgeNode,commandId?: string): void{
    const name = context.getName();
    const namespace = context.getNamespace();
    GlooItem.loadGlooResource(context.contextValue,namespace, name, context.uid, commandId);
  }

  static loadGlooResource(type: string,namespace:string, name: string, uid: string, commandId?: string): void {
    const outputFormat = getOutputFormat();
    const uri = glooFSUri(type, namespace,name, outputFormat, uid);
    workspace.openTextDocument(uri).then((doc) => {
      if (doc) {
        window.showTextDocument(doc, { preserveFocus: true, preview: true });
      }
    }, (err) => {
      window.showErrorMessage(`Error loading document: ${err}`);
    });
  }
}
