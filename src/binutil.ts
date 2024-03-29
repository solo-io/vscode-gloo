/* eslint-disable header/header */

//https://github.com/Azure/vscode-kubernetes-tools
/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as config from "./config/config";
import { Shell } from "./shell";
import { Host } from "./host";
import { FS } from "./fs";
import { installDependencies } from "./installer/installdependencies";

export interface BinCheckContext {
    readonly host: Host;
    readonly fs: FS;
    readonly shell: Shell;
    binFound: boolean;
    binPath: string;
}

interface FindBinaryResult {
    err: number | null;
    output: string;
}

async function findBinary(shell: Shell, binName: string): Promise<FindBinaryResult> {
  let cmd = `which ${binName}`;

  if (shell.isWindows()) {
    cmd = `where.exe ${binName}.exe`;
  }

  const opts = {
    async: true,
    env: {
      HOME: process.env.HOME,
      PATH: process.env.PATH
    }
  };

  const execResult = await shell.execCore(cmd, opts);
  if (execResult.code) {
    return { err: execResult.code, output: execResult.stderr };
  }

  return { err: null, output: execResult.stdout };
}

export function execPath(shell: Shell, basePath: string): string {
  let bin = basePath;
  if (shell.isWindows() && bin && !(bin.endsWith(".exe"))) {
    bin = bin.slice(-1) === "\"" ? `${bin.slice(0, -1)}.exe"` : `${bin}.exe`;
  }
  return bin;
}

type CheckPresentFailureReason = "inferFailed" | "configuredFileMissing";

function alertNoBin(host: Host, binName: string, failureReason: CheckPresentFailureReason, message: string): void {
  switch (failureReason) {
    case "inferFailed":
      host.showErrorMessage(message, "Install dependencies", "Learn more").then(
        (str) => {
          switch (str) {
            case "Learn more":
              host.showInformationMessage(`Add ${binName} directory to path, or set "vscode-gloo.${binName}-path" config to ${binName} binary.`);
              break;
            case "Install dependencies":
              installDependencies();
              break;
          }

        }
      );
      break;
    case "configuredFileMissing":
      host.showErrorMessage(message, "Install dependencies").then(
        (str) => {
          if (str === "Install dependencies") {
            installDependencies();
          }
        }
      );
      break;
  }
}

export async function checkForBinary(context: BinCheckContext, bin: string | undefined, binName: string, inferFailedMessage: string, configuredFileMissingMessage: string, alertOnFail: boolean): Promise<boolean> {
  if (!bin) {
    const fb = await findBinary(context.shell, binName);

    if (fb.err || fb.output.length === 0) {
      if (alertOnFail) {
        alertNoBin(context.host, binName, "inferFailed", inferFailedMessage);
      }
      return false;
    }

    context.binFound = true;

    return true;
  }

  if (!config.getUseWsl()) {
    context.binFound = context.fs.existsSync(bin);
  } else {
    const sr = await context.shell.exec(`ls ${bin}`);
    context.binFound = (!!sr && sr.code === 0);
  }
  if (context.binFound) {
    context.binPath = bin;
  } else {
    if (alertOnFail) {
      alertNoBin(context.host, binName, "configuredFileMissing", configuredFileMissingMessage);
    }
  }

  return context.binFound;
}
