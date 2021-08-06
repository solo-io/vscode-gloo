/* eslint-disable header/header */
// Copied from https://github.com/Azure/vscode-kubernetes-tools/blob/e16c0b239660585753dfed4732293737f6f5f06d/src/yaml-support/yaml-locator.ts

/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

declare module "node-yaml-parser" {
  export function parse(text: string): { readonly documents: YamlDocument[]; readonly lineLengths: number[] };
  export function findNodeAtPosition(documents: YamlDocument[], lineLengths: number[], line: number, char: number): YamlMatchedElement;

  export interface YamlNode {
    readonly kind: string;
    readonly raw: string;
    readonly startPosition: number;
    readonly endPosition: number;
    readonly parent?: YamlNode;
  }

  export interface YamlDocument {
    readonly nodes: YamlNode[];
    readonly errors: string[];
  }

  export interface YamlMatchedElement {
    readonly matchedNode: YamlNode;
    readonly matchedDocument: YamlDocument;
  }

  export interface Util {
    isKey(node: YamlNode): boolean;
  }

  export const util: Util;
}
