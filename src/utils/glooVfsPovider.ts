/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Disposable, Event, FileChangeEvent, FileStat, FileSystemProvider, FileType, Uri,EventEmitter, FileChangeType } from "vscode";
import { newFileName, originalFileName } from "./filename";
import * as path from "path";
import { VirtualDocument } from "../yaml-support/yaml-locator";
import * as os from "os";
import * as fsx from "fs-extra";
import { cli, cliCommandToString, CliExitData } from "../cli";
import { newK8sCommand } from "../commands";
import { getStderrString } from "./stdUtil";
import { getOutputFormat } from "../config/config";


export const GLOO_RESOURCE_SCHEME = "gloo";

class VFSFileStat implements FileStat {
  readonly type = FileType.File;
  readonly ctime = 0;
  mtime = 0;
  size = 65536;

  changeStat(size: number): void {
    this.mtime++;
    this.size = size;
  }

}

/**
 * Create Uri for gloo VFS 
 * @param type gloo resource type
 * @param name gloo resource name
 * @param namespace gloo resource namespace
 * @param format output format (yaml|json)
 */
export function glooFSUri(type: string,namespace: string, name: string, format: string, uid?: string): Uri {
  if (uid) name = newFileName(name, uid);
  return Uri.parse(`${GLOO_RESOURCE_SCHEME}://kubernetes/${type}/${name}.${namespace}.${format}`);
}

export class GlooVfsProvider implements FileSystemProvider{
  private readonly onDidChangeFileEmitter: EventEmitter<FileChangeEvent[]> = new EventEmitter<FileChangeEvent[]>();

  onDidChangeFile: Event<FileChangeEvent[]> = this.onDidChangeFileEmitter.event;
 
  private fileStats = new Map<string, VFSFileStat>();

  watch(): Disposable {
    return new Disposable(() => true);
  }
  
  stat(uri: Uri): FileStat | Thenable<FileStat> {
    return this.ensureStat(uri);
  }

  async readFile(uri: Uri): Promise<Uint8Array> {
    const [namespace,resource, format] = this.extractResourceAndFormat(uri);

    const loadResult = await this.loadK8sResource(namespace,resource, format);
    if (loadResult.error) {
      throw new Error(getStderrString(loadResult.error));
    }

    return Buffer.from(loadResult.stdout, "utf8");
  }

  async writeFile(uri: Uri, content: Uint8Array): Promise<void> {
    const tempPath = os.tmpdir();
    const fsPath = path.join(tempPath, uri.fsPath);

    await fsx.ensureFile(fsPath);
    await fsx.writeFile(fsPath, content);

    const updateResult = await this.updateK8sResource(fsPath);

    const oldStat = await fsx.stat(fsPath);
    await fsx.unlink(fsPath);

    if (updateResult.error) {
      throw new Error(getStderrString(updateResult.error));
    }

    // Use timeout to fire file change event in another event loop cycle, this will cause update content inside editor
    setTimeout(() => {
      this.fileStats.get(uri.toString())?.changeStat(oldStat.size + 1); // change stat to ensure content update 
      this.onDidChangeFileEmitter.fire([{ uri, type: FileChangeType.Changed }]);
    }, 10);
  }
  
  
  private ensureStat(uri: Uri): VFSFileStat {
    if (!this.fileStats.has(uri.toString())) {
      this.fileStats.set(uri.toString(), new VFSFileStat());
    }

    const stat = this.fileStats.get(uri.toString());
    stat.changeStat(stat.size + 1);

    return stat;
  }

  extractResourceAndFormat(uri: Uri): [string,string, string] {
    const resPath = path.parse(uri.path);
    let ext = resPath.ext;
    let namespace = path.parse(resPath.name).ext;
    if (namespace?.startsWith(".")){
      namespace = namespace.substring(1);
    }
    let resource = path.posix.format(resPath).substring(1);
    if (ext) {
      resource = resource.slice(0, -ext.length);
    } else {
      ext = getOutputFormat();
    }

    if (ext?.startsWith(".")) {
      ext = ext.substring(1);
    }
    return [namespace,resource, ext];
  }

  private loadK8sResource(namespace:string,resource: string, outputFormat: string, uid = true): Promise<CliExitData> {
    console.log(`Loading k8s resource :${resource}`);
    const newResourceName = (uid) ? originalFileName(resource) : resource;
    const k8sCommand = newK8sCommand(`-n ${namespace} -o ${outputFormat} get ${newResourceName}`);
    console.log(`Executing k8s command ${cliCommandToString(k8sCommand)}`);
    return cli.execute(k8sCommand);
  }

  async updateK8sResource(fsPath: string): Promise<CliExitData> {
    return await cli.execute(newK8sCommand(`apply -f ${fsPath}`));
  }

  async loadGlooDocument(uri: Uri, uid?: boolean): Promise<VirtualDocument> {
    const [namespace,resource, format] = this.extractResourceAndFormat(uri);

    const sr = await this.loadK8sResource(namespace,resource, format, uid);

    if (!sr || sr["error"]) {
      const message = sr ? sr["error"] : "Unable to run command line tool";
      throw message;
    }

    return {
      uri,
      version: 1,
      getText: () => sr.stdout
    };
  }

  async saveGlooDocument(doc: VirtualDocument): Promise<void | string> {
    const tempPath = os.tmpdir();
    const fsPath = path.join(tempPath, doc.uri.fsPath);
    try {
      await fsx.ensureFile(fsPath);
      await fsx.writeFile(fsPath, doc.getText());
  
      const result = await this.updateK8sResource(fsPath);
      if (result.error) {
        return getStderrString(result.error);
      }

    } finally {
      await fsx.unlink(fsPath);
    }
  }


  readDirectory(): [string, FileType][] | Thenable<[string, FileType][]> {
    return []; // no-op
  }

  createDirectory(): void | Thenable<void> {
    //no-op
  }

  delete(): void | Thenable<void> {
    //no-op
  }
  rename(): void | Thenable<void> {
    //no-op
  }
  copy?(): void | Thenable<void> {
    //no-op
  }
  
}

export const glooVfsProvider = new GlooVfsProvider();
