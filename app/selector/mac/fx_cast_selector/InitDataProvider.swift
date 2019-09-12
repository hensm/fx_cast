import Cocoa

class InitDataProvider {
    static let shared = InitDataProvider()

    let data: InitData
    
    private init() {
        if CommandLine.argc < 2 {
            fatalError("Missing init data")
        }

        if let input = CommandLine.arguments[1].data(using: .utf8)
         , let parsed = try? JSONDecoder().decode(InitData.self, from: input) {
            self.data = parsed
        } else {
            fatalError("Failed to convert and parse init data")
        }
    }
}
