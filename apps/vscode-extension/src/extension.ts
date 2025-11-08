import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand("driftcore.hello", () => {
    vscode.window.showInformationMessage("DriftCore extension placeholder");
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {
  // TODO: Clean up resources and MCP connections when the extension unloads.
}
