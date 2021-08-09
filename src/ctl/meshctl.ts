/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { cli, CliCommand,cliCommandToString,CliExitData,createCliCommand} from "../cli";
import { addToolPathToEnv, CheckPresentMode,Context, ToolVersionInfo } from "./ctl";
import { Host } from "../host";
import { FS } from "../fs";
import { Shell } from "../shell";
import { affectsUs, getCheckForMeshctlUpgrade, getDefaultMeshNamespace, getGlooMeshEdition, getGlooMeshLicene, getToolPath } from "../config/config";
import * as binutil from "../binutil";
import { getStableGlooMeshVersion, installGlooMeshCtl } from "../installer/installMeshctl";
import { failed, succeeded } from "../errorable";
import { asVersionNumber } from "../utils/versionUtils";
import * as semver from "semver";
import { GLOO_MESH_SHARED_TERMINAL } from "../constants";
import path = require("path");
import { WindowUtil } from "../utils/windowUtils";
import { getStderrString } from "../utils/stdUtil";
import { checkGlooMeshServerStatus } from "../utils/clusterChecks";
import { executeErrorableAction } from "../commands/progressableCommands";

interface ExecOpts{
  cwd: string 
  name: string
  shared: boolean
}

export interface MeshCtl {
  newGlooCommand(...commandArgs: string[]): Promise<CliCommand>
  execute(commandArgs:string[],cwd?:string,fail?:boolean): Promise<CliExitData>
  about(): void
  check(): void
  install(edition?: string, licenseKey?: string,namespace?: string): Promise<boolean>
  uninstall(namespace?:string): Promise<boolean>
  checkPresent(mode: CheckPresentMode): Promise<boolean>;
  checkUpgradeAvailable(): void
}

export const GLOO_COMMAND = "meshctl";


export async function create(host: Host, fs: FS, shell: Shell): Promise<MeshCtl> {
  const context = { host: host, fs: fs, shell: shell, binFound: false, binPath: `${GLOO_COMMAND}` };

  const gotGlooMeshCtl = await checkPresent(context,CheckPresentMode.Silent);
  if (!gotGlooMeshCtl){
    const progressOptions = {title: `${GLOO_COMMAND} not found installing...`,location: vscode.ProgressLocation.Notification};
    const actionPromise = installGlooMeshCtl(shell,undefined);
    const successMessage = `Successfuly installed ${GLOO_COMMAND}`;
    const errorMessage = `Failed to update ${GLOO_COMMAND}`;
    await executeErrorableAction(progressOptions,actionPromise,successMessage,[],errorMessage);
  }
      
  return new GlooMeshCtlImpl(context);
}

class GlooMeshCtlImpl implements MeshCtl {

    private sharedTerminal: vscode.Terminal

    constructor(private readonly context: Context) {
      this.context = context;
    }

    /**
   * 
   */
    async about(): Promise<void> {
      const command = await this.newGlooCommand("version");
      await this.executeInTerminal(command,{cwd: process.cwd(),name: GLOO_MESH_SHARED_TERMINAL,shared: true});
    }

    /**
   * 
   */
    async check(): Promise<void> {
      const command = await this.newGlooCommand("check");
      await this.executeInTerminal(command,{cwd: process.cwd(),name: GLOO_MESH_SHARED_TERMINAL,shared: true});
    }

    /**
   * 
   * @param mode 
   * @returns 
   */
    checkPresent(mode: CheckPresentMode): Promise<boolean> {
      return checkPresent(this.context,mode);
    }
  
    /**
   * 
   */
    checkUpgradeAvailable(): void {
      meshUpgradeAvailable(this.context);
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
   * @param edition 
   * @param licenseKey 
   * @param namespace 
   * @returns 
   */
    async install(edition?: string, licenseKey?: string,namespace?: string): Promise<boolean> {
    //Community or EE
      if (!edition){
        edition = getGlooMeshEdition();
      }
      const installTask = `Gloo Mesh ${edition}`;
      return await vscode.window.withProgress({title: `Installing ${installTask}`,location: vscode.ProgressLocation.Notification}, async () => {
        try {
          const cmdArgs: string[] = new Array<string>("install");
          cmdArgs.push(edition);

          //Namespace 
          if (!namespace){
            namespace = getDefaultMeshNamespace();
          }
          cmdArgs.push("--namespace");
          cmdArgs.push(namespace);
  
          //License Key 
          if (edition?.toLowerCase() === "ee") {
            if (!licenseKey) {
              cmdArgs.push("enterprise");
              licenseKey = getGlooMeshLicene();
            } else {
              cmdArgs.push("--license-key");
              cmdArgs.push(licenseKey);
            }
          }
          const command = await this.newGlooCommand(...cmdArgs);
          const result: CliExitData = await cli.execute(command,{env:addToolPathToEnv(getToolPath(this.context.host,this.context.shell,"meshctl"))});
          let message: string;

          if (result.error && result.error != null){
            message = `${installTask} installation failed: ${getStderrString(result.error)}`;
            vscode.window.showWarningMessage(message);
          } else {
            message = `${installTask} installed.`;
            await checkGlooMeshServerStatus(this);
            vscode.window.showInformationMessage(message);
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
      
      return createCliCommand(`${GLOO_COMMAND}`, ...commandArgs);
    }
  
    /**
   * 
   * @param namespace 
   * @returns 
   */
    async uninstall(namespace?:string): Promise<boolean> {
      return await vscode.window.withProgress({title: "Uninstalling Gloo Mesh",location: vscode.ProgressLocation.Notification}, async () => {
        try {
          const cmdArgs: string[] = new Array<string>("uninstall");

          //Namespace 
          if (!namespace){
            namespace = getDefaultMeshNamespace();
          }
          cmdArgs.push("--namespace");
          cmdArgs.push(namespace);

          const command = await this.newGlooCommand(...cmdArgs);
          const result: CliExitData = await cli.execute(command,{env:addToolPathToEnv(getToolPath(this.context.host,this.context.shell,GLOO_COMMAND))});
          let message: string;

          if (result.error && result.error != null){
            message = `Gloo Mesh uninstall failed: ${getStderrString(result.error)}`;
            vscode.window.showWarningMessage(message);
          } else {
            message = "Gloo Mesh uninstalled.";
            await checkGlooMeshServerStatus(this);
            vscode.window.showInformationMessage(message);
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
   * @param command 
   * @param opts 
   */
    async executeInTerminal(command: CliCommand, opts: ExecOpts): Promise<void> {
      const toolLocation =  
                         path.dirname(getToolPath(this.context.host,this.context.shell,GLOO_COMMAND));
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
   * @param toolLocation 
   * @returns 
   */
    getSharedTerminal(toolLocation: string): vscode.Terminal {
      if (!this.sharedTerminal) {
        this.sharedTerminal = WindowUtil.createTerminal(GLOO_MESH_SHARED_TERMINAL, process.cwd(), toolLocation);
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

/**
 * 
 * @param context 
 * @param mode 
 * @returns 
 */
async function checkPresent(context: Context, mode: CheckPresentMode): Promise<boolean> {
  if (context.binFound) {
    return true;
  }

  return await checkForMeschtlInternal(context, mode);
}

/**
 * 
 * @param context 
 * @param mode 
 * @returns 
 */
async function checkForMeschtlInternal(context: Context, mode: CheckPresentMode): Promise<boolean> {
  const binName = `${GLOO_COMMAND}`;
  const bin = getToolPath(context.host, context.shell, binName);

  const inferFailedMessage = `Could not find "${binName}" binary.`;
  const configuredFileMissingMessage = `${bin} does not exist!`;
  return binutil.checkForBinary(context, bin, binName, inferFailedMessage, configuredFileMissingMessage, mode === CheckPresentMode.Alert);
}


/**
 * 
 * @param context 
 * @returns 
 */
async function meshUpgradeAvailable(context: Context): Promise<void> {

  const performUpgradeCheck = await checkPresent(context, CheckPresentMode.Silent) && getCheckForMeshctlUpgrade();
  
  if (!performUpgradeCheck) {
    return;
  }

  let versionInfo: ToolVersionInfo;

  try {
    versionInfo = await getMeshVersionInfo(context);
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to determine ${GLOO_COMMAND} version: ${err}`);
    return;
  }

  const avblVersionNumber = asVersionNumber(versionInfo.availableVersion);
  const isUpgradeNeeded = semver.lt(versionInfo.currentVersion,avblVersionNumber);

  if (isUpgradeNeeded) {
    const value = await vscode.window.showInformationMessage(`${GLOO_COMMAND} upgrade available to ${versionInfo.availableVersion}, currently on ${versionInfo.currentVersion}`, "Install");
    if (value === "Install") {
      vscode.window.withProgress({title: `Upgrading ${GLOO_COMMAND} to ${avblVersionNumber}`,location: vscode.ProgressLocation.Notification}, async () =>{
        const result = await installGlooMeshCtl(context.shell, versionInfo.availableVersion);
        if (failed(result)) {
          vscode.window.showErrorMessage(`Failed to update meshctl: ${result.error}`);
        } else if (succeeded(result)){
          vscode.window.showInformationMessage(`Successfuly upgraded meshctl to ${avblVersionNumber}`);
        }
      });
    }
  }
}

/**
 * 
 * @param context 
 * @returns 
 */
async function getMeshVersionInfo(context: Context): Promise<ToolVersionInfo> {
  let currentVersion: string;
  let availableVersion: string;

  const version = new RegExp(/^[v]?([0-9]+\.[0-9]+\.[0-9]+[-\w]*)$/);
  const sr = await context.shell.exec(`"${context.binPath}" version`);
  if (!sr || sr.code !== 0) {
    throw new Error(`Error checking for meshctl updates: ${sr ? sr.stderr : "cannot run " + GLOO_COMMAND}`);
  }
   
  const versionJson: any = JSON.parse(sr.stdout.trim());
  const clientVersion = versionJson.client.version;
  const toolVersion: string = version.exec(clientVersion)[1];
  if (toolVersion.length) {
    currentVersion = toolVersion;
  }

  const versionRes = await getStableGlooMeshVersion(context.shell);
  
  if (failed(versionRes)) {
    vscode.window.showErrorMessage(`Failed to determine ${GLOO_COMMAND} version: ${versionRes.error}`);
    return;
  }
  
  if (currentVersion === null || availableVersion === null) {
    throw new Error(`Unable to get version from ${GLOO_COMMAND} version check: ${versionJson}`);
  }

  return {
    currentVersion: currentVersion,
    availableVersion: versionRes.result
  } as ToolVersionInfo;
}
