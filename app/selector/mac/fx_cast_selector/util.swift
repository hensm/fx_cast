import Cocoa

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
