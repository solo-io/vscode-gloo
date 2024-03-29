/* eslint-disable header/header */
/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
"use strict";

import * as vscode from "vscode";
import { SpawnOptions, spawn } from "child_process";
import * as stream from "stream";
import * as events from "events";
import JStream = require('jstream');

export interface CliExitData {
  readonly error: string | Error;
  readonly stdout: string;
}

export interface Cli {
  execute(cmd: CliCommand, opts?: SpawnOptions): Promise<CliExitData>;
  executeWatch(cmd: CliCommand, opts?: SpawnOptions): WatchProcess;

  /**
   * Execute command, receive parsed JSON output as JS object in on('object') event
   * @param cmd
   * @param opts
   */
  executeWatchJSON(cmd: CliCommand, opts?: SpawnOptions): JSONWatchProcess;
}

export interface IGlooChannel {
  print(text: string, json?: boolean): void;
  show(): void;
  showOutput(message: string, title?: string): void;
}

export interface CliCommand {
  cliCommand: string;
  cliArguments: string[];
}

export interface WatchProcess extends events.EventEmitter {
  stdout: stream.Readable;
  stderr: stream.Readable;
  kill();
  readonly killed: boolean;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  on(event: "close", listener: (code: number) => void): this;
}

export interface JSONWatchProcess {
  stderr: stream.Readable;
  kill();
  readonly killed: boolean;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  on(event: "close", listener: (code: number) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: "object", listener: (obj: any) => void): this;
}

export function createCliCommand(
  cliCommand: string,
  ...cliArguments: string[]
): CliCommand {
  if (!cliArguments) {
    cliArguments = [];
  }
  return { cliCommand, cliArguments };
}

export function cliCommandToString(command: CliCommand): string {
  return `${command.cliCommand} ${command.cliArguments.join(" ")}`;
}

//TODO do we need one channel each for mesh and edge ??
class GlooChannelImpl implements IGlooChannel {
  private readonly channel: vscode.OutputChannel;

  constructor(channelName?: string) {
    this.channel = vscode.window.createOutputChannel(channelName ?? "Gloo");
  }

  show(): void {
    this.channel.show();
  }

  showOutput(message: string, title?: string): void {
    if (title) {
      const simplifiedTime = new Date()
        .toISOString()
        .replace(/z|t/gi, " ")
        .trim(); // YYYY-MM-DD HH:mm:ss.sss
      const hightlightingTitle = `[${title} ${simplifiedTime}]`;
      this.channel.appendLine(hightlightingTitle);
    }
    this.channel.appendLine(message);
    this.channel.show();
  }

  prettifyJson(str: string): string {
    let jsonData: string;
    try {
      jsonData = JSON.stringify(JSON.parse(str), null, 2);
    } catch (ignore) {
      return str;
    }
    return jsonData;
  }

  print(text: string, json = false): void {
    const textData = json ? this.prettifyJson(text) : text;
    this.channel.append(textData);
    if (textData.charAt(textData.length - 1) !== "\n") {
      this.channel.append("\n");
    }
    if (
      vscode.workspace
        .getConfiguration("vs-gloo")
        .get<boolean>("showChannelOnOutput")
    ) {
      this.channel.show();
    }
  }
}

export const glooChannel: IGlooChannel = new GlooChannelImpl();

export class CliImpl implements Cli {
  async execute(
    cmd: CliCommand,
    opts: SpawnOptions = {}
  ): Promise<CliExitData> {
    return new Promise<CliExitData>((resolve) => {
      glooChannel.print(cliCommandToString(cmd));
      if (opts.windowsHide === undefined) {
        opts.windowsHide = true;
      }
      if (opts.shell === undefined) {
        opts.shell = true;
      }
      const glooCmd = spawn(cmd.cliCommand, cmd.cliArguments, opts);
      let stdout = "";
      let error: string | Error;
      glooCmd.stdout.on("data", (data) => {
        stdout += data;
      });
      glooCmd.stderr.on("data", (data) => {
        if (!error) {
          error = "";
        }
        error += data;
      });
      glooCmd.on("error", (err) => {
        // do not reject it here, because caller in some cases need the error and the streams
        // to make a decision
        error = err;
      });
      glooCmd.on("close", () => {
        resolve({ error, stdout });
      });
    });
  }

  executeWatch(cmd: CliCommand, opts: SpawnOptions = {}): WatchProcess {
    if (opts.windowsHide === undefined) {
      opts.windowsHide = true;
    }
    if (opts.shell === undefined) {
      opts.shell = true;
    }
    const commandProcess = spawn(cmd.cliCommand, cmd.cliArguments, opts);

    return commandProcess;
  }

  executeWatchJSON(cmd: CliCommand, opts: SpawnOptions = {}): JSONWatchProcess {
    const proc = this.executeWatch(cmd, opts);
    proc.stdout.pipe(new JStream()).on("data", (obj) => {
      proc.emit("object", obj);
    });
    return proc;
  }
}

export const cli = new CliImpl();
