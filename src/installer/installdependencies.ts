/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { glooChannel } from "../cli";

import { fs } from "../fs";
import { host } from "../host";
import { shell, Shell } from "../shell";
import { installGlooctl} from "./installGlooctl";
import { installGlooMeshCtl } from "././installMeshctl";

import { failed, Errorable } from "../errorable";
import { create as GlooCtl } from "../ctl/glooctl";
import { create as GlooMeshCtl } from "../ctl/meshctl";
import { CheckPresentMode } from "../ctl/ctl";

import * as k8s from "vscode-kubernetes-tools-api";

//TODO add KinD ???
export async function installDependencies(): Promise<void> {
  const kubectl = await k8s.extension.kubectl.v1;
  if (kubectl.available){
    const glooctl = GlooCtl(host, fs, shell,kubectl);
    const meshctl = GlooMeshCtl(host, fs, shell,kubectl);
    const gotGlooCtl = await glooctl.checkPresent(CheckPresentMode.Silent);
    const gotGlooMeshCtl = await meshctl.checkPresent(CheckPresentMode.Silent);

    const installPromises = [];

    if (!gotGlooCtl){
      installPromises.push(installDependency("glooctl", gotGlooCtl, (sh) => installGlooctl(sh,null)));
    }
  
    if (!gotGlooMeshCtl){
      installPromises.push(installDependency("meshctl", gotGlooMeshCtl, (sh) => installGlooMeshCtl(sh,null)));
    }

    await Promise.all(installPromises); 
  
    glooChannel.showOutput("Done");
  }
}

async function installDependency(name: string, alreadyGot: boolean, installFunc: (shell: Shell) => Promise<Errorable<null>>): Promise<void> {
  if (alreadyGot) {
    glooChannel.showOutput(`Already got ${name}...`);
  } else {
    glooChannel.showOutput(`Installing ${name}...`);
    const result = await installFunc(shell);
    if (failed(result)) {
      glooChannel.showOutput(`Unable to install ${name}: ${result.error[0]}`);
    }
  }
}
