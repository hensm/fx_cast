import Cocoa
import Foundation


func makeLabel(_ text: String,
               size: CGFloat = 0,
               color: NSColor = NSColor.textColor) -> NSTextField {

    let textField = NSTextField()
    textField.stringValue = text
    textField.backgroundColor = .clear
    textField.isEditable = false
    textField.isBezeled = false
    textField.sizeToFit()

    // Text
    textField.font = NSFont.systemFont(ofSize: size)
    textField.textColor = color

    return textField
}


struct InitData: Codable {
    let receivers: [Receiver]
    let defaultMediaType: MediaType

    let i18n_mediaTypeApp: String
    let i18n_mediaTypeTab: String
    let i18n_mediaTypeScreen: String
    let i18n_mediaSelectCastLabel: String
    let i18n_mediaSelectToLabel: String
}

struct ReceiverSelection: Codable {
    let receiver: Receiver
    let mediaType: MediaType
}

enum MediaType: Int, Codable {
    case app
    case tab
    case screen
}

struct Receiver: Codable {
    let friendlyName: String
    let host: String
    let id: String
    let port: Int
}


class ViewController: NSViewController {
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


        let initData: InitData!

        do {
            initData = try JSONDecoder().decode(InitData.self, from: data)
        } catch {
            fputs("Error: Failed to parse input data\n", stderr)
            exit(1)
        }


        let stackView = NSStackView()
        stackView.orientation = .vertical
        stackView.alignment = .leading
        stackView.autoresizingMask = [ .width, .height ]
        stackView.edgeInsets = NSEdgeInsetsMake(8, 8, 8, 8)


        self.mediaTypePopUpButton = NSPopUpButton()
        self.mediaTypePopUpButton.addItems(withTitles: [
            initData.i18n_mediaTypeApp
          , initData.i18n_mediaTypeTab
          , initData.i18n_mediaTypeScreen
        ])

        self.mediaTypePopUpButton.selectItem(at: initData.defaultMediaType.rawValue)

        let mediaTypeStackView = NSStackView(views: [
            makeLabel(initData.i18n_mediaSelectCastLabel),
            self.mediaTypePopUpButton,
            makeLabel(initData.i18n_mediaSelectToLabel)
        ])


        stackView.addArrangedSubview(mediaTypeStackView)


        for receiver in initData.receivers {
            let receiverSeparator = NSBox()
            receiverSeparator.boxType = .separator

            let receiverView = ReceiverView(receiver: receiver)
            receiverView.receiverViewDelegate = self

            self.receiverViews.append(receiverView)

            stackView.addArrangedSubview(receiverSeparator)
            stackView.addArrangedSubview(receiverView)
        }


        self.view.addSubview(stackView)
        self.view.autoresizesSubviews = true
        self.view.frame.size.width = 350
    }
}


extension ViewController: ReceiverViewDelegate {
    func didCast (_ receiver: Receiver) {
        for receiverView in self.receiverViews {
            receiverView.disable()
        }

        do {
            let mediaType = MediaType(
                    rawValue: self.mediaTypePopUpButton.indexOfSelectedItem)!

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
