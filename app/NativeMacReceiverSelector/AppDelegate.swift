import Cocoa


class AppDelegate : NSObject, NSApplicationDelegate {
    var mainWindow: NSWindow?
    var mainWindowController: NSWindowController?
    var mainWindowViewController: ViewController?


    func applicationDidFinishLaunching (_ aNotification: Notification) {
        let window = NSPanel(
                contentRect: NSZeroRect
              , styleMask: [
                    .titled
                  , .closable
                  , .hudWindow
                  , .utilityWindow
                  , .nonactivatingPanel
                ]
              , backing: .buffered
              , defer: false)

        window.titleVisibility = .hidden
        window.orderFrontRegardless()
        window.center()

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
        self.mainWindow?.performClose(aNotification)
    }

    func applicationShouldTerminateAfterLastWindowClosed (
            _ app: NSApplication) -> Bool {
        return true
    }
}
