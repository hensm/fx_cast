import Cocoa

class WindowController: NSWindowController {
    override func windowDidLoad() {
        super.windowDidLoad()
        
        if let appDelegate = NSApplication.shared.delegate as? AppDelegate {
            appDelegate.mainWindow = self.window
        }
        
        if let window = self.window
         , let screen = window.screen {
            let windowX = InitDataProvider.shared.data.windowPositionX
            let windowY = Int(screen.frame.height - CGFloat(
                    InitDataProvider.shared.data.windowPositionY))

            window.setFrameTopLeftPoint(NSPoint(x: windowX, y: windowY))

            window.title = InitDataProvider.shared.data.i18n_extensionName
            window.titleVisibility = .visible
            
            NSApp.activate(ignoringOtherApps: true)
        }
    }
}
