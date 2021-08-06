/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ProviderResult, TreeItem, TreeItemCollapsibleState, Uri } from "vscode";
import { GlooEdgeNode,GlooEdgeNodeImpl, NodeState } from "../glooEdgeNode";
import { ContextType } from "./contextTypes";
import * as path from "path";
import { GlooCtl } from "../../ctl/glooctl";


export class UpstreamNode extends GlooEdgeNodeImpl{
  
  constructor(
    glooctl: GlooCtl,
    private readonly upstream: any,
    collapsibleState: TreeItemCollapsibleState,
  ){
    super(glooctl,undefined,upstream.metadata.name,ContextType.UPSTREAM,upstream.metadata.namespace,NodeState[upstream.status.state],upstream.metadata.uid,upstream.metadata.creationTimestamp,collapsibleState);
    // add command that will be invoke on double click of the node 
    (this as TreeItem).command = { command: "vscode-gloo.openInEditor",title: "Open Manifest",arguments:[this]};
  }

  get iconPath(): Uri {
    const iPath = path.join(__dirname,"../../../../images","stream.svg");
    return Uri.file(iPath);
  }

  get label(): string {
    return this.name;
  }

  getChildren(): ProviderResult<GlooEdgeNode[]> {
    throw new Error("Method not implemented.");
  }

  getParent(): GlooEdgeNode {
    return this.parent;
  }

  getName(): string {
    return this.label;
  }

  refresh(): Promise<void> {
    return Promise.resolve();
  }

}
