/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import * as semver from "semver";
import * as fs from "fs-extra";
import * as path from "path";
import { glooYaml } from "./gloo-yaml";
import { generateScheme } from "./gloo-yaml-schema-generator";

enum MODIFICATION_ACTIONS {
  "delete",
  "add"
}

interface SchemaAdditions {
  schema: string;
  action: MODIFICATION_ACTIONS.add;
  path: string;
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
}

interface SchemaDeletions {
  schema: string;
  action: MODIFICATION_ACTIONS.delete;
  path: string;
  key: string;
}

interface YamlExtensionAPI {
  registerContributor(schema: string, requestSchema: (resource: string) => string, requestSchemaContent: (uri: string) => Promise<string>, label?: string): boolean;
  modifySchemaContent(schemaModifications: SchemaAdditions | SchemaDeletions): Promise<void>;
}

const VSCODE_YAML_EXTENSION_ID = "redhat.vscode-yaml";
let extContext: vscode.ExtensionContext;
const glooUriCache = new Map<string, string>();
let schemaPaths: string[];

export async function registerYamlSchemaSupport(context: vscode.ExtensionContext): Promise<void> {
  extContext = context;
  const yamlPlugin = await activateYamlExtension();
  if (!yamlPlugin || !yamlPlugin.modifySchemaContent) {
    // activateYamlExtension has already alerted to users for errors.
    return;
  }

  schemaPaths = (await fs.readFile(context.asAbsolutePath("scheme/index.properties"))).toString().split("\n");

  //Gloo Mesh YAML Registrations
  yamlPlugin.registerContributor("gloo-mesh", requestYamlSchemaUriCallback, requestYamlSchemaContentCallback, "apiVersion:networking.mesh.gloo.solo.io/v1");
  yamlPlugin.registerContributor("gloo-mesh-rbac", requestYamlSchemaUriCallback, requestYamlSchemaContentCallback, "apiVersion:rbac.enterprise.mesh.gloo.solo.io/v1");
  yamlPlugin.registerContributor("gloo-mesh-enterprise", requestYamlSchemaUriCallback, requestYamlSchemaContentCallback, "apiVersion:networking.enterprise.mesh.gloo.solo.io/v1beta1");
  
  //Gloo Edge YAML Registrations
  yamlPlugin.registerContributor("gloo-edge", requestYamlSchemaUriCallback, requestYamlSchemaContentCallback, "apiVersion:gloo.solo.io/v1");
  yamlPlugin.registerContributor("gloo-gateway", requestYamlSchemaUriCallback, requestYamlSchemaContentCallback, "apiVersion:gateway.solo.io/v1");

}


async function activateYamlExtension(): Promise<YamlExtensionAPI | undefined> {
  const ext = vscode.extensions.getExtension(VSCODE_YAML_EXTENSION_ID);
  if (!ext) {
    vscode.window.showWarningMessage("Please install 'YAML Support by Red Hat' via the Extensions pane.");
    return undefined;
  }
  const yamlPlugin = await ext.activate();

  if (!yamlPlugin || !yamlPlugin.registerContributor) {
    vscode.window.showWarningMessage("The installed Red Hat YAML extension doesn't support Kubernetes Intellisense. Please upgrade 'YAML Support by Red Hat' via the Extensions pane.");
    return undefined;
  }

  if (!yamlPlugin || !yamlPlugin.modifySchemaContent) {
    vscode.window.showWarningMessage("The installed Red Hat YAML extension doesn't support in memory schemas modification. Please upgrade 'YAML Support by Red Hat' via the Extensions pane.");
    return undefined;
  }
  if (ext.packageJSON.version && !semver.gte(ext.packageJSON.version, "0.7.2")) {
    vscode.window.showWarningMessage("The installed Red Hat YAML extension doesn't support schemas modification. Please upgrade 'YAML Support by Red Hat' via the Extensions pane.");
  }
  return yamlPlugin;
}

function requestYamlSchemaUriCallback(resource: string): string | undefined {
  const textEditor = vscode.window.visibleTextEditors.find((editor) => editor.document.uri.toString() === resource);
  if (textEditor) {
    const schemaPath = glooYaml.getApiVersionAndTypePath(textEditor.document);
    if (schemaPath) {
      if (schemaPaths.includes(schemaPath)) {
        let resourceUrl = vscode.Uri.parse(resource);
        let scheme: string;
        if (schemaPath.startsWith("networking.mesh.gloo.solo.io")) {
          scheme = "gloo-mesh";
        } else if (schemaPath.startsWith("rbac.enterprise.mesh.gloo.solo.io")) {
          scheme = "gloo-mesh-rbac";
        } else if (schemaPath.startsWith("networking.enterprise.mesh.gloo.solo.io")) {
          scheme = "gloo-mesh-enterprise";
        } else if (schemaPath.startsWith("gloo.solo.io")) {
          scheme = "gloo-edge";
        } else if (schemaPath.startsWith("gateway.solo.io")) {
          scheme = "gloo-gateway";
        }
        resourceUrl = resourceUrl.with({ scheme });
        glooUriCache.set(resourceUrl.toString(), textEditor.document.uri.toString());
        return resourceUrl.toString();
      }

    }
  }

  return undefined;
}

async function requestYamlSchemaContentCallback(uri: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  try {
    const doc = getDocument(uri);
    if (doc) {
      const schemaPath = glooYaml.getApiVersionAndTypePath(doc);
      if (schemaPath) {
        const absPath = extContext.asAbsolutePath(path.join("scheme", schemaPath));
        if (await fs.pathExists(absPath)) {
          return generateScheme(doc, absPath);
        }
      }

    }

  } catch (err) {
    console.error(err);
  }

  return undefined;

}

function getDocument(glooUri: string): vscode.TextDocument | undefined {
  if (glooUriCache.has(glooUri)) {
    const resource = glooUriCache.get(glooUri);
    const textEditor = vscode.window.visibleTextEditors.find((editor) => editor.document.uri.toString() === resource);
    if (textEditor) {
      return textEditor.document;
    }
  }
}
