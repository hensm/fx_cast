import Cocoa


class AppDelegate : NSObject, NSApplicationDelegate {
    var initData: InitData!

    var mainWindow: NSWindow?
    var mainWindowController: NSWindowController?
    var mainWindowViewController: ViewController?


    func applicationDidFinishLaunching (_ aNotification: Notification) {
        if (CommandLine.argc < 2) {
            fputs("Error: Not enough args\n", stderr)
            exit(1)
        }

        guard let data = CommandLine.arguments[1].data(using: .utf8) else {
            fputs("Error: Failed to convert input to data\n", stderr)
            exit(1)
        }

        do {
            // Decode and store initialization JSON data
            self.initData = try JSONDecoder().decode(InitData.self, from: data)
        } catch {
            fputs("Error: Failed to parse input data\n", stderr)
            exit(1)
        }


        let window = NSWindow(
                contentRect: NSZeroRect
              , styleMask: [ .titled, .closable ]
              , backing: .buffered
              , defer: false)

        let screenHeight = NSScreen.main!.frame.height

        window.titleVisibility = .hidden
        window.isMovableByWindowBackground = true
        window.orderFrontRegardless()
        window.setFrameTopLeftPoint(NSPoint(
                x: self.initData.windowPositionX
              , y: Int(screenHeight - CGFloat(self.initData.windowPositionY))))

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
