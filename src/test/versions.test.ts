/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { succeeded } from "../errorable";
import { getStableReleases } from "../utils/versionUtils";

describe("Test glooctl and meshctl Release Caching",()=>{
  it("cache and get glooctl/meshctl releases",async ()=>{
    let releseResult; 
    releseResult = await getStableReleases("solo-io","gloo");
    assert.isTrue(succeeded(releseResult),"Suceeded");
    releseResult = await getStableReleases("solo-io","gloo-mesh");
    assert.isTrue(succeeded(releseResult),"Suceeded");
  });
});
