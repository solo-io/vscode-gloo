/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { host } from "./host";
import { shell } from "./shell";
import { fs } from "./fs";
import * as k8s from "vscode-kubernetes-tools-api";
import { registerYamlSchemaSupport } from "./yaml-support/gloo-yaml-schemas";

import { create as GlooCtl } from "./ctl/glooctl";
import { create as GlooMeshCtl } from "./ctl/meshctl";
import { GlooEdgeExplorer } from "./tree/glooEdgeExplorer";
import { checkClusterStatus } from "./utils/clusterChecks";
import { glooVfsProvider, GLOO_RESOURCE_SCHEME } from "./utils/glooVfsPovider";
import { GlooItem } from "./glooItem";
import { Kind } from "./kind/kind";
import { initPluginDirs } from "./installer/installationlayout";

export let contextGlobalState: vscode.ExtensionContext;
let k8sExplorer: k8s.ClusterExplorerV1 | undefined = undefined;

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  
  contextGlobalState = context;

  const initDirsResult = await initPluginDirs(shell);

  if (initDirsResult){
    vscode.window.showErrorMessage(`Error activating extension ${initDirsResult}`);
    return;
  }

  const kubectl = await k8s.extension.kubectl.v1;

  const glooctl = GlooCtl(host, fs, shell, kubectl);
  glooctl.checkUpgradeAvailable();
  const meshctl = GlooMeshCtl(host, fs, shell, kubectl);
  meshctl.checkUpgradeAvailable();

  const glooEdgeExplorer = new GlooEdgeExplorer(glooctl);

  const kind = Kind(host, fs, shell, kubectl);
  kind.checkUpgradeAvailable();
  kind.setExplorer(glooEdgeExplorer);

  //Commands
  const disposables = [
    vscode.commands.registerCommand("vscode-gloo.gloo.explorer", () =>
      glooEdgeExplorer.refresh()
    ),
    vscode.commands.registerCommand("vscode-gloo.gloo.edge.about", () =>
      glooctl.about()
    ),
    vscode.commands.registerCommand("vscode-gloo.gloo.edge.check", () =>
      glooctl.check()
    ),
    vscode.commands.registerCommand("vscode-gloo.gloo.edge.install", () =>
      glooctl.install("gateway")
    ),
    vscode.commands.registerCommand("vscode-gloo.gloo.edge.uninstall", () =>
      glooctl.uninstall("gateway")
    ),
    vscode.commands.registerCommand("vscode-gloo.gloo.mesh.about", () =>
      meshctl.about()
    ),
    vscode.commands.registerCommand("vscode-gloo.gloo.mesh.check", () =>
      meshctl.check()
    ),
    vscode.commands.registerCommand("vscode-gloo.gloo.mesh.install", () =>
      meshctl.install()
    ),
    vscode.commands.registerCommand("vscode-gloo.gloo.mesh.uninstall", () =>
      meshctl.uninstall()
    ),
    vscode.commands.registerCommand(
      "vscode-gloo.gloo.edge.explorer.refresh",
      () => glooEdgeExplorer.refresh()
    ),
    vscode.commands.registerCommand("vscode-gloo.kind.create", () =>
      kind.create()
    ),
    vscode.commands.registerCommand("vscode-gloo.kind.stop", () => kind.stop()),
    vscode.commands.registerCommand("vscode-gloo.kind.delete", () =>
      kind.delete()
    ),
    vscode.commands.registerCommand("vscode-gloo.openInEditor", (context) =>
      GlooItem.openInEditor(context, "vscode-gloo.openInEditor")
    ),
    glooEdgeExplorer,
    vscode.workspace.registerFileSystemProvider(
      GLOO_RESOURCE_SCHEME,
      glooVfsProvider,
      { isCaseSensitive: true }
    ),
  ];

  disposables.forEach((e) => context.subscriptions.push(e));

  //Tree View Data Providers
  vscode.window.registerTreeDataProvider(
    "vscode-gloo.gloo.edge.explorer",
    glooEdgeExplorer
  );

  //Add to k8s explorer
  const k8sExplorerApi = await k8s.extension.clusterExplorer.v1;
  if (k8sExplorerApi.available) {
    k8sExplorer = k8sExplorerApi.api;
    //Gloo Edge Resources
    const glooEdgeNodeContributor = k8sExplorer.nodeSources
      .groupingFolder(
        "Gloo Edge",
        "context",
        k8sExplorer.nodeSources
          .resourceFolder(
            "Auth Configs",
            "Auth Configs",
            "AuthConfig",
            "authconfigs"
          )
          .if(isGlooEdgeResource),
        k8sExplorer.nodeSources
          .resourceFolder("Gateways", "Gateways", "Gateway", "gateways")
          .if(isGlooEdgeResource),
        k8sExplorer.nodeSources
          .resourceFolder("Proxies", "Proxy", "Proxy", "proxies")
          .if(isGlooEdgeResource),
        k8sExplorer.nodeSources
          .resourceFolder("Settings", "Settings", "Setting", "settings")
          .if(isGlooEdgeResource),
        k8sExplorer.nodeSources
          .resourceFolder(
            "Rate Limit Configs",
            "Rate Limit Configs",
            "RateLimitConfig",
            "ratelimitconfigs"
          )
          .if(isGlooEdgeResource),
        k8sExplorer.nodeSources
          .resourceFolder(
            "Route Options",
            "Route Options",
            "RouteOption",
            "routeoptions"
          )
          .if(isGlooEdgeResource),
        k8sExplorer.nodeSources
          .resourceFolder(
            "Route Tables",
            "Route Tables",
            "RouteTable",
            "routetables"
          )
          .if(isGlooEdgeResource),
        k8sExplorer.nodeSources
          .resourceFolder(
            "Upstream Groups",
            "Upstream Groups",
            "UpstreamGroup",
            "upstreamgroups"
          )
          .if(isGlooEdgeResource),
        k8sExplorer.nodeSources
          .resourceFolder("Upstreams", "Upstreams", "Upstream", "upstreams")
          .if(isGlooEdgeResource),
        k8sExplorer.nodeSources
          .resourceFolder(
            "Virtual Host Options",
            "Virtual Host Options",
            "VirtualHostOption",
            "virtualhostoptions"
          )
          .if(isGlooEdgeResource),
        k8sExplorer.nodeSources
          .resourceFolder(
            "Virtual Services",
            "Virtual Services",
            "VirtualService",
            "virtualservice"
          )
          .if(isGlooEdgeResource)
      )
      .at(undefined);
    k8sExplorer.registerNodeContributor(glooEdgeNodeContributor);
    //Gloo Mesh Resources
    const glooMeshNodeContributor = k8sExplorer.nodeSources
      .groupingFolder(
        "Gloo Mesh",
        "context",
        k8sExplorer.nodeSources
          .resourceFolder(
            "Access Log Records",
            "Access Log Records",
            "AccessLogRecord",
            "accesslogrecords"
          )
          .if(isGlooMeshResource),
        k8sExplorer.nodeSources
          .resourceFolder(
            "Access Polices",
            "Access Policies",
            "AccessPolicy",
            "accesspolicies"
          )
          .if(isGlooMeshResource),
        k8sExplorer.nodeSources
          .resourceFolder(
            "Destinations",
            "Destinations",
            "Destination",
            "destinations"
          )
          .if(isGlooMeshResource),
        k8sExplorer.nodeSources
          .resourceFolder("Meshes", "Meshes", "Mesh", "meshes")
          .if(isGlooMeshResource),
        k8sExplorer.nodeSources
          .resourceFolder("Roles", "Roles", "Role", "role")
          .if(isGlooMeshResource),
        k8sExplorer.nodeSources
          .resourceFolder(
            "Role Bindings",
            "Role Bindings",
            "Role Binding",
            "rolebinding"
          )
          .if(isGlooMeshResource),
        k8sExplorer.nodeSources
          .resourceFolder("Settings", "Settings", "Setting", "settings")
          .if(isGlooMeshResource),
        k8sExplorer.nodeSources
          .resourceFolder(
            "Traffic Polices",
            "Traffic Policies",
            "TrafficPolicy",
            "trafficpolicy"
          )
          .if(isGlooMeshResource),
        k8sExplorer.nodeSources
          .resourceFolder(
            "Virtual Destinations",
            "Virtual Destinations",
            "VirtualDestination",
            "virtualdestinations"
          )
          .if(isGlooMeshResource),
        k8sExplorer.nodeSources
          .resourceFolder(
            "Virtual Mesh",
            "Virtual Meshes",
            "VirtualMesh",
            "virtualmeshes"
          )
          .if(isGlooMeshResource),
        k8sExplorer.nodeSources
          .resourceFolder(
            "WASM Deployments",
            "WASM Deployments",
            "WasmDeployment",
            "wasmdeployments"
          )
          .if(isGlooMeshResource),
        k8sExplorer.nodeSources
          .resourceFolder("Workloads", "Workloads", "Workload", "workloads")
          .if(isGlooMeshResource)
      )
      .at(undefined);
    k8sExplorer.registerNodeContributor(glooMeshNodeContributor);
  }

  //
  await checkClusterStatus();

  const configurationApi = await k8s.extension.configuration.v1_1;
  if (configurationApi.available) {
    const confApi = configurationApi.api;
    confApi.onDidChangeContext(async () => {
      await checkClusterStatus();
      glooEdgeExplorer.refresh();
    });
  }

  registerYamlSchemaSupport(context);
}

// this method is called when your extension is deactivated
// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate(): void {}

async function isGlooEdgeResource(): Promise<boolean> {
  const kubectl = await k8s.extension.kubectl.v1;
  if (kubectl.available) {
    const sr = await kubectl.api.invokeCommand("api-versions");
    if (!sr || sr.code !== 0) {
      return false;
    }
    return sr.stdout.includes("solo.io/"); // Naive check to keep example simple!
  }
}

async function isGlooMeshResource(): Promise<boolean> {
  const kubectl = await k8s.extension.kubectl.v1;
  if (kubectl.available) {
    const sr = await kubectl.api.invokeCommand("api-versions");
    if (!sr || sr.code !== 0) {
      return false;
    }
    return sr.stdout.includes("mesh.gloo.solo.io/"); // Naive check to keep example simple!
  }
  return false;
}
