import Cocoa


class ViewController : NSViewController {
    var initData: InitData!

    var mediaTypePopUpButton: NSPopUpButton!
    var receiverViews = [ReceiverView]()


    override func loadView () {
        let visualEffectView = NSVisualEffectView()
        visualEffectView.blendingMode = .behindWindow
        visualEffectView.state = .active

        self.view = visualEffectView
    }

    override func viewDidLoad () {
        super.viewDidLoad()

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
        ])

        let appItem = self.mediaTypePopUpButton
            .item(withTitle: initData.i18n_mediaTypeApp)!
        let tabItem = self.mediaTypePopUpButton
            .item(withTitle: initData.i18n_mediaTypeTab)!
        let screenItem = self.mediaTypePopUpButton
            .item(withTitle: initData.i18n_mediaTypeScreen)!

        // Set tags to enum value
        appItem.tag = MediaType.app.rawValue
        tabItem.tag = MediaType.tab.rawValue
        screenItem.tag = MediaType.screen.rawValue

        if (initData.availableMediaTypes & appItem.tag) == 0 {
            self.mediaTypePopUpButton
                .item(withTitle: initData.i18n_mediaTypeApp)?
                .isEnabled = false
        }
        if (initData.availableMediaTypes & tabItem.tag) == 0 {
            self.mediaTypePopUpButton
                .item(withTitle: initData.i18n_mediaTypeTab)?
                .isEnabled = false
        }
        if (initData.availableMediaTypes & screenItem.tag) == 0 {
            self.mediaTypePopUpButton
                .item(withTitle: initData.i18n_mediaTypeScreen)?
                .isEnabled = false
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
                  , mediaType: mediaType)

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
