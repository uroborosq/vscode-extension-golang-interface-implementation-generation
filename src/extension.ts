import { execFileSync } from 'child_process';

import path = require('path');
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	let dd = vscode.languages.registerCodeActionsProvider(
		'go',
		new ImplementationGenerator(),
		{ providedCodeActionKinds: [vscode.CodeActionKind.Refactor] }
	);
	context.subscriptions.push(dd);

	let disposable = vscode.commands.registerCommand('golang-interface-implementation-generation.generate', async() => { insertImplementation(); });
	context.subscriptions.push(disposable);

}

export function deactivate() { }


function execGoPkgBinary(binaryName: string, args: string[], document: vscode.TextDocument) {
	let goPath = process.env.GOPATH;
	goPath += path.sep + "bin" + path.sep + binaryName;
	if (process.platform === 'win32') {
		goPath += ".exe";
	}
	let _a;
	if (goPath !== undefined) {
		try {
			const p = execFileSync(goPath, args, { cwd: (path.dirname)(document.fileName) });
			return p.toString();
		}
		catch (e: any) {
			if (e.code === "ENOENT") {
				console.log(e.code);
				console.log(document.fileName);
				vscode.window.showErrorMessage("Can not find \"impl\" package. Please run go install ");
				return "";
			}
			vscode.window.showInformationMessage(`Cannot stub interface: }`);
			return "";
		}
	}
	return "";
}

function generateGoStructDefinition(name: string) {
	let structDefinition: Array<string> = ["type ",
		name,
		" struct {\n",
		"}\n"];

	return structDefinition.join("");
}

export class ImplementationGenerator implements vscode.CodeActionProvider {
	async provideCodeActions(document: vscode.TextDocument, range: vscode.Selection | vscode.Range): Promise<vscode.CodeAction[] | undefined> {

		let wordRange: vscode.Range;

		if (range.start.character === range.end.character) {
			let tmp = document.getWordRangeAtPosition(new vscode.Position(range.start.line, range.start.character));
			if (tmp !== undefined) {
				wordRange = tmp;
			}
			else {
				return;
			}
		}
		else {
			return;
		}

		if (!this.isInterface(document.lineAt(wordRange.start.line).text, wordRange.start.character, wordRange.end.character)) {
			return;
		}


		let refactor = new vscode.CodeAction("Generate implementaton", vscode.CodeActionKind.Refactor);
		refactor.command = { command: 'golang-interface-implementation-generation.generate', title: "do it", tooltip: "just do it" };

		return [refactor];
	}

	private isInterface(line: string, start: number, end: number) {
		let first = line.slice(0, start).trim().split(" ");
		if (line.slice(0, start).trim().split(" ")[first.length - 1] === 'type' && line.slice(end).trim().split(" ")[0] === 'interface') {
			return true;
		}
		return false;
	}
}



async function insertImplementation() {
	let activeEditor = vscode.window.activeTextEditor;
		if (activeEditor === undefined) { return; }
		let document = activeEditor.document;
		let curPos = activeEditor.selection.active;
		let wordRange = document.getWordRangeAtPosition(curPos);
		if (wordRange === undefined) { return; }
		let interfaceName = document.lineAt(wordRange.start.line).text.slice(wordRange.start.character, wordRange.end.character);
		let insertChar = undefined;
		let insertPos = new vscode.Position(0, 0);

		for (let i = wordRange.start.line + 1; i < document.lineCount; i++) {
			let potentialInsertChar = document.lineAt(i).text.indexOf("}");
			if (potentialInsertChar !== -1) {
				insertChar = potentialInsertChar;
				insertPos = new vscode.Position(i + 1, insertChar);
				break;
			}
		}
		const userInput = await vscode.window.showInputBox({
			placeHolder: "Implementation's name",
			prompt: "Enter name of new implementation"
		});

		if (userInput === '') {
			vscode.window.showErrorMessage("Input is empty");
		}

		if (userInput === undefined) { return; }

		let newArgs: Array<string> = [userInput[0].toLocaleLowerCase() + " *" + userInput, interfaceName];
		let methods = execGoPkgBinary("impl", newArgs, document);
		let toInsert: Array<string> = [
			"\n",
			generateGoStructDefinition(userInput),
			"\n",
			methods,
			"\n",
		];

		activeEditor.edit((editBuilder) => {
			editBuilder.insert(insertPos, toInsert.join(""));
		});

}