/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { TreeItemCollapsibleState,ProviderResult,Uri, TreeItem } from "vscode";
import { GlooCtl } from "../ctl/glooctl";
import {ContextType} from "./edge/contextTypes";
import {IMAGES} from "../constants";
import format = require("string-format");
import * as path from "path";
import { getUpstreams, getVirutalServices } from "./resourceHelper";

export enum NodeState{
  ACCEPTED=1,
  REJECTED=0
}

export interface GlooEdgeNode extends TreeItem {
  getChildren(): ProviderResult<GlooEdgeNode[]>;
  getParent(): GlooEdgeNode | undefined;
  getNamespace(): string;
  getName(): string;
  refresh(): Promise<void>;
  glooctl: GlooCtl;
  contextValue?: string;
  state?: string;
  visibleChildren?: number;
  collapsibleState?: TreeItemCollapsibleState;
  uid?:string;
  creationTs?:string;
}

export class GlooEdgeNodeImpl implements GlooEdgeNode {
  
  protected readonly CONTEXT_DATA = {
    virtualservice:{
      icon: "gloo.svg",
      tooltip: "Virutal Service: {label}",
      getChildren: () => getVirutalServices(this.glooctl)
    },
    domainnode:{
      icon: "domain.svg",
      tooltip: "Domain: {label}",
      getChildren: []
    },
    routenode:{
      icon: "route.svg",
      tooltip: "Route: {label}",
      getChildren: []
    },
    upstream:{
      icon: "upstream.svg",
      tooltip: "Upstream: {label}",
      getChildren: () => getUpstreams(this.glooctl)
    },
    stringnode:{
      icon: "",
      tooltip: "{label}",
      getChildren: []
    }
  }
  constructor(
    public readonly glooctl: GlooCtl,
    public readonly parent: GlooEdgeNode,
    public readonly name: string,
    public readonly contextValue: ContextType,
    public readonly namespace: string,
    public readonly state?: string,
    public readonly uid?: string,
    public readonly creationTs?: string,
    public readonly collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.Collapsed,
    
  ){

  }

  get iconPath(): Uri {
    if (this.state) {
      const filePath = IMAGES;
      switch (this.state) {
        case NodeState.ACCEPTED.toString(): {
          return Uri.file(path.join(__dirname, IMAGES, "state-accepted.svg"));
        }
        case NodeState.REJECTED.toString(): {
          return Uri.file(path.join(__dirname, IMAGES, "state-rejected.svg"));
        }
        default: {
          return Uri.file(path.join(__dirname, filePath, this.CONTEXT_DATA[this.contextValue].icon));
        }
      }
    }
    return Uri.file(path.join(__dirname, IMAGES, this.CONTEXT_DATA[this.contextValue].icon));
  }

  get tooltip(): string {
    return format(this.CONTEXT_DATA[this.contextValue].tooltip, this);
  }

  get label(): string {
    return this.name;
  }

  getName(): string {
    return this.name;
  }

  getNamespace(): string {
    return this.namespace;
  }
  
  getChildren(): ProviderResult<GlooEdgeNode[]> {
    return this.CONTEXT_DATA[this.contextValue].getChildren();
  }

  getParent(): GlooEdgeNode {
    return this.parent;
  }

  refresh(): Promise<void> {
    return Promise.resolve();
  }
}
