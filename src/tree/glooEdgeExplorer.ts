/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
  TreeDataProvider,
  TreeView,
  Disposable,
  TreeItem,
  Event,
  window,
  ProviderResult,
  extensions,
  commands,
  Uri,
  version,
  EventEmitter,
} from "vscode";
import { GlooCtl } from "../ctl/glooctl";
import { shell } from "../shell";
import { GlooEdgeNode } from "../gloo/glooEdgeNode";
import { getVirutalServices } from "../gloo/resourceHelper";

const VS_TREE_VIEW_ID = "vscode-gloo.gloo.edge.explorer";

export class GlooEdgeExplorer
implements TreeDataProvider<GlooEdgeNode>, Disposable
{
  private treeView: TreeView<GlooEdgeNode>;

  private onDidChangeTreeDataEmitter: EventEmitter<GlooEdgeNode | undefined> =
    new EventEmitter<GlooEdgeNode | undefined>();
  readonly onDidChangeTreeData: Event<GlooEdgeNode | undefined> =
    this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly glooctl: GlooCtl) {
    this.treeView = window.createTreeView(VS_TREE_VIEW_ID, {
      treeDataProvider: this,
      showCollapseAll: true,
    });
    glooctl.setExplorer(this);
  }

  getTreeItem(element: GlooEdgeNode): TreeItem {
    return element;
  }

  getChildren(element?: GlooEdgeNode): ProviderResult<GlooEdgeNode[]> {
    console.debug("ge::getChildren");
    if (element) {
      return element.getChildren();
    }
    return getVirutalServices(this.glooctl);
  }

  getParent?(element: GlooEdgeNode): ProviderResult<GlooEdgeNode> {
    return element.getParent();
  }

  async refresh(target?: GlooEdgeNode): Promise<void> {
    if (target) {
      await target.refresh();
    }
    this.onDidChangeTreeDataEmitter.fire(target);
  }

  async reveal(item: GlooEdgeNode): Promise<void> {
    this.refresh(item.getParent());
    this.treeView.reveal(item);
  }

  dispose(): void {
    this.treeView.dispose();
  }

  getSelection(): GlooEdgeNode[] | undefined {
    return this.treeView.selection;
  }

  isVisible(): boolean {
    return this.treeView.visible;
  }

  static async reportIssue(): Promise<void> {
    let body = "";
    const repoURL = "https://github.com/kameshsampath/vscode-gloo";
    const template = {
      "VS Code version:": version,
      "OS:": shell.platform(),
      "Extension version:": extensions.getExtension("kameshsampath.vscode-gloo")
        .packageJSON.version,
    };
    for (const [key, value] of Object.entries(template)) {
      body = `${body}${key} ${value}\n`;
    }
    return commands.executeCommand(
      "vscode.open",
      Uri.parse(
        `${repoURL}/issues/new?labels=kind/bug&title=Issue&body=**Environment**\n${body}\n**Description**`
      )
    );
  }
}
