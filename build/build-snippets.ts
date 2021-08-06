/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as fs from "fs-extra";

interface Snippet {
  prefix: string;
  description: string;
  body: string[];
}

const snippets: { [key: string]: Snippet } = {
  "Gloo Virtual Mesh": {
    prefix: "VirtualMesh",
    description: "Defines a Gloo Mesh Virutal Mesh Resource",
    body: load("gloo-vmesh.yaml"),
  },
  "Access Policy": {
    prefix: "AccessPolicy",
    description: "Create a Gloo Mesh Access Policy Resource",
    body: load("gloo-access-policy.yaml"),
  },
  "Traffic Policy": {
    prefix: "TrafficPolicy",
    description: "Create a Gloo Mesh Traffic Policy Resource",
    body: load("gloo-traffic-policy.yaml"),
  },
  "Virtual Destination": {
    prefix: "VirtualDestination",
    description: "Create a Gloo Mesh Virtual Destination Resource",
    body: load("gloo-vd.yaml"),
  },
  "Role": {
    prefix: "Role",
    description: "Create a Gloo Mesh Role Resource",
    body: load("gloo-role.yaml"),
  },
  "Role Binding": {
    prefix: "RoleBinding",
    description: "Create a Gloo Mesh RoleBinding Resource",
    body: load("gloo-rolebinding.yaml"),
  },
  "Virtual Service": {
    prefix: "VirtualService",
    description: "Create a Gloo Virtual Service Resource",
    body: load("gloo-vs.yaml"),
  },
  "Gateway": {
    prefix: "Gateway",
    description: "Create a Gloo Gateway Resource",
    body: load("gloo-gateway.yaml"),
  },
  "Upstream": {
    prefix: "Upstream",
    description: "Create a Gloo Upstream Resource",
    body: load("gloo-upstream.yaml"),
  }
};

function load(name: string): string[] {
  const filePath = path.join(__dirname, "..", "..", "rawsnippets", name);
  const lines = fs.readFileSync(filePath).toString().split("\n");
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

const out = JSON.stringify(snippets, undefined, 2);

const filePath = path.join(__dirname, "..", "..", "snippets", "gloo.json");
fs.writeFileSync(filePath, out);
