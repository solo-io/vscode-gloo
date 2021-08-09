/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import {ProgressLocation, window} from 'vscode';
import { CliExitData } from '../cli';
import { Errorable, failed } from '../errorable';
import { getStderrString } from '../utils/stdUtil';

/**
 * 
 * @param progressOptions 
 * @param actionPromise 
 * @param successMessage 
 * @param errorMessage 
 * @param verifyActionFn 
 * @param successPromises 
 * @returns 
 */
export async function executeWithProgress(progressOptions: { title: string; location: ProgressLocation; }, actionPromise: Promise<CliExitData>, successMessage: string, errorMessage: string,verifyActionFn: (clusterName,stdOutOrErr) => boolean = alwaysTrue,...successPromises: any ) :Promise<Thenable<void>>{
  return window.withProgress(progressOptions,
    async () => {
      let result: CliExitData;
      try {
        result = await actionPromise;
        //kind returns all in error stream
        if (result.error && verifyActionFn) {
          window.showErrorMessage(
            `${errorMessage} : ${getStderrString(result.error)}`
          );
          return;
        } else {
          window.showInformationMessage(successMessage);
          await Promise.all(successPromises);
        }
      } catch (err) {
        window.showErrorMessage(
          `${errorMessage} : ${err.error}`
        );
      }
    }
  );
}

/**
 * 
 * @param progressOptions 
 * @param actionPromise 
 * @param successMessage 
 * @param errorMessage 
 * @param verifyActionFn 
 * @param successPromises 
 * @returns 
 */
export async function executeErrorableAction(progressOptions: { title: string; location: ProgressLocation; }, actionPromise: Promise<Errorable<string[]>>, successMessage: string, errorMessage: string,verifyActionFn: (clusterName,stdOutOrErr) => boolean = alwaysTrue,...successPromises: any ) :Promise<void>{
  return window.withProgress(progressOptions,
    async () => {
      let result: Errorable<string[]>;
      try {
        result = await actionPromise;
        //kind returns all in error stream
        if (failed(result) && verifyActionFn) {
          window.showErrorMessage(
            `${errorMessage} : ${result.error}`
          );
          return;
        } else {
          window.showInformationMessage(successMessage);
          if (successPromises && successPromises.length > 0){
            await Promise.all(successPromises);
          }
         
        }
      } catch (err) {
        window.showErrorMessage(
          `${errorMessage} : ${err.error}`
        );
      }
    }
  );
}

/**
 * marker function in cases of verifyFunc not provided
 * @returns true
 */
function alwaysTrue(): boolean{
  return true;
}
