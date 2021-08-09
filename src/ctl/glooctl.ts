/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { cli,CliCommand,cliCommandToString,CliExitData,createCliCommand} from "../cli";
import { CheckPresentMode,ToolVersionInfo,Context, addToolPathToEnv, ExecOpts } from "./ctl";
import { Host } from "../host";
import { FS } from "../fs";
import { Shell } from "../shell";
import { affectsUs, getCheckForGlooctlUpgrade, getDefaultGlooNamespace, getGlooEdgeEdition, getGlooEdgeLicene, getToolPath } from "../config/config";
import * as binutil from "../binutil";
import { getStableGlooCtlVersion, installGlooctl } from "../installer/installGlooctl";
import { failed, succeeded } from "../errorable";
import { asVersionNumber } from "../utils/versionUtils";
import { GLOO_EDGE_SHARED_TERMINAL } from "../constants";
import { getStderrString } from "../utils/stdUtil";
import * as semver from "semver";
import { WindowUtil } from "../utils/windowUtils";
import path = require("path");
import { checkGlooEdgeServerStatus } from "../utils/clusterChecks";
import { GlooEdgeExplorer } from "../tree/glooEdgeExplorer";
import { executeErrorableAction } from "../commands/progressableCommands";



export interface GlooCtl {
  newGlooCommand(...commandArgs: string[]): Promise<CliCommand>
  execute(commandArgs:string[],cwd?:string,fail?:boolean,): Promise<CliExitData>
  about(): Promise<void>
  check(): Promise<void>
  install(component?:string,licenseKey?:string,namespace?:string): Promise<boolean>
  uninstall(component?:string,namespace?:string): Promise<boolean>
  checkPresent(mode: CheckPresentMode): Promise<boolean>;
  checkUpgradeAvailable(): void
  setExplorer(explorer: GlooEdgeExplorer)
}

const GLOO_COMMAND = "glooctl";

export async function create(host: Host, fs: FS, shell: Shell): Promise<GlooCtl> {
  const context = {
    host: host,
    fs: fs,
    shell: shell,
    binFound: false,
    binPath: `${GLOO_COMMAND}`,
  };
  const gotGlooctl = await checkPresent(context,CheckPresentMode.Silent);
  if (!gotGlooctl){
    const progressOptions = {title: `${GLOO_COMMAND} not found installing...`,location: vscode.ProgressLocation.Notification};
    const actionPromise = installGlooctl(shell,undefined);
    const successMessage = `Successfuly installed ${GLOO_COMMAND}`;
    const errorMessage = `Failed to update ${GLOO_COMMAND}`;
    await executeErrorableAction(progressOptions,actionPromise,successMessage,[],errorMessage);
  }
  return new GlooCtlImpl(context);
}

class GlooCtlImpl implements GlooCtl {

  private sharedTerminal: vscode.Terminal | null = null;
  private _explorer: GlooEdgeExplorer
  
  constructor(
    private readonly context: Context
  ) {
    this.context = context;
  }

  setExplorer(explorer: GlooEdgeExplorer): void{
    this._explorer = explorer;
  }

  async about(): Promise<void> {
    const command = await this.newGlooCommand("version");
    await this.executeInTerminal(command,{cwd: process.cwd(),name: GLOO_EDGE_SHARED_TERMINAL,shared: true});
  }

  async check(): Promise<void> {
    const command = await this.newGlooCommand("check");
    await this.executeInTerminal(command,{cwd: process.cwd(),name: GLOO_EDGE_SHARED_TERMINAL,shared: true});
  }

  checkPresent(mode: CheckPresentMode): Promise<boolean> {
    return checkPresent(this.context,mode);
  }

  checkUpgradeAvailable(): void {
    glooUpgradeAvailable(this.context);
  }

  /**
   * 
   * @param commandArgs 
   * @returns 
   */
  async execute(commandArgs:string[],cwd?:string,fail = true): Promise<CliExitData> {
    const command = await this.newGlooCommand(...commandArgs);
    const toolLocation = getToolPath(this.context.host,this.context.shell,`${GLOO_COMMAND}`);
    if (toolLocation) {
      // eslint-disable-next-line require-atomic-updates
      command.cliCommand = command.cliCommand.replace(`${GLOO_COMMAND}`, `"${toolLocation}"`).replace(new RegExp(`&& ${GLOO_COMMAND}`, "g"), `&& "${toolLocation}"`);
    }

    return cli.execute(command, cwd ? { cwd } : {})
      .then(async (result) => result.error && fail ? Promise.reject(result.error) : result)
      .catch((err) => fail ? Promise.reject(err) : Promise.resolve({ error: null, stdout: "", stderr: "" }));
  }

  /**
   * 
   * @param component 
   * @param edition 
   * @param licenseKey 
   * @param namespace 
   * @returns 
   */
  async install(component = "gateway",edition?: string, licenseKey?: string,namespace?: string): Promise<boolean> {
    //Community or EE
    if (!edition){
      edition = getGlooEdgeEdition();
    }
    const installTask = `Gloo ${edition} ${component}`;
    return await vscode.window.withProgress({title: `Installing ${installTask}`,location: vscode.ProgressLocation.Notification}, async () => {
      try {
        const cmdArgs: string[] = new Array<string>("install");
        cmdArgs.push(component?.toLocaleLowerCase());
        cmdArgs.push(edition);

        //Namespace 
        if (!namespace){
          namespace = getDefaultGlooNamespace();
        }
        cmdArgs.push("--namespace");
        cmdArgs.push(namespace);
  
        //License Key 
        if (edition?.toLowerCase() === "ee") {
          if (!licenseKey) {
            cmdArgs.push("enterprise");
            licenseKey = getGlooEdgeLicene();
          } else {
            cmdArgs.push("--license-key");
            cmdArgs.push(licenseKey);
          }
        }
        const command = await this.newGlooCommand(...cmdArgs);
        const result: CliExitData = await cli.execute(command,{env:addToolPathToEnv(getToolPath(this.context.host,this.context.shell,`${GLOO_COMMAND}`))});
        let message: string;

        if (result.error){
          message = `${installTask} installation failed: ${getStderrString(result.error)}`;
          vscode.window.showWarningMessage(message);
        } else {
          message = `${installTask} installed.`;
          vscode.window.showInformationMessage(message);
          await checkGlooEdgeServerStatus(this);
          this._explorer.refresh();
          return true;
        }
      } catch (err){
        vscode.window.showErrorMessage(err.toString());
      }
      return false;
    });
  }

  /**
   * 
   * @param commandArgs 
   * @returns 
   */
  async newGlooCommand(...commandArgs: string[]): Promise<CliCommand> {
    
    return createCliCommand("glooctl", ...commandArgs);
  }

  /**
   * 
   * @param component 
   * @returns 
   */
  async uninstall(component = "gateway",namespace?:string): Promise<boolean> {
    return await vscode.window.withProgress({title: `Uninstall Gloo ${component}`,location: vscode.ProgressLocation.Notification}, async () => {
      try {
        const cmdArgs: string[] = new Array<string>("uninstall");
        cmdArgs.push(component);
        //Namespace 
        if (!namespace){
          namespace = getDefaultGlooNamespace();
        }
        cmdArgs.push("--namespace");
        cmdArgs.push(namespace);
        const command = await this.newGlooCommand(...cmdArgs);
        const result: CliExitData = await cli.execute(command,{env:addToolPathToEnv(getToolPath(this.context.host,this.context.shell,`${GLOO_COMMAND}`))});
        let message: string;

        if (result.error){
          message = `Gloo ${component} uninstall failed: ${getStderrString(result.error)}`;
          vscode.window.showWarningMessage(message);
        } else {
          message = `Gloo ${component} uninstalled.`;
          await checkGlooEdgeServerStatus(this);
          this._explorer.refresh();
          vscode.window.showInformationMessage(message);
          return true;
        }
      } catch (err){
        vscode.window.showErrorMessage(err.toString());
      }
      return false;
    });
  }

  async executeInTerminal(command: CliCommand, opts: ExecOpts): Promise<void> {
    const toolLocation =  
                         path.dirname(getToolPath(this.context.host,this.context.shell,`${GLOO_COMMAND}`));
    let terminal: vscode.Terminal;
    if (!opts.shared){
      terminal = WindowUtil.createTerminal(opts.name, opts.cwd, toolLocation);
    } else {
      terminal = this.getSharedTerminal(toolLocation);
    }
    
    terminal.sendText(cliCommandToString(command), true);
    terminal.show();
  }
  /**
   * 
   * @returns 
   */
  getSharedTerminal(toolLocation: string): vscode.Terminal {
    if (!this.sharedTerminal) {
      this.sharedTerminal = WindowUtil.createTerminal(GLOO_EDGE_SHARED_TERMINAL, process.cwd(), toolLocation);
      const disposable = this.context.host.onDidCloseTerminal((terminal) => {
        if (terminal === this.sharedTerminal) {
          this.sharedTerminal = null;
          disposable.dispose();
        }
      });
      this.context.host.onDidChangeConfiguration((change) => {
        if (affectsUs(change) && this.sharedTerminal) {
          this.sharedTerminal.dispose();
        }
      });
    }
    return this.sharedTerminal;
  }

}


// Gloo binary install and upgrade check functions
async function checkPresent(context: Context, mode: CheckPresentMode): Promise<boolean> {
  if (context.binFound) {
    return true;
  }

  return await checkForGlooctlInternal(context, mode);
}

async function checkForGlooctlInternal(context: Context, mode: CheckPresentMode): Promise<boolean> {
  const binName = GLOO_COMMAND;
  const bin = getToolPath(context.host, context.shell, binName);

  const inferFailedMessage = `Could not find "${binName}" binary.`;
  const configuredFileMissingMessage = `${bin} does not exist!`;
  return binutil.checkForBinary(context, bin, binName, inferFailedMessage, configuredFileMissingMessage, mode === CheckPresentMode.Alert);
}

async function glooUpgradeAvailable(context: Context): Promise<void> {

  const performUpgradeCheck = await checkPresent(context, CheckPresentMode.Silent) && getCheckForGlooctlUpgrade();
  if (!performUpgradeCheck) {
    return;
  }

  let versionInfo: ToolVersionInfo;

  try {
    versionInfo = await getGlooVersionInfo(context);
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to determine ${GLOO_COMMAND} version: ${err}`);
    return;
  }

  const avblVersionNumber = asVersionNumber(versionInfo.availableVersion);
  const isUpgradeNeeded = semver.lt(versionInfo.currentVersion,avblVersionNumber);

  if (isUpgradeNeeded) {
    const value = await vscode.window.showInformationMessage(`${GLOO_COMMAND}  upgrade available to ${versionInfo.availableVersion}, currently on ${versionInfo.currentVersion}`, "Install");
    if (value === "Install") {
      vscode.window.withProgress({title: `Upgrading ${GLOO_COMMAND}  to ${avblVersionNumber}`,location: vscode.ProgressLocation.Notification}, async () =>{
        const result = await installGlooctl(context.shell, versionInfo.availableVersion);
        if (failed(result)) {
          vscode.window.showErrorMessage(`Failed to update ${GLOO_COMMAND} : ${result.error}`);
        } else if (succeeded(result)){
          vscode.window.showInformationMessage(`Successfuly upgraded ${GLOO_COMMAND}  to ${avblVersionNumber}`);
        }
      });
    }
  }
}

async function getGlooVersionInfo(context: Context): Promise<ToolVersionInfo> {
  let currentVersion: string;
  let availableVersion: string;

  const version = new RegExp(/^[Client:].*([0-9]+\.[0-9]+\.[0-9]+?[-\w]*).*$/);
  const sr = await context.shell.exec(`"${context.binPath}" version`);
  if (!sr || sr.code !== 0) {
    throw new Error(`Error checking for glooctl updates: ${sr ? sr.stderr : "cannot run glooctl"}`);
  }
   
  const lines = sr.stdout.split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const toolVersion: string = version.exec(lines[0])[1];
  if (toolVersion.length) {
    currentVersion = toolVersion;
  }

  const versionRes = await getStableGlooCtlVersion(context.shell);
  
  if (failed(versionRes)) {
    vscode.window.showErrorMessage(`Failed to determine glooctl version: ${versionRes.error}`);
    return;
  }
  
  if (currentVersion === null || availableVersion === null) {
    throw new Error(`Unable to get version from glooctl version check: ${lines}`);
  }

  return {
    currentVersion: currentVersion,
    availableVersion: versionRes.result
  } as ToolVersionInfo;
}
