import Cocoa


class AppDelegate : NSObject, NSApplicationDelegate {
    var mainWindow: NSWindow?
    var mainWindowController: NSWindowController?
    var mainWindowViewController: ViewController?


    func applicationDidFinishLaunching (_ aNotification: Notification) {
        let window = NSWindow(
                contentRect: NSZeroRect
              , styleMask: [ .titled, .closable ]
              , backing: .buffered
              , defer: false)

        window.titleVisibility = .hidden
        window.isMovableByWindowBackground = true
        window.orderFrontRegardless()
        
        if let screen = NSScreen.main {
            let windowX = InitDataProvider.shared.data.windowPositionX
            let windowY = Int(screen.frame.height - CGFloat(
                    InitDataProvider.shared.data.windowPositionY))

            window.setFrameTopLeftPoint(NSPoint(x: windowX, y: windowY))
        }


        let windowController = NSWindowController(window: window)
        windowController.showWindow(window)

        let viewController = ViewController()
        window.contentViewController = viewController
        window.makeKeyAndOrderFront(self)

        self.mainWindow = window
        self.mainWindowController = windowController
        self.mainWindowViewController = viewController

        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationDidResignActive (_ aNotification: Notification) {
        if InitDataProvider.shared.data.closeIfFocusLost {
            self.mainWindow?.performClose(aNotification)
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed (
            _ app: NSApplication) -> Bool {
        return true
    }
}
