/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ProviderResult, TreeItemCollapsibleState, Uri } from "vscode";
import { GlooEdgeNode,GlooEdgeNodeImpl } from "../glooEdgeNode";
import { ContextType } from "./contextTypes";
import * as path from "path";
import { getUpstreamsForRoute } from "../resourceHelper";
import { GlooCtl } from "../../ctl/glooctl";


export class RouteMatcherNode extends GlooEdgeNodeImpl{
  
  constructor(
    parent: GlooEdgeNode,
    private readonly route: any,
    glooctl: GlooCtl,
    collapsibleState: TreeItemCollapsibleState,
    name: string,
    namespace:string
  ){
    super(glooctl,parent,name,ContextType.ROUTE,namespace,"","","",collapsibleState);
  }

  get iconPath(): Uri {
    const iPath = path.join(__dirname,"../../../../images","route.svg");
    return Uri.file(iPath);
  }

  get label(): string {
    return this.name;
  }

  getChildren(): ProviderResult<GlooEdgeNode[]> {
    //console.log(`rm::childs::\n${JSON.stringify(this.route)}`)
    if (this.route){
      return getUpstreamsForRoute(this.glooctl,this.route);
    }
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
