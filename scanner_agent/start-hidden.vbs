' Starts the QLess Scanner Agent with no black window.
' Put a SHORTCUT to this file in the Startup folder (Win + R, type shell:startup)
' so the agent starts every time Windows starts.
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "cmd /c cd /d """ & folder & """ && node scanner-agent.js", 0, False