/* eslint-disable header/header */

/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
export type Dictionary<T> = {
    [key: string]: T;
};

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Dictionary {
  export function of<T>(): Dictionary<T> {
    return {};
  }
}
