/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as path from "path";
import { Shell } from "../shell";
import { Errorable, failed } from "../errorable";
import * as download from "../utils/download";
import { addPathToConfig, toolPathBaseKey, toolPathOSKey } from "../config/config";
import { getInstallFolder, platformUrlString, formatBin, platformArch, baseInstallFolder } from "./installationlayout";
import { cacheAndGetLatestRelease} from "../utils/versionUtils";

export async function installKind(shell: Shell, version: string | null): Promise<Errorable<null>> {
  const tool = "kind";
  const os = platformUrlString(shell.platform());
  if (!os) {
    return { succeeded: false, error: ["Not supported on this OS"] };
  }
  if (!version) {
    const versionRes = await getStableKindVersion(shell);
    if (failed(versionRes)) {
      return { succeeded: false, error: versionRes.error };
    }
    version = versionRes.result;
  }
  const arch = platformArch(os);
  const url = `https://github.com/kubernetes-sigs/kind/${version}/kind-${os}-${arch}`;
  const installFolder = getInstallFolder(shell, tool);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const executable = formatBin(tool, shell.platform())!;  // safe because we checked platform earlier
  const executableFullPath = path.join(installFolder, executable);
  const downloadResult = await download.to(url, executableFullPath);
  if (failed(downloadResult)) {
    return { succeeded: false, error: ["Failed to download kind: error was " + downloadResult.error[0]] };
  }

  if (shell.isUnix()) {
    await shell.exec(`chmod +x ${executableFullPath}`);
  }
  
  const baseKey = toolPathBaseKey(tool);
  const osKey = toolPathOSKey(shell.platform(), tool);
  await addPathToConfig(baseKey, executableFullPath);
  await addPathToConfig(osKey, executableFullPath);

  return { succeeded: true, result: null };
}

export async function getStableKindVersion(shell: Shell): Promise<Errorable<string>> {
  const toolsBaseFolder = baseInstallFolder(shell);
  const toolReleasesFile = path.join(toolsBaseFolder,'kind-releases.json');
  const releaseCacheFile = `${toolReleasesFile}`;
  const releaseResult = await cacheAndGetLatestRelease("kubernetes-sigs","kind",releaseCacheFile);

  if (failed(releaseResult)){
    return { succeeded: false, error:releaseResult.error};
  }
  
  return { succeeded: true, result: releaseResult.result };
}
