/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Octokit } from "octokit";
import * as semver from "semver";
import { Errorable,failed } from "../errorable";
import * as fs from "fs";
import * as moment from "moment";

const versionRe = new RegExp(/^[v]?([0-9]+\.[0-9]+\.[0-9]+[-\w]*)$/);
const stableVersionRe = new RegExp(/^[v]?([0-9]+\.[0-9]+\.[0-9]+)$/);

export function asVersionNumber(versionText: string): string{
  const versionNumbers: RegExpExecArray = versionRe.exec(versionText);

  if (versionNumbers && versionNumbers.length > 1){
    return versionNumbers[1];
  }

  return versionText;
}

export function asGithubTag(versionText: string): string{
  return `v${versionText}`;
}

export async function getStableReleases(owner:string,repo:string): Promise<Errorable<string[]>> {
  try {
    const octokit = new Octokit();
    const {data} = await octokit.rest.repos
      .listReleases({owner: owner,repo: repo});

    let stableReleases = data
      .map(r => r.tag_name)
      .filter(tag => stableVersionRe.test(tag));
    stableReleases = semver.rsort(stableReleases,{includePrerelease:false});
    return { succeeded: true, result: stableReleases };
  } catch (e){
    return { succeeded: false, error: [e.message] };
  }
}

export async function cacheAndGetLatestRelease(owner:string,repo:string,releaseCacheFile:string):Promise<Errorable<string>> {
  let releases: string[];
  try {
    const stats = await fs.promises.stat(releaseCacheFile);
    //create or refresh cache
    if (refreshCache(stats)) {
      return await cacheAndGetRelease(releaseCacheFile,repo,owner);
    } else {
      const dataBuffer = fs.readFileSync(releaseCacheFile,"utf-8");
      if (dataBuffer){
        releases = JSON.parse(dataBuffer); 
      }
    }
    return { succeeded: true, result:releases[0]};
  } catch (err){
    if (err.code == "ENOENT"){
      return await cacheAndGetRelease(releaseCacheFile,repo,owner);
    }
    return { succeeded: true, result:`Error getting from cache ${err}`};
  }
}

async function cacheAndGetRelease(releaseCacheFile:string,repo:string,owner): Promise<Errorable<string>> {
  const releasesResult = await getStableReleases(owner,repo);
  if (failed(releasesResult)) {
    return { succeeded: false, error: [`Failed to find solo-io/${repo} stable version: ${releasesResult.error[0]}`]};
  }
  const releases = releasesResult.result;
  await fs.promises.writeFile(releaseCacheFile,JSON.stringify(releases));
  return { succeeded: true, result:releases[0]};
}

//Check if the file is 24 hours old
function refreshCache(stats: fs.Stats):boolean{
  const modifiedTime = stats.mtimeMs;
  const days = moment().diff(moment(modifiedTime), "days");
  return days > 1;
}
