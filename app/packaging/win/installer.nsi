!include MUI2.nsh

# MUI general
!define MUI_ABORTWARNING
!insertmacro MUI_LANGUAGE "English"

# Installer pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "{{{licensePath}}}"
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

# Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH


# Registry keys
!define KEY_MANIFEST "Software\Mozilla\NativeMessagingHosts\{{applicationName}}"
!define KEY_UNINSTALL "Software\Microsoft\Windows\CurrentVersion\Uninstall\{{winRegistryKey}}"


# Application name
Name "{{applicationName}} v{{applicationVersion}}"

OutFile "{{outputName}}"        # Installer filename
InstallDir "{{executablePath}}" # Installation directory

# Version info
VIProductVersion "{{applicationVersion}}.0"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductName" "{{applicationName}}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileVersion" "{{applicationVersion}}"

# Need admin privileges for global install
RequestExecutionLevel admin

Section
    SetRegView 64
    SetOutPath $INSTDIR

    # Main executable
    File "{{executableName}}"
    File "{{manifestName}}"

    # Native manifest key
    WriteRegStr HKLM "${KEY_MANIFEST}" "" "$INSTDIR\{{manifestName}}"

    # Create and register uninstaller
    WriteUninstaller "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM ${KEY_UNINSTALL} DisplayName "{{applicationName}}"
    WriteRegStr HKLM ${KEY_UNINSTALL} DisplayVersion "{{applicationVersion}}"
    WriteRegStr HKLM ${KEY_UNINSTALL} Publisher "{{{registryPublisher}}}"
    WriteRegStr HKLM ${KEY_UNINSTALL} URLInfoAbout "{{{registryUrlInfoAbout}}}"
    WriteRegStr HKLM ${KEY_UNINSTALL} InstallLocation "$\"$INSTDIR$\""
    WriteRegStr HKLM ${KEY_UNINSTALL} UninstallString "$\"$INSTDIR\uninstall.exe$\""
    WriteRegStr HKLM ${KEY_UNINSTALL} QuietUninstallString "$\"$INSTDIR\uninstall.exe$\" /S"
    WriteRegDWORD HKLM ${KEY_UNINSTALL} NoModify 1
    WriteRegDWORD HKLM ${KEY_UNINSTALL} NoRepair 1
SectionEnd

Section "uninstall"
    SetRegView 64

    # Remove uninstaller
    Delete "$INSTDIR\uninstall.exe"
    DeleteRegKey HKLM ${KEY_UNINSTALL}

    # Remove manifest and executable dir
    DeleteRegKey HKLM ${KEY_MANIFEST}
    Delete "$INSTDIR\{{executableName}}"
    Delete "$INSTDIR\{{manifestName}}"
    RMDir $INSTDIR
SectionEnd
