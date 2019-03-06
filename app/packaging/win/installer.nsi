!include LogicLib.nsh

!define MANIFEST_KEY "Software\Mozilla\NativeMessagingHosts\{{applicationName}}"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\{{winRegistryKey}}"

Name "{{applicationName}} v{{applicationVersion}}"
OutFile "{{outputName}}"
InstallDir "{{executablePath}}"
RequestExecutionLevel user

Section
    SetRegView 64

    SetOutPath $INSTDIR

    # Main executable
    File "{{executableName}}"
    File "{{manifestName}}"

    # Native manifest key
    WriteRegStr HKLM "${MANIFEST_KEY}" "" "$INSTDIR\{{manifestName}}"

    # Create and register uninstaller
    WriteUninstaller "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayName" "{{applicationName}}"
    WriteRegStr HKLM "${UNINSTALL_KEY}" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
    WriteRegStr HKLM "${UNINSTALL_KEY}" "QuietUninstallString" "$\"$INSTDIR\uninstall.exe$\" /S"
SectionEnd

Section "uninstall"
    SetRegView 64

    # Remove uninstaller
    Delete "$INSTDIR\uninstall.exe"
    DeleteRegKey HKLM "${UNINSTALL_KEY}"

    # Remove manifest and executable dir
    DeleteRegKey HKLM "${MANIFEST_KEY}"
    Delete "$INSTDIR\{{executableName}}"
    Delete "$INSTDIR\{{manifestName}}"
    RMDir $INSTDIR
SectionEnd
