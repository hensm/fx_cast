struct Receiver : Codable {
    struct Status: Codable {
        struct Application: Codable {
            let displayName: String
            let isIdleScreen: Bool
            let statusText: String
        }

        struct Volume: Codable {
            let level: Double
            let muted: Bool
        }

        let application: Application
        let volume: Volume
    }
    
    let friendlyName: String
    let host: String
    let id: String
    let port: Int
    let status: Status
}
