/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { Host } from "../host";
import { Shell } from "../shell";
import { Dictionary } from "../utils/dictionary";

const EXTENSION_CONFIG_KEY = "vscode-gloo";
const MS_KUBERENETES_EXTENSION_CONFIG_KEY = "vs-kubernetes";
const KUBECONFIG_PATH_KEY = "vs-kubernetes.kubeconfig";

export enum Platform {
    Windows,
    MacOS,
    Linux,
    Unsupported,  // shouldn't happen!
}

export function affectsUs(change: vscode.ConfigurationChangeEvent): boolean {
  return change.affectsConfiguration(EXTENSION_CONFIG_KEY);
}

// START Config set and update
export async function addPathToConfig(configKey: string, value: string): Promise<void> {
  await setConfigValue(configKey, value);
}

async function setConfigValue(configKey: string, value: any): Promise<void> {
  await atAllConfigScopes(addValueToConfigAtScope, configKey, value);
}

async function addValueToConfigAtScope(configKey: string, value: any, scope: vscode.ConfigurationTarget, valueAtScope: any, createIfNotExist: boolean): Promise<void> {
  if (!createIfNotExist) {
    if (!valueAtScope || !(valueAtScope[configKey])) {
      return;
    }
  }
  await vscode.workspace.getConfiguration().update(configKey, value, scope);
}

async function addValueToConfigArray(configKey: string, value: string): Promise<void> {
  await atAllConfigScopes(addValueToConfigArrayAtScope, configKey, value);
}

async function addValueToConfigArrayAtScope(configKey: string, value: string, scope: vscode.ConfigurationTarget, valueAtScope: any, createIfNotExist: boolean): Promise<void> {
  if (!createIfNotExist) {
    if (!valueAtScope || !(valueAtScope[configKey])) {
      return;
    }
  }

  let newValue: any = {};
  if (valueAtScope) {
    newValue = Object.assign({}, valueAtScope);
  }
  const arrayEntry: string[] = newValue[configKey] || [];
  arrayEntry.push(value);
  newValue[configKey] = arrayEntry;
  await vscode.workspace.getConfiguration().update(EXTENSION_CONFIG_KEY, newValue, scope);
}

type ConfigUpdater<T> = (configKey: string, value: T, scope: vscode.ConfigurationTarget, valueAtScope: any, createIfNotExist: boolean) => Promise<void>;

async function atAllConfigScopes<T>(fn: ConfigUpdater<T>, configKey: string, value: T): Promise<void> {
  const config = vscode.workspace.getConfiguration().inspect(EXTENSION_CONFIG_KEY)!;
  await fn(configKey, value, vscode.ConfigurationTarget.Global, config.globalValue, true);
  await fn(configKey, value, vscode.ConfigurationTarget.Workspace, config.workspaceValue, false);
  await fn(configKey, value, vscode.ConfigurationTarget.WorkspaceFolder, config.workspaceFolderValue, false);
}

//END -- Config set and update

// Use WSL on Windows

const USE_WSL_KEY = "use-wsl";

export function getUseWsl(): boolean {
  return vscode.workspace.getConfiguration()[USE_WSL_KEY];
}

export function getToolPath(_host: Host, shell: Shell, tool: string): string | undefined {
  const os = shell.platform();

  const baseKey = toolPathBaseKey(tool);
  const osKey = osOverrideKey(os, baseKey);

  const configs = 
                  vscode.workspace.getConfiguration().inspect<Dictionary<any>>(baseKey) || 
                  vscode.workspace.getConfiguration().inspect<Dictionary<any>>(osKey) || 
                  Dictionary.of<any>();

  const wsFolderValue = configs.workspaceFolderValue;
  const wsValue = configs.workspaceValue;
  const userValue = configs.globalValue;
  const defaultValue = configs.defaultValue;
  const globalValue = configs.globalValue;

  // get any one value that is avaible at various scopes
  const topLevelToolPath = 
        wsFolderValue ||
        wsValue ||
        userValue ||
        globalValue ||
        defaultValue;

  return topLevelToolPath;
}

export function toolPathOSKey(os: Platform, tool: string): string {
  const baseKey = toolPathBaseKey(tool);
  const osSpecificKey = osOverrideKey(os, baseKey);
  return osSpecificKey;
}

export function toolPathBaseKey(tool: string): string {
  return `${EXTENSION_CONFIG_KEY}.${tool}-path`;
}

function osOverrideKey(os: Platform, baseKey: string): string {
  const osKey = osKeyString(os);
  return osKey ? `${baseKey}.${osKey}` : baseKey;  // The 'else' clause should never happen so don't worry that this would result in double-checking a missing base key
}

function osKeyString(os: Platform): string | null {
  switch (os) {
    case Platform.Windows: return "windows";
    case Platform.MacOS: return "mac";
    case Platform.Linux: return "linux";
    default: return null;
  }
}

export function getActiveKubeconfig(): string {
  return vscode.workspace.getConfiguration(MS_KUBERENETES_EXTENSION_CONFIG_KEY)[KUBECONFIG_PATH_KEY];
}


// glooctl and meshctl upgrade checks
const GLOOCTL_CHECK_UPGRADE_KEY = `${EXTENSION_CONFIG_KEY}.glooctl.check-upgrade`;
const MESHCTL_CHECK_UPGRADE_KEY = `${EXTENSION_CONFIG_KEY}.meshctl.check-upgrade`;

export function getCheckForGlooctlUpgrade(): boolean {
  return vscode.workspace.getConfiguration().get(GLOOCTL_CHECK_UPGRADE_KEY);
}

export function getCheckForMeshctlUpgrade(): boolean {
  return vscode.workspace.getConfiguration().get(MESHCTL_CHECK_UPGRADE_KEY);
}

//Gloo Edge 
const GLOO_EDGE_NAMESPACE = `${EXTENSION_CONFIG_KEY}.edge-namespace`;
export function getDefaultGlooNamespace(): string {
  return vscode.workspace.getConfiguration().get(GLOO_EDGE_NAMESPACE);
}

const GLOO_EDGE_EDITION = `${EXTENSION_CONFIG_KEY}.edge-edition`;
export function getGlooEdgeEdition(): string {
  return vscode.workspace.getConfiguration().get(GLOO_EDGE_EDITION);
}

const GLOO_EDGE_LICENSE_KEY = `${EXTENSION_CONFIG_KEY}.edge.license-key`;
export function getGlooEdgeLicene(): string {
  return vscode.workspace.getConfiguration().get(GLOO_EDGE_LICENSE_KEY);
}

//Gloo Mesh 
const GLOO_MESH_NAMESPACE = `${EXTENSION_CONFIG_KEY}.mesh-namespace`;
export function getDefaultMeshNamespace(): string {
  return vscode.workspace.getConfiguration().get(GLOO_MESH_NAMESPACE);
}

const GLOO_MESH_EDITION = `${EXTENSION_CONFIG_KEY}.mesh-edition`;
export function getGlooMeshEdition(): string {
  return vscode.workspace.getConfiguration().get(GLOO_MESH_EDITION);
}

const GLOO_MESH_LICENSE_KEY = `${EXTENSION_CONFIG_KEY}.mesh.license-key`;
export function getGlooMeshLicene(): string {
  return vscode.workspace.getConfiguration().get(GLOO_MESH_LICENSE_KEY);
}

const GLOO_OUTPUT_FORMAT = `${EXTENSION_CONFIG_KEY}.output-format`;
export function getOutputFormat(): string {
  return vscode.workspace.getConfiguration().get(GLOO_OUTPUT_FORMAT);
}


//KinD
const KIND_CHECK_UPGRADE_KEY = `${EXTENSION_CONFIG_KEY}.kind.check-upgrade`;
export function getCheckForKindUpgrade(): boolean {
  return vscode.workspace.getConfiguration().get(KIND_CHECK_UPGRADE_KEY);
}
