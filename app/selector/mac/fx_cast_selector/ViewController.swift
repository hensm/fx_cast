import Cocoa

class ViewController: NSViewController {
    @IBOutlet weak var labelCast: NSTextField!
    @IBOutlet weak var labelTo: NSTextField!
    @IBOutlet weak var mediaTypePopUpButton: NSPopUpButton!
    
    @IBOutlet weak var mainStackView: NSStackView!

    
    var receiverViews = [ReceiverView]()
    var filePath: String?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        let initData = InitDataProvider.shared.data
        
        self.mediaTypePopUpButton.addItems(withTitles: [
            initData.i18n_mediaTypeApp
          , initData.i18n_mediaTypeTab
          , initData.i18n_mediaTypeScreen
          , initData.i18n_mediaTypeFile
        ])
        
        if let appItem = self.mediaTypePopUpButton
                .item(withTitle: initData.i18n_mediaTypeApp)
         , let tabItem = self.mediaTypePopUpButton
                .item(withTitle: initData.i18n_mediaTypeTab)
         , let screenItem = self.mediaTypePopUpButton
                .item(withTitle: initData.i18n_mediaTypeScreen)
         , let fileItem = self.mediaTypePopUpButton
                .item(withTitle: initData.i18n_mediaTypeFile) {
            
            if let menu = self.mediaTypePopUpButton.menu {
                menu.delegate = self
                menu.insertItem(NSMenuItem.separator()
                      , at: self.mediaTypePopUpButton.index(of: fileItem))
            }
            
            appItem.tag = MediaType.app.rawValue
            tabItem.tag = MediaType.tab.rawValue
            screenItem.tag = MediaType.screen.rawValue
            fileItem.tag = MediaType.file.rawValue
        }
        
        for item in self.mediaTypePopUpButton.itemArray {
            if (initData.availableMediaTypes & item.tag) == 0 {
                item.isEnabled = false
            }
        }
        
        self.mediaTypePopUpButton.selectItem(
                withTag: initData.defaultMediaType.rawValue)

        if initData.i18n_mediaSelectCastLabel != "" {
            labelCast.stringValue = initData.i18n_mediaSelectCastLabel
            labelCast.isHidden = false
        }
        if initData.i18n_mediaSelectToLabel != "" {
            labelTo.stringValue = initData.i18n_mediaSelectToLabel
            labelTo.isHidden = false
        }
        
        if initData.receivers.count == 0 {
            let separator = NSBox()
            separator.boxType = .separator
            
            let notFoundPlaceholder = NSStackView(views: [
                makeLabel(initData.i18n_noReceiversFound)
            ])
            
            notFoundPlaceholder.alignment = .centerX
            notFoundPlaceholder.edgeInsets = NSEdgeInsetsMake(18, 0, 18, 0)
            
            self.mainStackView.addArrangedSubview(separator)
            self.mainStackView.addArrangedSubview(notFoundPlaceholder)
        } else {
            for receiver in initData.receivers {
                let receiverSeparator = NSBox()
                receiverSeparator.boxType = .separator
                
                let receiverView = ReceiverView(receiver: receiver)
                receiverView.receiverViewDelegate = self
                
                if UInt(initData.availableMediaTypes) == 0
                        || (initData.availableMediaTypes
                            & initData.defaultMediaType.rawValue) == 0 {
                    receiverView.isEnabled = false
                }
                
                self.receiverViews.append(receiverView)
                
                self.mainStackView.addArrangedSubview(receiverSeparator)
                self.mainStackView.addArrangedSubview(receiverView)
            }
        }
        
        self.view.frame.size.height = 0
        self.view.frame.size.width = 350
    }
}

extension ViewController: NSMenuDelegate {
    func menuDidClose (_ menu: NSMenu) {
        let initData = InitDataProvider.shared.data
        
        guard let selectedItem = self.mediaTypePopUpButton.selectedItem
            , let mediaType = MediaType(rawValue: selectedItem.tag) else {
            return
        }
        
        if initData.availableMediaTypes & mediaType.rawValue != 0 {
            for receiverView in self.receiverViews {
                receiverView.isEnabled = true
            }
        }
        
        guard let fileItem = self.mediaTypePopUpButton
                .item(at: self.mediaTypePopUpButton.indexOfItem(
                        withTag: MediaType.file.rawValue)) else {
            return
        }
        
        if (mediaType == .file) {
            let panel = NSOpenPanel()
            panel.allowsMultipleSelection = false
            panel.allowedFileTypes = [ "aac", "mp3", "mp4", "wav", "webm" ]
            panel.canChooseDirectories = false
            panel.canCreateDirectories = false
            panel.canChooseFiles = true
            
            guard let window = self.view.window else { return }
            
            panel.beginSheetModal(for: window) { (result) in
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
                        withTag: initData.defaultMediaType.rawValue)
                    
                    let defaultMediaTypeAvailable = initData.availableMediaTypes
                            & initData.defaultMediaType.rawValue != 0
                    
                    for receiverView in self.receiverViews {
                        receiverView.isEnabled = defaultMediaTypeAvailable
                    }
                }
            }
        }
        
        
        // Reset file item
        fileItem.title = initData.i18n_mediaTypeFile
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
        
        
        guard let selectedItem = self.mediaTypePopUpButton.selectedItem
            , let mediaType = MediaType(rawValue: selectedItem.tag) else {
            return
        }
        
        let selection = ReceiverSelection(
                receiver: receiver
              , mediaType: mediaType
              , filePath: self.filePath ?? nil)
        
        if let jsonData = try? JSONEncoder().encode(selection)
         , let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
            fflush(stdout)
        } else {
            fatalError("Error: Failed to encode output data")
        }
    }

    func didStop (_ receiver: Receiver) {
        // TODO: Use separate type and do proper JSON encoding
        let selection = ReceiverSelection(
                receiver: receiver
              , mediaType: nil
              , filePath: nil)

        if let jsonData = try? JSONEncoder().encode(selection)
         , let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
            fflush(stdout)
        } else {
            fatalError("Error: Failed to encode output data")
        }
    }
}
