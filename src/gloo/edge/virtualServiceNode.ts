/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ProviderResult, TreeItem, TreeItemCollapsibleState } from "vscode";
import { GlooEdgeNode, GlooEdgeNodeImpl, NodeState } from "../glooEdgeNode";
import format = require("string-format");
import { ContextType } from "./contextTypes";
import * as _ from "lodash";
import { DomainNode } from "./domainNode";
import { RouteMatcherNode } from "./routeMatcherNode";
import { GlooCtl } from "../../ctl/glooctl";

export class VirtualServiceNode extends GlooEdgeNodeImpl{
  //TODO change this right concreate object for virutal service
  constructor(
    private readonly virtualService: any,
    glooctl: GlooCtl,
    collapsibleState: TreeItemCollapsibleState
  ){
    super(glooctl,undefined,virtualService.metadata.name,ContextType.VIRTUALSERVICE,virtualService.metadata.namespace,NodeState[virtualService.status.state],virtualService.metadata.uid,virtualService.metadata.creationTimestamp,collapsibleState);
    // add command that will be invoke on double click of the node 
    (this as TreeItem).command = { command: "vscode-gloo.openInEditor",title: "Open Manifest",arguments:[this]};
  }

  get label(): string {
    return this.name;
  }

  get tooltip(): string {
    return format(`${this.CONTEXT_DATA[this.contextValue].tooltip}`, this);
  }

  getChildren(): ProviderResult<GlooEdgeNode[]> {
    //console.log("vs:childs")
    let children: GlooEdgeNode[];
    if (this.virtualService){
      //console.log(JSON.stringify(this.virtualService))
      const vhost = this.virtualService.spec.virtualHost;
      if (vhost){
      // add domains
        children = _.concat(children,
          vhost.domains
            .map(domain => 
              new DomainNode(this,domain)
            )
        );
        //Route Matchers
        const routes = vhost.routes;
        if (routes){
          routes.map((r) => {
            //console.log(`matcher:${JSON.stringify(r)}`)
            children = _.concat(children, 
              r.matchers
                .map((matcher)=>{
                  let name: string;
                  if (matcher.exact){
                    name = matcher.exact;
                  } else if (matcher.prefix){
                    name = matcher.prefix;
                  } else if (matcher.regex){
                    name = matcher.regex;
                  }
                  //console.log(`matcher:${name}`)
                  return new RouteMatcherNode(
                    this,
                    r,
                    this.glooctl,
                    TreeItemCollapsibleState.Collapsed,
                    name,
                    this.getNamespace());
                })
            );
          });
        }
      }
      //console.log(`vs::route::child count:${children.length}`)
    }
    return children;
  }

}
