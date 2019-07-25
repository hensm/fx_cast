import Cocoa


class ViewController : NSViewController {
    var initData: InitData!

    var mediaTypePopUpButton: NSPopUpButton!
    var receiverViews = [ReceiverView]()

    var filePath: String?


    override func loadView () {
        /*let visualEffectView = NSVisualEffectView()
        visualEffectView.blendingMode = .behindWindow
        visualEffectView.state = .active*/

        self.view = NSView()
    }

    override func viewDidLoad () {
        super.viewDidLoad()

        self.initData = (NSApplication.shared.delegate as! AppDelegate).initData

        /**
         * View Hierarchy
         * --------------
         *
         * stackView                  \ (NSStackView)
         *  ├ mediaTypeStackView      \  (NSStackView)
         *  │  ├ mediaSelectCastLabel \    (NSTextField)
         *  │  ├ mediaTypePopUpButton \    (NSPopUpButton)
         *  │  └ mediaSelectToLabel   \    (NSTextField)
         *  │
         *  ├ receiverSeparator       \  (NSBox)                    ┐
         *  └ receiverView            \  (ReceiverView:NSStackView) │
         *     ├ metaStackView        \    (NSStackView)            │
         *     │  ├ receiver name     \      (NSTextField)          ├ Repeats
         *     │  └ receiver host     \      (NSTextField)          │
         *     ├ spinner              \    (NSProgressIndicator)    │
         *     └ button               \    (NSButton)               ┘
         */


        let stackView = NSStackView()
        stackView.orientation = .vertical
        stackView.alignment = .leading
        stackView.autoresizingMask = [ .width, .height ]
        stackView.edgeInsets = NSEdgeInsetsMake(8, 8, 8, 8)


        self.mediaTypePopUpButton = NSPopUpButton()
        self.mediaTypePopUpButton.autoenablesItems = false
        self.mediaTypePopUpButton.addItems(withTitles: [
            initData.i18n_mediaTypeApp
          , initData.i18n_mediaTypeTab
          , initData.i18n_mediaTypeScreen
          , initData.i18n_mediaTypeFile
        ])

        let mediaTypePopUpButtonMenu = self.mediaTypePopUpButton.menu!
        mediaTypePopUpButtonMenu.delegate = self

        let appItem = self.mediaTypePopUpButton
            .item(withTitle: initData.i18n_mediaTypeApp)!
        let tabItem = self.mediaTypePopUpButton
            .item(withTitle: initData.i18n_mediaTypeTab)!
        let screenItem = self.mediaTypePopUpButton
            .item(withTitle: initData.i18n_mediaTypeScreen)!
        let fileItem = self.mediaTypePopUpButton
            .item(withTitle: initData.i18n_mediaTypeFile)!

        mediaTypePopUpButtonMenu
            .insertItem(NSMenuItem.separator()
                  , at: mediaTypePopUpButtonMenu.index(of: fileItem))

        // Set tags to enum value
        appItem.tag = MediaType.app.rawValue
        tabItem.tag = MediaType.tab.rawValue
        screenItem.tag = MediaType.screen.rawValue
        fileItem.tag = MediaType.file.rawValue

        for item in self.mediaTypePopUpButton.itemArray {
            if (initData.availableMediaTypes & item.tag) == 0 {
                item.isEnabled = false
            }
        }

        self.mediaTypePopUpButton.selectItem(
                withTag: initData.defaultMediaType.rawValue)


        let mediaTypeStackView = NSStackView(views: [
            makeLabel(initData.i18n_mediaSelectCastLabel),
            self.mediaTypePopUpButton,
            makeLabel(initData.i18n_mediaSelectToLabel)
        ])

        stackView.addArrangedSubview(mediaTypeStackView)


        /**
         * For each receiver in the initData list, create a new
         * ReceiverView, set self as a ReceiverViewDelegate and
         * appends to main stack view.
         *
         * Keeps a reference to the receiver view to call disable()
         * later.
         */
        for receiver in initData.receivers {
            // Create separator between last receiver / media type
            let receiverSeparator = NSBox()
            receiverSeparator.boxType = .separator

            let receiverView = ReceiverView(
                    receiver: receiver
                  , initData: self.initData)

            receiverView.receiverViewDelegate = self


            self.receiverViews.append(receiverView)

            stackView.addArrangedSubview(receiverSeparator)
            stackView.addArrangedSubview(receiverView)
        }


        // Add to main view and set width to resize window
        self.view.addSubview(stackView)
        self.view.autoresizesSubviews = true
        self.view.frame.size.width = 350
    }

    override func viewDidAppear () {
        // Set window title and update visibility
        let window = self.view.window!
        window.title = initData.i18n_extensionName
        window.titleVisibility = .visible
    }
}

extension ViewController : NSMenuDelegate {
    func menuDidClose (_ menu: NSMenu) {
        let mediaType = MediaType(
                rawValue: self.mediaTypePopUpButton.selectedItem!.tag)!

        let fileItem = self.mediaTypePopUpButton
                .item(at: self.mediaTypePopUpButton.indexOfItem(
                        withTag: MediaType.file.rawValue))!

        if (mediaType == .file) {
            let panel = NSOpenPanel()
            panel.allowsMultipleSelection = false
            panel.allowedFileTypes = [ "aac", "mp3", "mp4", "wav", "webm" ]
            panel.canChooseDirectories = false
            panel.canCreateDirectories = false
            panel.canChooseFiles = true

            panel.beginSheetModal(for: self.view.window!) { (result) in
                if (result == .OK) {
                    let url = panel.urls[0]
                    let fileName = url.lastPathComponent

                    // Truncate file name and set as title
                    fileItem.title = fileName.count > 12
                        ? "\(fileName.prefix(12))..."
                        : fileName

                    self.filePath = url.path

                    return
                } else {
                    // Re-select the default media type item
                    self.mediaTypePopUpButton.selectItem(
                            withTag: self.initData.defaultMediaType.rawValue)
                }
            }
        }


        // Reset file item
        fileItem.title = self.initData.i18n_mediaTypeFile
        self.filePath = nil
    }
}

extension ViewController : ReceiverViewDelegate {
    func didCast (_ receiver: Receiver) {

        // Disable media type UI
        self.mediaTypePopUpButton.isEnabled = false

        // Disable cast buttons
        for receiverView in self.receiverViews {
            receiverView.isEnabled = false
        }

        do {
            let mediaType = MediaType(
                    rawValue: self.mediaTypePopUpButton.selectedItem!.tag)!

            let selection = ReceiverSelection(
                    receiver: receiver
                  , mediaType: mediaType
                  , filePath: self.filePath ?? nil)

            let jsonData = try JSONEncoder().encode(selection)
            let jsonString = String(data: jsonData, encoding: .utf8)

            print(jsonString!)
            fflush(stdout)
        } catch {
            fputs("Error: Failed to encode output data", stderr)
            exit(1)
        }
    }
}
