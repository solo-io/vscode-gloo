/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ProviderResult, TreeItemCollapsibleState, Uri } from "vscode";
import { GlooEdgeNode,GlooEdgeNodeImpl } from "../glooEdgeNode";
import { ContextType } from "./contextTypes";
import * as path from "path";


export class DomainNode extends GlooEdgeNodeImpl{
  
  constructor(
    parent: GlooEdgeNode,
    name:string
  ){
    super(null,parent,name,ContextType.STRING,"","","","",TreeItemCollapsibleState.None);
  }

  get iconPath(): Uri {
    const iPath = path.join(__dirname,"../../../../images","domain.svg");
    return Uri.file(iPath);
  }

  get label(): string {
    return this.name === "*" ? "any domain" : this.name;
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
