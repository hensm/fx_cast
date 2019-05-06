import Cocoa

protocol ReceiverViewDelegate: AnyObject {
    func didCast (_ receiver: Receiver)
}

class ReceiverView: NSStackView {
    weak var receiverViewDelegate: ReceiverViewDelegate?

    var receiver: Receiver!
    var constraintsSet = false

    var button: NSButton!
    var spinner: NSProgressIndicator!

    override init (frame: CGRect) {
        super.init(frame: frame)
    }
    required init? (coder: NSCoder) {
        super.init(coder: coder)
    }

    init (receiver: Receiver) {
        super.init(frame: CGRect(x: 0, y: 0, width: 0, height: 0))

        self.receiver = receiver

        let metaStackView = NSStackView(views: [
            makeLabel(receiver.friendlyName, size: 14)
          , makeLabel("\(receiver.host):\(receiver.port)"
                  , size: NSFont.smallSystemFontSize
                  , color: .secondaryLabelColor)
        ])

        metaStackView.alignment = .leading
        metaStackView.orientation = .vertical
        metaStackView.spacing = 4


        self.button = WideButton(
                title: "Cast"
              , target: self
              , action: #selector(ReceiverView.onCast))

        self.button.bezelStyle = .rounded

        self.spinner = NSProgressIndicator()
        self.spinner.style = .spinning
        self.spinner.controlSize = .small
        self.spinner.isHidden = true

        self.addArrangedSubview(metaStackView)
        self.addArrangedSubview(self.spinner)
        self.addArrangedSubview(self.button)

        self.distribution = .fill
    }

    override func updateConstraints () {
        super.updateConstraints()

        if !constraintsSet {
            self.translatesAutoresizingMaskIntoConstraints = false
            self.leadingAnchor.constraint(equalTo: superview!.leadingAnchor, constant: 8).isActive = true
            self.trailingAnchor.constraint(equalTo: superview!.trailingAnchor, constant: -8).isActive = true

            constraintsSet = true
        }
    }

    func disable () {
        self.button.isEnabled = false
    }

    @objc
    func onCast () {
        self.receiverViewDelegate?.didCast(self.receiver)

        self.spinner.isHidden = false
        self.spinner.startAnimation(nil)
    }
}


class WideButton: NSButton {
    override var intrinsicContentSize: NSSize {
        var size = super.intrinsicContentSize
        if size.width < 100 {
            size.width = 100
        }

        return size
    }
}
