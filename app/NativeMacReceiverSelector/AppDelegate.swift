import Cocoa


class AppDelegate: NSObject {
    var mainWindow: NSWindow?
    var mainWindowController: NSWindowController?
    var mainWindowViewController: ViewController?
}

extension AppDelegate: NSApplicationDelegate {
    func applicationDidFinishLaunching(_ aNotification: Notification) {
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

        window.title = "fx_cast"
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

    func applicationWillTerminate(_ aNotification: Notification) {}

    func applicationShouldTerminateAfterLastWindowClosed(_ app: NSApplication) -> Bool {
        return true
    }
}
