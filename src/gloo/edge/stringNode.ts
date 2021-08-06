/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { TreeItemCollapsibleState } from "vscode";
import { GlooEdgeNode,GlooEdgeNodeImpl } from "../glooEdgeNode";
import { ContextType } from "./contextTypes";


export class StringNode extends GlooEdgeNodeImpl{
  
  constructor(
    parent: GlooEdgeNode,
    name:string
  ){
    super(null,parent,name,ContextType.STRING,"","","","",TreeItemCollapsibleState.None);
  }
}
