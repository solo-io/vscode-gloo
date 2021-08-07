SHELL := /usr/bin/env bash
ENV_FILE := .env
include ${ENV_FILE}
export $(shell sed 's/=.*//' ${ENV_FILE})
CURRENT_DIR = $(shell pwd)
VERSION = $(shell jq -r .version $(CURRENT_DIR)/package.json)

.PHONY:	clean
clean:
	rm -rf out *.vsix

yarn.lock:
	yarn install

out/extension.js:	package-lock.json
	yarn run build

vscode-gloo-$(VERSION).vsix:
	vsce package
