/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Kamesh Sampath<kamesh.sampath@hotmail.com>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

const id = new RegExp("^[A-Za-z0-9]+");
//format of kind/resource@uid.namespace
const uidRegex = new RegExp(/@[A-Za-z0-9]+\.[a-z0-9]([-a-z0-9]*[a-z0-9])?$/);

export function newFileName(name: string, uid: string): string {
  return `${name}@${uid.match(id)[0]}`;
}

export function originalFileName(name: string): string {
  return name.replace(uidRegex, "");
}
