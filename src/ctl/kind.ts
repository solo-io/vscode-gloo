/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ProgressLocation, QuickPickItem, Terminal, window } from "vscode";
import {
  cli,
  CliCommand,
  cliCommandToString,
  CliExitData,
  createCliCommand,
} from "../cli";
import {
  CheckPresentMode,
  Context,
  ExecOpts,
  ToolVersionInfo,
} from "./ctl";
import { Host } from "../host";
import { FS } from "../fs";
import { Shell } from "../shell";
import path = require("path");
import * as k8s from "vscode-kubernetes-tools-api";
import { failed, succeeded } from "../errorable";
import {
  affectsUs,
  getCheckForKindUpgrade,
  getToolPath,
} from "../config/config";
import * as binutil from "../binutil";
import { getStableKindVersion, installKind } from "../installer/installKind";
import { CONFIG_DIR, KIND_SHARED_TERMINAL } from "../constants";
import { WindowUtil } from "../utils/windowUtils";
import { asVersionNumber } from "../utils/versionUtils";
import * as semver from "semver";
import { GlooEdgeExplorer } from "../tree/glooEdgeExplorer";
import { checkClusterStatus } from "../utils/clusterChecks";
import { executeErrorableAction, executeWithProgress } from "../commands/progressableCommands";

const COMMAND = "kind";

class KindClusterItem implements QuickPickItem {
  label: string;
  description?: string;
  detail?: string;
  picked?: boolean;
  alwaysShow?: boolean;
  constructor(label: string) {
    this.label = label;
  }
}

export interface Kind {
  create(clusterName?: string): Promise<void>;
  stop(clusterName?: string): Promise<void>;
  delete(): Promise<void>;
  checkPresent(mode: CheckPresentMode): Promise<boolean>;
  checkUpgradeAvailable(): void;
  setExplorer(explorer: GlooEdgeExplorer);
}

export async function create(
  host: Host,
  fs: FS,
  shell: Shell,
  kubectl: k8s.API<k8s.KubectlV1>
): Promise<Kind> {
  const context = {
    host: host,
    fs: fs,
    shell: shell,
    binFound: false,
    binPath: `${COMMAND}`,
  };
  const gotKind = await checkPresent(context,CheckPresentMode.Silent);
  if (!gotKind) {
    const progressOptions = {
      title: `${COMMAND} not found installing...`,
      location: ProgressLocation.Notification,
    };
    const successMessage = `Successfuly installed ${COMMAND}`;
    const errorMessage = `Failed to update ${COMMAND}`;

    const actionPromise = installKind(shell, undefined);

    await executeErrorableAction(progressOptions,actionPromise,successMessage,[],errorMessage);
  }
  return new KindImpl(context,kubectl);
}

export class KindImpl implements Kind {
  private sharedTerminal: Terminal | null = null;
  private _explorer: GlooEdgeExplorer;

  constructor(
    private readonly context: Context,
    private readonly kubectl: k8s.API<k8s.KubectlV1>
  ) {
    this.context = context;
  }

  setExplorer(explorer: GlooEdgeExplorer): void {
    this._explorer = explorer;
  }

  async create(clusterName?: string): Promise<void> {
    //TODO throw file open dialog
    const kindConfig = path.join(__dirname, CONFIG_DIR, "kind-config.yaml");
    if (!clusterName) {
      clusterName = await window.showInputBox({
        value: "kind",
        placeHolder: "Name of the Kind cluster to create",
        validateInput: (text) => {
          if (!text) {
            window.showErrorMessage("Please enter a valid cluster name");
            return text;
          }
          return null;
        },
      });
      if (clusterName === undefined) {
        return;
      }
    }
    try {
      console.debug(
        `Creating Cluster: ${clusterName} with config ${kindConfig}`
      );

      //progress bar options
      const progressOptions = {
        title: `Creating Kind cluster ${clusterName}`,
        location: ProgressLocation.Notification,
      };

      //messages
      const successMessage = `Successfuly created Kind cluster ${clusterName}`;
      const errorMessage = `Failed to create kind cluster ${clusterName}`;

      // the initial progress action 
      const actionPromise = this.execute(
        [
          "create",
          "cluster",
          "--name",
          clusterName,
          "--config",
          kindConfig,
        ],
        undefined,
        false
      );

      //promises that need to be resolved on succcess
      const successPromises = [];
      successPromises.push(checkClusterStatus());
      successPromises.push(this._explorer.refresh());
      
      await executeWithProgress(progressOptions, actionPromise,successMessage, successPromises, errorMessage,this.isCreated);
    } catch (err) {
      console.error(err);
    }
  }

  checkUpgradeAvailable(): void {
    kindUpgradeAvailable(this.context);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async stop(clusterName?: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async delete(): Promise<void> {
    try {
      const kindClusterResult = await this.execute(
        ["get", "clusters"],
        undefined,
        false
      );
      // kind sends to error stream
      if (kindClusterResult.error) {
        window.showErrorMessage(`${kindClusterResult.error}`);
        return;
      }
      const kindClusterItems = kindClusterResult.stdout?.trim().split("\n");
      const kindClustersQuickPick = window.createQuickPick<KindClusterItem>();
      kindClustersQuickPick.placeholder = "Select Kind cluster(s) to delete";
      kindClustersQuickPick.items = kindClusterItems.map(
        (i) => new KindClusterItem(i)
      );
      kindClustersQuickPick.canSelectMany = true;
      kindClustersQuickPick.onDidChangeSelection(async (clusters) => {
        if (clusters) {
          for await (const kindCluster of clusters) {
            const clusterName = kindCluster.label;
            kindClustersQuickPick.hide();
            await this.deleteCluster(clusterName?.trim());
          }
        }
      });
      kindClustersQuickPick.onDidHide(() => kindClustersQuickPick.dispose());
      kindClustersQuickPick.show();
    } catch (err) {
      console.error(err);
    }
  }

  async deleteCluster(kindCluster: string): Promise<void> {
    try {
      const progressOptions = {
        title: `Deleting Kind cluster ${kindCluster}`,
        location: ProgressLocation.Notification,
      };
      const actionPromise = this.execute(
        ["delete", "cluster", "--name", kindCluster],
        undefined,
        false
      );
      const successMessage = `Successfuly deleted Kind cluster ${kindCluster}`;
      const errorMessage = `Failed to delete kind cluster ${kindCluster}`;
      
      //promises that need to be resolved on succcess
      const successPromises = [];
      successPromises.push(checkClusterStatus());
      successPromises.push(this._explorer.refresh());

      await executeWithProgress(progressOptions,actionPromise,successMessage,successPromises,errorMessage,this.isDeleted);
    } catch (err) {
      console.error(err);
    }
  }

  checkPresent(mode: CheckPresentMode): Promise<boolean> {
    return checkPresent(this.context, mode);
  }

  async execute(
    commandArgs: string[],
    cwd?: string,
    fail = true
  ): Promise<CliExitData> {
    const command = await this.newKindCommand(...commandArgs);
    //console.debug(`Kind command::${cliCommandToString(command)}`);
    const toolLocation = getToolPath(
      this.context.host,
      this.context.shell,
      COMMAND
    );
    if (toolLocation) {
      // eslint-disable-next-line require-atomic-updates
      command.cliCommand = command.cliCommand
        .replace(`${COMMAND}`, `"${toolLocation}"`)
        .replace(new RegExp(`&& ${COMMAND}`, "g"), `&& "${toolLocation}"`);
    }

    return cli
      .execute(command, cwd ? { cwd } : {})
      .then(async (result) =>
        result.error && fail ? Promise.reject(result.error) : result
      )
      .catch((err) =>
        fail
          ? Promise.reject(err)
          : Promise.resolve({ error: null, stdout: "", stderr: "" })
      );
  }
  /**
   *
   * @param commandArgs
   * @returns
   */
  async newKindCommand(...commandArgs: string[]): Promise<CliCommand> {
    return createCliCommand(COMMAND, ...commandArgs);
  }

  async executeInTerminal(command: CliCommand, opts: ExecOpts): Promise<void> {
    const toolLocation = path.dirname(
      getToolPath(this.context.host, this.context.shell, `${COMMAND}`)
    );
    let terminal: Terminal;
    if (!opts.shared) {
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
  getSharedTerminal(toolLocation: string): Terminal {
    if (!this.sharedTerminal) {
      this.sharedTerminal = WindowUtil.createTerminal(
        KIND_SHARED_TERMINAL,
        process.cwd(),
        toolLocation
      );
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

  private isCreated(kindCluster: string, stdout: string): boolean {
    const mlineStdout = stdout.replace("\n", "\n");
    const clusterCreatedRegx = new RegExp(
      /^You\s?can\s?now\s?use\s?your\s?cluster\s?with:\n\nkubectl\s?cluster-info\s?--context\s?kind-[-\w]*$/im
    );
    return clusterCreatedRegx.test(mlineStdout);
  }

  private isDeleted(kindCluster: string, stdOutOrErr: string): boolean {
    const clusterDeleteRegx = new RegExp(
      `Deleting cluster "${kindCluster}" ...`
    );
    return clusterDeleteRegx.test(stdOutOrErr);
  }

  
}

/**
 *
 * @param context
 * @param mode
 * @returns
 */
async function checkPresent(
  context: Context,
  mode: CheckPresentMode
): Promise<boolean> {
  if (context.binFound) {
    return true;
  }
  return await checkForKindInternal(context, mode);
}

/**
 *
 * @param context
 * @param mode
 * @returns
 */
async function checkForKindInternal(
  context: Context,
  mode: CheckPresentMode
): Promise<boolean> {
  const binName = COMMAND;
  const bin = getToolPath(context.host, context.shell, binName);

  const inferFailedMessage = `Could not find "${binName}" binary.`;
  const configuredFileMissingMessage = `${bin} does not exist!`;
  return binutil.checkForBinary(
    context,
    bin,
    binName,
    inferFailedMessage,
    configuredFileMissingMessage,
    mode === CheckPresentMode.Alert
  );
}

/**
 *
 * @param context
 * @returns
 */
async function kindUpgradeAvailable(context: Context): Promise<void> {
  const kindUpgradeCheck =
    (await checkPresent(context, CheckPresentMode.Silent)) &&
    getCheckForKindUpgrade();
  if (!kindUpgradeCheck) {
    return;
  }

  let versionInfo: ToolVersionInfo;

  try {
    versionInfo = await getKindVersionInfo(context);
  } catch (err) {
    window.showErrorMessage(`Failed to determine ${COMMAND} version: ${err}`);
    return;
  }

  const avblVersionNumber = asVersionNumber(versionInfo.availableVersion);
  const isUpgradeNeeded = semver.lt(
    versionInfo.currentVersion,
    avblVersionNumber
  );

  if (isUpgradeNeeded) {
    const value = await window.showInformationMessage(
      `${COMMAND}  upgrade available to ${versionInfo.availableVersion}, currently on ${versionInfo.currentVersion}`,
      "Install"
    );
    if (value === "Install") {
      window.withProgress(
        {
          title: `Upgrading ${COMMAND}  to ${avblVersionNumber}`,
          location: ProgressLocation.Notification,
        },
        async () => {
          const result = await installKind(
            context.shell,
            versionInfo.availableVersion
          );
          if (failed(result)) {
            window.showErrorMessage(
              `Failed to update ${COMMAND} : ${result.error}`
            );
          } else if (succeeded(result)) {
            window.showInformationMessage(
              `Successfuly upgraded ${COMMAND}  to ${avblVersionNumber}`
            );
          }
        }
      );
    }
  }
}

/**
 *
 * @param context
 * @returns
 */
async function getKindVersionInfo(context: Context): Promise<ToolVersionInfo> {
  let currentVersion: string;
  let availableVersion: string;

  const version = new RegExp(/^kind\s*v?([0-9]+\.[0-9]+\.[0-9]+?).*$/i);
  const sr = await context.shell.exec(`"${context.binPath}" version`);
  if (!sr || sr.code !== 0) {
    throw new Error(
      `Error checking for ${COMMAND} updates: ${
        sr ? sr.stderr : "cannot run glooctl"
      }`
    );
  }

  const lines = sr.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const toolVersion: string = version.exec(lines[0])[1];
  if (toolVersion.length) {
    currentVersion = toolVersion;
  }

  const versionRes = await getStableKindVersion(context.shell);

  if (failed(versionRes)) {
    window.showErrorMessage(
      `Failed to determine ${COMMAND} version: ${versionRes.error}`
    );
    return;
  }

  if (currentVersion === null || availableVersion === null) {
    throw new Error(
      `Unable to get version from ${COMMAND} version check: ${lines}`
    );
  }

  return {
    currentVersion: currentVersion,
    availableVersion: versionRes.result,
  } as ToolVersionInfo;
}
