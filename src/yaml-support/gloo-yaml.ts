/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from "vscode";
import * as _ from "lodash";
import { yamlLocator, YamlMap, YamlDocument, YamlNode } from "./yaml-locator";

//GLOO MESH
const GLOO_MESH_API = "networking.mesh.gloo.solo.io/";
const GLOO_MESH_NETWORKING_ENTERPRISE_API = "networking.enterprise.mesh.gloo.solo.io/";
const GLOO_MESH_DISCOVERY_API = "discovery.mesh.gloo.solo.io/";
const GLOO_MESH_ENTERPRISE_API = "networking.enterprise.mesh.gloo.solo.io/";
const GLOO_RBAC_API = "rbac.enterprise.mesh.gloo.solo.io/";

//GLOO EDGE
const GLOO_EDGE_GATEWAY_API = "gateway.gloo.solo.io/";
const GLOO_EDGE_ENTERPRISE_API = "enterprise.gloo.solo.io/";

const SOLO_MULTICLUSTER_API = "multicluster.solo.io/";
const SOLO_API = "solo.io/";

export enum GlooYamlType {
  //Gloo CRDS
  AuthConfig ="AuthConfig",
  Gateway = "Gateway",
  RateLimitConfig = "RateLimitConfig",
  RouteTable = "RouteTable",
  UpstreamGroup = "UpstreamGroup",
  VirtualHostOption = "VirtualHostOption",
  VirutalService = "VirutalService",
  //Mesh CRDS
  AccessLogRecord ="AccessLogRecord",
  Mesh = "Mesh",
  VirtualMesh = "VirutalMesh",
  VirtualDestination = "VirtualDestination",
  TrafficPolicy = "TrafficPolicy",
  AccessPolicy = "AccessPolicy",
  Settings = "Settings",
  WasmDeployment = "WasmDeployment",
  Role = "Role",
  RoleBinding = "RoleBinding"
}

export class GlooYaml {

  getRootMap(doc: YamlDocument): YamlMap | undefined {
    return doc.nodes.find(node => node.kind === "MAPPING") as YamlMap;
  }

  getApiVersion(rootMap: YamlMap): string {
    return getYamlMappingValue(rootMap, "apiVersion");
  }

  getApiVersionNode(rootMap: YamlMap): YamlNode {
    return findNodeByKey("apiVersion", rootMap);
  }

  getKind(rootMap: YamlMap): string {
    return getYamlMappingValue(rootMap, "kind");
  }

  getKindNode(rootMap: YamlMap): YamlNode {
    return findNodeByKey("kind", rootMap);
  }

  getName(metadata: YamlMap): string {
    return getYamlMappingValue(metadata, "name");
  }

  getNameNode(metadata: YamlMap): YamlNode {
    return findNodeByKey("name", metadata);
  }


  getMetadata(rootMap: YamlMap): YamlMap {
    return findNodeByKey<YamlMap>("metadata", rootMap);
  }

  isGlooYaml(vsDocument: vscode.TextDocument): GlooYamlType | undefined {
    const yamlDocuments = yamlLocator.getYamlDocuments(vsDocument);
    for (const doc of yamlDocuments) {
      const type = this.getGlooYamlType(doc);
      if (type) {
        return type;
      }
    }
    return undefined;
  }

  getGlooYamlType(doc: YamlDocument): GlooYamlType | undefined {
    const rootMap = this.getRootMap(doc);
    if (rootMap) {
      const apiVersion = getYamlMappingValue(rootMap, "apiVersion");
      const kind = getYamlMappingValue(rootMap, "kind");
      if (this.isGlooApi(apiVersion)) {
        return GlooYamlType[kind];
      }
    }
  }

  getApiVersionAndTypePath(vsDocument: vscode.TextDocument): string | undefined {
    const yamlDocuments = yamlLocator.getYamlDocuments(vsDocument);
    if (!yamlDocuments) {
      return undefined;
    }

    for (const doc of yamlDocuments) {
      const rootMap = this.getRootMap(doc);
      if (rootMap) {
        const apiVersion = getYamlMappingValue(rootMap, "apiVersion");
        const kind = getYamlMappingValue(rootMap, "kind");
        return `${apiVersion}_${kind}.json`;
      }
    }

    return undefined;
  }

  private isGlooApi(apiVersion:string): boolean{
    return apiVersion?.startsWith(GLOO_MESH_ENTERPRISE_API) 
      || apiVersion?.startsWith(GLOO_RBAC_API) 
      || apiVersion?.startsWith(GLOO_EDGE_ENTERPRISE_API)
      || apiVersion?.startsWith(GLOO_EDGE_GATEWAY_API)
      || apiVersion?.startsWith(GLOO_MESH_DISCOVERY_API)
      || apiVersion?.startsWith(GLOO_MESH_API)
      || apiVersion?.startsWith(GLOO_MESH_NETWORKING_ENTERPRISE_API)
      || apiVersion?.startsWith(SOLO_MULTICLUSTER_API)
      || apiVersion?.startsWith(SOLO_API);
  }
}


export const glooYaml = new GlooYaml();


export enum StringComparison {
  Ordinal,
  OrdinalIgnoreCase
}


// test whether two strings are equal ignore case
export function equalIgnoreCase(a: string, b: string): boolean {
  return _.isString(a) && _.isString(b) && a.toLowerCase() === b.toLowerCase();
}

// Get the string value of key in a yaml mapping node(parsed by node-yaml-parser)
// eg: on the following yaml, this method will return 'value1' for key 'key1'
//
//      key1: value1
//      key2: value2
//
export function getYamlMappingValue(mapRootNode: YamlMap, key: string,
  ignoreCase: StringComparison = StringComparison.Ordinal): string | undefined {
  // TODO, unwrap quotes
  if (!key) {
    return undefined;
  }
  const keyValueItem = mapRootNode.mappings.find((mapping) => mapping.key &&
    (ignoreCase === StringComparison.OrdinalIgnoreCase ? key === mapping.key.raw : equalIgnoreCase(key, mapping.key.raw)));
  return keyValueItem ? keyValueItem.value.raw : undefined;
}

export function findNodeByKey<T>(key: string, yamlMap: YamlMap): T | undefined {
  if (!yamlMap || !yamlMap.mappings) {
    return undefined;
  }
  const mapItem = yamlMap.mappings.find(item => item.key.raw === key);
  if (mapItem) {
    return mapItem.value as unknown as T;
  }

  return undefined;
}


