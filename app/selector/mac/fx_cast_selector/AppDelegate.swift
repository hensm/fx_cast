import Cocoa

@NSApplicationMain
class AppDelegate: NSObject, NSApplicationDelegate {
    weak var mainWindow: NSWindow!

    func applicationDidResignActive (_ aNotification: Notification) {
        if InitDataProvider.shared.data.closeIfFocusLost {
            self.mainWindow?.performClose(aNotification)
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(
            _ sender: NSApplication) -> Bool {
        return true
    }
}

