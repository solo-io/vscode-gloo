/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { commands } from "vscode";
import { CliExitData } from "../cli";
import { GlooCtl } from "../ctl/glooctl";
import { MeshCtl } from "../ctl/meshctl";
import * as k8s from "vscode-kubernetes-tools-api";
import { GlooEdgeNode } from "../gloo/glooEdgeNode";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const k8sClusterCheck = RegExp(
  "Unable to connect to the server|The connection to the server localhost:8080 was refused"
);

export async function checkClusterStatus(): Promise<GlooEdgeNode[]> {
  const kubectl = await k8s.extension.kubectl.v1;
  if (kubectl.available) {
    const sr = await kubectl.api.invokeCommand("cluster-info");
    if (!sr || sr.code !== 0) {
      commands.executeCommand("setContext", "gloo.cluster", true);
      commands.executeCommand("setContext", "gloo.edge", false);
      commands.executeCommand("setContext", "gloo.mesh", false);
      return [];
    }
    commands.executeCommand("setContext", "gloo.cluster", false);
    return null;
  } else {
    return [];
  }
}

export async function checkGlooEdgeServerStatus(
  glooctl: GlooCtl
): Promise<GlooEdgeNode[]> {
  if ((await checkClusterStatus()) !== null) return [];

  const serverEdgeRegx = new RegExp(/^Server:\s*version undefined.*$/);
  const result: CliExitData = await glooctl.execute(["version"]);

  if (result.stdout) {
    const resultOut = result.stdout.trim().split("\n");
    const glooEdgeStatus = serverEdgeRegx.test(resultOut[1]);
    commands.executeCommand("setContext", "gloo.edge", glooEdgeStatus);
    return glooEdgeStatus ? [] : null;
  }

  return null;
}

export async function checkGlooMeshServerStatus(
  meshctl: MeshCtl
): Promise<GlooEdgeNode[]> {
  if ((await checkClusterStatus()) !== null) return [];

  const result: CliExitData = await meshctl.execute(["version"]);
  const resultOut = result.stdout;
  if (resultOut) {
    const resultJson: any = JSON.parse(resultOut);
    const glooMeshStatus = resultJson.server === null;
    commands.executeCommand("setContext", "gloo.mesh", glooMeshStatus);
    return [];
  }

  return null;
}
