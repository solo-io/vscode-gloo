/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window, TreeItemCollapsibleState } from "vscode";
import { getDefaultGlooNamespace } from "../config/config";
import { VirtualServiceNode } from "./edge/virtualServiceNode";
import { GlooEdgeNode } from "./glooEdgeNode";
import * as k8s from "vscode-kubernetes-tools-api";
import { UpstreamNode } from "./edge/upstreamNode";
import * as _ from "lodash";
import { checkGlooEdgeServerStatus } from "../utils/clusterChecks";
import { GlooCtl } from "../ctl/glooctl";

//TODO set the namespace is project settings
export async function getVirutalServices(
  glooctl: GlooCtl
): Promise<GlooEdgeNode[]> {
  const glooEdgeOK = await checkGlooEdgeServerStatus(glooctl);
  if (glooEdgeOK !== null) return glooEdgeOK;

  const kubectl = await k8s.extension.kubectl.v1;
  let gNodes: VirtualServiceNode[];
  if (kubectl.available) {
    const commandArgs = [
      "--namespace",
      getDefaultGlooNamespace(),
      "get",
      "virtualservices",
      "--output",
      "json",
    ];
    const vsResult = await kubectl.api.invokeCommand(commandArgs.join(" "));
    if (vsResult.stderr) {
      console.error(vsResult.stderr);
      window.showErrorMessage(
        `Error getting Virutal Services: ${vsResult.stderr}`
      );
      return [];
    }
    try {
      const virutalServices = JSON.parse(vsResult.stdout.trim()).items;
      //TODO sort
      gNodes = virutalServices.map((item) => new VirtualServiceNode(item,
        glooctl,
        TreeItemCollapsibleState.Collapsed
      )
      );
      // eslint-disable-next-line no-empty
    } catch (ignore) {}
  }
  console.debug(`Got ${gNodes.length} virtualservices`);
  return gNodes;
}

//TODO set the namespace is project settings
export async function getUpstreams(glooctl: GlooCtl): Promise<GlooEdgeNode[]> {
  const glooEdgeOK = await checkGlooEdgeServerStatus(glooctl);
  if (glooEdgeOK !== null) return glooEdgeOK;

  const kubectl = await k8s.extension.kubectl.v1;

  if (kubectl.available) {
    let gNodes: VirtualServiceNode[];
    const commandArgs = [
      "--namespace",
      getDefaultGlooNamespace(),
      "get",
      "upstreams",
      "--output",
      "json",
    ];
    const vsResult = await kubectl.api.invokeCommand(commandArgs.join(" "));
    if (vsResult.stderr) {
      window.showErrorMessage(`Error getting Upstreams: ${vsResult.stderr}`);
      return [];
    }
    try {
      const upstreams = JSON.parse(vsResult.stdout).items;
      //TODO sort
      gNodes = upstreams.map(
        (item) => new UpstreamNode(glooctl, item, TreeItemCollapsibleState.None)
      );
      // eslint-disable-next-line no-empty
    } catch (ignore) {}
    console.log(`Got ${gNodes.length} upstreams`);
    return gNodes;
  }

  return [];
}

export async function getUpstreamsForRoute(
  glooctl: GlooCtl,
  route: any
): Promise<GlooEdgeNode[]> {
  const upstreams: GlooEdgeNode[] = await getUpstreams(glooctl);
  const single = route.routeAction?.single;
  const multiple = route.routeAction?.multiple;
  if (upstreams && upstreams.length > 0) {
    if (single) {
      console.log("Single");
      const upstream = single.upstream;
      return upstreams.filter(
        (u) =>
          u.getName() === upstream.name && u.getNamespace() === u.getNamespace()
      );
    } else if (multiple) {
      console.log("Multiple");
      const multiples: any = multiple.upstream;
      if (multiples) {
        return _.intersectionWith(
          upstreams,
          multiples,
          (a, b: any) =>
            a.getName() === b.name && a.getNamespace() === b.namespace
        );
      }
    }
  }
  return [];
}
